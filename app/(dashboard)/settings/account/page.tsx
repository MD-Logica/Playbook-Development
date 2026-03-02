"use client";

import { useState, useEffect } from "react";
import { useUser, useSession, useSessionList, useClerk } from "@clerk/nextjs";
import {
  Monitor, Check, Loader2, User, Shield, Smartphone, Key,
  Lock, AlertTriangle, Globe, Clock, LogOut, Fingerprint,
  Mail, Phone, ChevronDown,
} from "lucide-react";
import {
  COUNTRY_CODES,
  stripNonDigits,
  formatPhoneAsYouType,
  normalizePhone,
  formatPhoneDisplay,
} from "@/lib/phone";
import type { CountryCode } from "@/lib/phone";

interface Pipeline {
  id: string;
  name: string;
}

export default function AccountSettingsPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { session } = useSession();
  const clerk = useClerk();

  const [landingPage, setLandingPage] = useState<string>("dashboard");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [prefLoading, setPrefLoading] = useState(true);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [prefRes, pipelinesRes] = await Promise.all([
          fetch("/api/user/preferences"),
          fetch("/api/pipeline/board"),
        ]);
        if (prefRes.ok) {
          const data = await prefRes.json();
          setLandingPage(data.defaultLandingPage || "dashboard");
        }
        if (pipelinesRes.ok) {
          const data = await pipelinesRes.json();
          if (data.pipelines) {
            setPipelines(data.pipelines.map((p: any) => ({ id: p.id, name: p.name })));
          }
        }
      } catch {
      } finally {
        setPrefLoading(false);
      }
    }
    load();
  }, []);

  async function handlePrefSave(value: string) {
    setLandingPage(value);
    setPrefSaving(true);
    setPrefSaved(false);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultLandingPage: value === "dashboard" ? null : value }),
      });
      if (res.ok) {
        setPrefSaved(true);
        setTimeout(() => setPrefSaved(false), 2000);
      }
    } catch {
    } finally {
      setPrefSaving(false);
    }
  }

  if (!userLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading account...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 data-testid="text-settings-title" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
          My Account
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Manage your personal information, security settings, and active sessions.
        </p>
      </div>

      <PersonalInformationSection user={user} />

      <div style={{ height: "20px" }} />

      <LandingPageSection
        landingPage={landingPage}
        pipelines={pipelines}
        loading={prefLoading}
        saving={prefSaving}
        saved={prefSaved}
        onSave={handlePrefSave}
      />

      <div style={{ height: "20px" }} />

      <SecuritySection user={user} />

      <div style={{ height: "20px" }} />

      <SessionsSection session={session} clerk={clerk} user={user} />
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <Icon size={16} strokeWidth={1.8} style={{ color: "var(--text-muted)" }} />
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function PersonalInformationSection({ user }: { user: any }) {
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || "");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.primaryEmailAddress?.emailAddress || "");
      const rawPhone = user.primaryPhoneNumber?.phoneNumber || "";
      if (rawPhone) {
        const digits = stripNonDigits(rawPhone);
        if (digits.startsWith("1") && digits.length === 11) {
          setPhone(formatPhoneAsYouType(digits.slice(1)));
          setCountryCode(COUNTRY_CODES[0]);
        } else {
          setPhone(formatPhoneDisplay(rawPhone));
        }
      }
    }
  }, [user]);

  const hasChanges = () => {
    return (
      firstName !== (user?.firstName || "") ||
      lastName !== (user?.lastName || "") ||
      email !== (user?.primaryEmailAddress?.emailAddress || "")
    );
  };

  const handlePhoneChange = (raw: string) => {
    const digits = stripNonDigits(raw);
    if (digits.length <= countryCode.digits) {
      setPhone(formatPhoneAsYouType(digits));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setEmailNote(null);
    setSaved(false);

    try {
      if (firstName !== user?.firstName || lastName !== user?.lastName) {
        await user.update({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
      }

      const newEmail = email.trim().toLowerCase();
      const currentEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (newEmail && newEmail !== currentEmail) {
        try {
          const emailAddress = await user.createEmailAddress({ email: newEmail });
          await emailAddress.prepareVerification({ strategy: "email_link", redirectUrl: window.location.href });
          setEmailNote("A verification link has been sent to your new email address. Please verify it to complete the change.");
        } catch (e: any) {
          setError(e.errors?.[0]?.longMessage || e.message || "Failed to update email");
          setSaving(false);
          return;
        }
      }

      const rawDigits = stripNonDigits(phone);
      if (rawDigits.length === countryCode.digits) {
        const normalized = normalizePhone(rawDigits, countryCode.dial);
        const currentPhone = user?.primaryPhoneNumber?.phoneNumber;
        if (normalized !== currentPhone) {
          try {
            const phoneNumber = await user.createPhoneNumber({ phoneNumber: normalized });
            await phoneNumber.prepareVerification();
          } catch (e: any) {
            if (!e.errors?.[0]?.code?.includes("already_exists")) {
              setError(e.errors?.[0]?.longMessage || e.message || "Failed to update phone");
              setSaving(false);
              return;
            }
          }
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage || e.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Personal Information" icon={User}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
            First Name
          </label>
          <input
            data-testid="input-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              outline: "none",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
            Last Name
          </label>
          <input
            data-testid="input-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              outline: "none",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
          Email Address
        </label>
        <div style={{ position: "relative" }}>
          <Mail size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            data-testid="input-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              fontSize: "13px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              outline: "none",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
          Phone Number
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <button
              data-testid="button-country-code"
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "8px 8px",
                fontSize: "13px",
                border: "1px solid var(--border-default)",
                borderRadius: "6px",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minWidth: "72px",
              }}
            >
              <span style={{ fontSize: "12px" }}>{countryCode.flag}</span>
              <span>+{countryCode.dial}</span>
              <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
            </button>
            {showCountryDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "4px",
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 50,
                  minWidth: "140px",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {COUNTRY_CODES.map((cc) => (
                  <button
                    key={cc.code}
                    onClick={() => { setCountryCode(cc); setShowCountryDropdown(false); }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      color: "var(--text-primary)",
                      backgroundColor: cc.code === countryCode.code ? "var(--bg-tertiary)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = cc.code === countryCode.code ? "var(--bg-tertiary)" : "transparent"; }}
                  >
                    <span style={{ fontSize: "12px" }}>{cc.flag}</span>
                    <span>{cc.code} +{cc.dial}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            <Phone size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              data-testid="input-phone"
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(555) 555-5555"
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                fontSize: "13px",
                border: "1px solid var(--border-default)",
                borderRadius: "6px",
                outline: "none",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {emailNote && (
        <div
          data-testid="text-email-verification-note"
          style={{
            marginBottom: "12px",
            padding: "10px 12px",
            borderRadius: "6px",
            backgroundColor: "#DBEAFE",
            border: "1px solid #93C5FD",
            fontSize: "12px",
            color: "#1E40AF",
            lineHeight: 1.5,
          }}
        >
          {emailNote}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: "12px", padding: "10px 12px", borderRadius: "6px", backgroundColor: "#FEE2E2", fontSize: "12px", color: "#DC2626" }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ marginBottom: "12px", padding: "10px 12px", borderRadius: "6px", backgroundColor: "#D1FAE5", fontSize: "12px", color: "#065F46", display: "flex", alignItems: "center", gap: "6px" }}>
          <Check size={14} />
          Profile updated successfully.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          data-testid="button-save-profile"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: "var(--brand-primary)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </SectionCard>
  );
}

function LandingPageSection({
  landingPage,
  pipelines,
  loading,
  saving,
  saved,
  onSave,
}: {
  landingPage: string;
  pipelines: Pipeline[];
  loading: boolean;
  saving: boolean;
  saved: boolean;
  onSave: (v: string) => void;
}) {
  return (
    <SectionCard title="Preferences" icon={Monitor}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <label htmlFor="landing-page-select" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            Default landing page
          </label>
          {saving && <Loader2 size={13} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />}
          {saved && <Check size={13} style={{ color: "#10B981" }} />}
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>
          Choose which page you see first when you log in.
        </p>
        {loading ? (
          <div style={{ width: "200px", height: "36px", borderRadius: "6px", backgroundColor: "var(--bg-tertiary)" }} />
        ) : (
          <select
            id="landing-page-select"
            data-testid="select-default-landing-page"
            value={landingPage}
            onChange={(e) => onSave(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "320px",
              height: "36px",
              padding: "0 10px",
              fontSize: "13px",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="dashboard">Dashboard</option>
            {pipelines.map((p) => (
              <option key={p.id} value={`pipeline:${p.id}`}>
                Pipeline — {p.name}
              </option>
            ))}
            <option value="patients">Patients</option>
            <option value="appointments">Appointments</option>
          </select>
        )}
      </div>
    </SectionCard>
  );
}

function SecuritySection({ user }: { user: any }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const hasPassword = user?.passwordEnabled;
  const twoFactorEnabled = user?.twoFactorEnabled;
  const totpEnabled = user?.totpEnabled;
  const backupCodeEnabled = user?.backupCodeEnabled;

  const phoneNumbers = user?.phoneNumbers || [];
  const smsEnabled = phoneNumbers.some((p: any) => p.verification?.status === "verified" && p.reservedForSecondFactor);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    setPasswordError(null);
    try {
      await user.updatePassword({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e: any) {
      setPasswordError(e.errors?.[0]?.longMessage || e.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [managing2FA, setManaging2FA] = useState(false);

  return (
    <SectionCard title="Security & Authentication" icon={Shield}>
      {/* Password Section */}
      <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Lock size={14} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Password</span>
          </div>
          {!showPasswordForm && (
            <button
              data-testid="button-change-password"
              onClick={() => setShowPasswordForm(true)}
              style={{
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: "5px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {hasPassword ? "Change Password" : "Add Password"}
            </button>
          )}
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: showPasswordForm ? "12px" : "0" }}>
          {hasPassword ? "Your account is protected with a password." : "No password set. You can add one for additional security."}
        </p>

        {showPasswordForm && (
          <div style={{ padding: "12px", backgroundColor: "var(--bg-secondary)", borderRadius: "6px", border: "1px solid var(--border-default)" }}>
            {hasPassword && (
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Current Password
                </label>
                <input
                  data-testid="input-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  New Password
                </label>
                <input
                  data-testid="input-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Confirm Password
                </label>
                <input
                  data-testid="input-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {passwordError && (
              <div style={{ marginBottom: "10px", padding: "8px 10px", borderRadius: "5px", backgroundColor: "#FEE2E2", fontSize: "12px", color: "#DC2626" }}>
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div style={{ marginBottom: "10px", padding: "8px 10px", borderRadius: "5px", backgroundColor: "#D1FAE5", fontSize: "12px", color: "#065F46", display: "flex", alignItems: "center", gap: "6px" }}>
                <Check size={14} /> Password updated successfully.
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                data-testid="button-cancel-password"
                onClick={() => { setShowPasswordForm(false); setPasswordError(null); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                data-testid="button-save-password"
                onClick={handlePasswordChange}
                disabled={changingPassword || !newPassword || !confirmPassword}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#fff",
                  backgroundColor: "var(--brand-primary)",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  opacity: changingPassword || !newPassword || !confirmPassword ? 0.5 : 1,
                }}
              >
                {changingPassword ? "Saving..." : hasPassword ? "Change Password" : "Set Password"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Two-Factor Authentication Section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Fingerprint size={14} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Two-Factor Authentication</span>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: twoFactorEnabled ? "#D1FAE5" : "#FEF3C7",
              color: twoFactorEnabled ? "#065F46" : "#92400E",
            }}
          >
            {twoFactorEnabled ? "Enabled" : "Not Enabled"}
          </span>
        </div>

        {!twoFactorEnabled && (
          <div
            data-testid="banner-2fa-warning"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "10px 14px",
              marginBottom: "14px",
              borderRadius: "6px",
              backgroundColor: "#FFFBEB",
              border: "1px solid #FDE68A",
            }}
          >
            <AlertTriangle size={16} style={{ color: "#D97706", flexShrink: 0, marginTop: "1px" }} />
            <div>
              <p style={{ fontSize: "12px", color: "#92400E", lineHeight: 1.5, marginBottom: "8px" }}>
                Your account is not protected by two-factor authentication. We strongly recommend enabling it.
              </p>
              <button
                data-testid="button-enable-2fa"
                onClick={() => setManaging2FA(true)}
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#92400E",
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #FDE68A",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Enable 2FA
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <TwoFactorMethod
            icon={Smartphone}
            label="SMS / Text Message"
            description="Receive verification codes via text message"
            enabled={smsEnabled}
            onManage={() => setManaging2FA(true)}
          />
          <TwoFactorMethod
            icon={Key}
            label="Authenticator App (TOTP)"
            description="Use an authenticator app like Google Authenticator"
            enabled={totpEnabled}
            onManage={() => setManaging2FA(true)}
          />
          <TwoFactorMethod
            icon={Fingerprint}
            label="Backup Codes"
            description="One-time recovery codes for account access"
            enabled={backupCodeEnabled}
            onManage={() => setManaging2FA(true)}
          />
        </div>

        {managing2FA && (
          <TwoFactorSetupModal user={user} onClose={() => setManaging2FA(false)} />
        )}
      </div>
    </SectionCard>
  );
}

function TwoFactorMethod({ icon: Icon, label, description, enabled, onManage }: {
  icon: any;
  label: string;
  description: string;
  enabled: boolean;
  onManage: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        borderRadius: "6px",
        border: "1px solid var(--border-default)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      <Icon size={16} strokeWidth={1.6} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{description}</div>
      </div>
      {enabled && (
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#059669", display: "flex", alignItems: "center", gap: "3px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
          Active
        </span>
      )}
      <button
        data-testid={`button-manage-${label.toLowerCase().replace(/[^a-z]/g, "-")}`}
        onClick={onManage}
        style={{
          padding: "4px 10px",
          fontSize: "11px",
          fontWeight: 500,
          color: "var(--text-secondary)",
          backgroundColor: "transparent",
          border: "1px solid var(--border-default)",
          borderRadius: "4px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        {enabled ? "Manage" : "Set Up"}
      </button>
    </div>
  );
}

function TwoFactorSetupModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [step, setStep] = useState<"choose" | "totp-setup" | "sms-setup">("choose");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startTOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      const totp = await user.createTOTP();
      setTotpUri(totp.uri);
      setTotpSecret(totp.secret);
      setStep("totp-setup");
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage || e.message || "Failed to start TOTP setup");
    } finally {
      setLoading(false);
    }
  };

  const verifyTOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      await user.verifyTOTP({ code: verifyCode });
      onClose();
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage || e.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const disableTOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      await user.disableTOTP();
      onClose();
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage || e.message || "Failed to disable TOTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "440px",
          padding: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          {step === "choose" ? "Two-Factor Authentication" : step === "totp-setup" ? "Set Up Authenticator App" : "Set Up SMS Verification"}
        </h3>

        {step === "choose" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              data-testid="button-setup-totp"
              onClick={startTOTP}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
                backgroundColor: "var(--bg-secondary)",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
            >
              <Key size={20} style={{ color: "var(--text-muted)" }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Authenticator App</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Use Google Authenticator, Authy, or similar</div>
              </div>
            </button>

            {user?.totpEnabled && (
              <button
                data-testid="button-disable-totp"
                onClick={disableTOTP}
                disabled={loading}
                style={{
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#EF4444",
                  backgroundColor: "transparent",
                  border: "1px solid #FECACA",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {loading ? "Disabling..." : "Disable Authenticator App"}
              </button>
            )}

            {error && (
              <div style={{ padding: "8px 10px", borderRadius: "5px", backgroundColor: "#FEE2E2", fontSize: "12px", color: "#DC2626" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {step === "totp-setup" && (
          <div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.5 }}>
              Scan the QR code below with your authenticator app, or manually enter the secret key.
            </p>

            {totpUri && (
              <div style={{ textAlign: "center", marginBottom: "14px" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "12px",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <img
                    data-testid="img-totp-qr"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                    alt="TOTP QR Code"
                    width={180}
                    height={180}
                  />
                </div>
              </div>
            )}

            {totpSecret && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "4px" }}>
                  Secret Key (manual entry)
                </label>
                <code
                  data-testid="text-totp-secret"
                  style={{
                    display: "block",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    wordBreak: "break-all",
                    userSelect: "all",
                  }}
                >
                  {totpSecret}
                </code>
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
                Verification Code
              </label>
              <input
                data-testid="input-totp-code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "16px",
                  letterSpacing: "4px",
                  textAlign: "center",
                  border: "1px solid var(--border-default)",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && verifyCode.length === 6) verifyTOTP(); }}
              />
            </div>

            {error && (
              <div style={{ marginBottom: "12px", padding: "8px 10px", borderRadius: "5px", backgroundColor: "#FEE2E2", fontSize: "12px", color: "#DC2626" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => setStep("choose")}
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                data-testid="button-verify-totp"
                onClick={verifyTOTP}
                disabled={loading || verifyCode.length !== 6}
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#fff",
                  backgroundColor: "var(--brand-primary)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  opacity: loading || verifyCode.length !== 6 ? 0.5 : 1,
                }}
              >
                {loading ? "Verifying..." : "Verify & Enable"}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
          {step === "choose" && (
            <button
              data-testid="button-close-2fa"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionsSection({ session, clerk, user }: { session: any; clerk: any; user: any }) {
  const { sessions: sessionList, isLoaded: sessionsLoaded } = useSessionList();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showConfirmRevokeAll, setShowConfirmRevokeAll] = useState(false);
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());

  const sessions = (sessionList || []).filter(
    (s: any) => s.status === "active" && !revokedIds.has(s.id)
  );
  const loading = !sessionsLoaded;

  const revokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const targetSession = sessions.find((s: any) => s.id === sessionId);
      if (targetSession) {
        await targetSession.revoke();
        setRevokedIds((prev) => new Set(prev).add(sessionId));
      }
    } catch {
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOther = async () => {
    setRevokingAll(true);
    try {
      const otherSessions = sessions.filter((s: any) => s.id !== session?.id);
      for (const s of otherSessions) {
        await s.revoke();
        setRevokedIds((prev) => new Set(prev).add(s.id));
      }
      setShowConfirmRevokeAll(false);
    } catch {
    } finally {
      setRevokingAll(false);
    }
  };

  const formatDeviceInfo = (s: any) => {
    const client = s.latestActivity;
    if (!client) return "Unknown device";
    const browser = client.browserName || "Unknown browser";
    const os = client.deviceType || client.isMobile ? "Mobile" : "Desktop";
    return `${browser} on ${os}`;
  };

  const formatLocation = (s: any) => {
    const client = s.latestActivity;
    if (!client) return "";
    const city = client.city;
    const country = client.country;
    if (city && country) return `${city}, ${country}`;
    if (country) return country;
    return "";
  };

  const formatLastActive = (s: any) => {
    const date = s.lastActiveAt || s.updatedAt;
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  const currentSessionId = session?.id;
  const otherSessions = sessions.filter((s: any) => s.id !== currentSessionId);
  const currentSessionObj = sessions.find((s: any) => s.id === currentSessionId);

  return (
    <SectionCard title="Active Sessions" icon={Globe}>
      {loading ? (
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading sessions...</div>
      ) : (
        <>
          {currentSessionObj && (
            <SessionRow
              session={currentSessionObj}
              isCurrent
              deviceInfo={formatDeviceInfo(currentSessionObj)}
              location={formatLocation(currentSessionObj)}
              lastActive={formatLastActive(currentSessionObj)}
            />
          )}

          {otherSessions.map((s: any) => (
            <SessionRow
              key={s.id}
              session={s}
              isCurrent={false}
              deviceInfo={formatDeviceInfo(s)}
              location={formatLocation(s)}
              lastActive={formatLastActive(s)}
              onRevoke={() => revokeSession(s.id)}
              isRevoking={revokingId === s.id}
            />
          ))}

          {sessions.length === 0 && (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No active sessions found.</p>
          )}

          {otherSessions.length > 0 && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-default)" }}>
              {showConfirmRevokeAll ? (
                <div style={{ padding: "12px", backgroundColor: "#FEF2F2", borderRadius: "6px", border: "1px solid #FECACA" }}>
                  <p style={{ fontSize: "13px", color: "#991B1B", marginBottom: "10px", lineHeight: 1.5 }}>
                    This will sign you out of all other active sessions. You will remain signed in on this device.
                  </p>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      data-testid="button-cancel-revoke-all"
                      onClick={() => setShowConfirmRevokeAll(false)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        backgroundColor: "#fff",
                        border: "1px solid var(--border-default)",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      data-testid="button-confirm-revoke-all"
                      onClick={revokeAllOther}
                      disabled={revokingAll}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#fff",
                        backgroundColor: "#EF4444",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        opacity: revokingAll ? 0.5 : 1,
                      }}
                    >
                      {revokingAll ? "Signing out..." : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  data-testid="button-revoke-all-sessions"
                  onClick={() => setShowConfirmRevokeAll(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#EF4444",
                    backgroundColor: "transparent",
                    border: "1px solid #FECACA",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <LogOut size={14} />
                  Sign out all other devices
                </button>
              )}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

function SessionRow({ session, isCurrent, deviceInfo, location, lastActive, onRevoke, isRevoking }: {
  session: any;
  isCurrent: boolean;
  deviceInfo: string;
  location: string;
  lastActive: string;
  onRevoke?: () => void;
  isRevoking?: boolean;
}) {
  return (
    <div
      data-testid={`session-row-${session.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "6px",
          backgroundColor: isCurrent ? "rgba(16,185,129,0.1)" : "var(--bg-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Monitor size={16} style={{ color: isCurrent ? "var(--brand-primary)" : "var(--text-muted)" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
            {deviceInfo}
          </span>
          {isCurrent && (
            <span
              data-testid="badge-current-session"
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#059669",
                backgroundColor: "#D1FAE5",
                padding: "1px 6px",
                borderRadius: "3px",
              }}
            >
              This device
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          {location && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
              <Globe size={10} /> {location}
            </span>
          )}
          {lastActive && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
              <Clock size={10} /> {lastActive}
            </span>
          )}
        </div>
      </div>

      {!isCurrent && onRevoke && (
        <button
          data-testid={`button-revoke-session-${session.id}`}
          onClick={onRevoke}
          disabled={isRevoking}
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            fontWeight: 500,
            color: "#EF4444",
            backgroundColor: "transparent",
            border: "1px solid #FECACA",
            borderRadius: "4px",
            cursor: "pointer",
            flexShrink: 0,
            opacity: isRevoking ? 0.5 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          {isRevoking ? "..." : "Sign out"}
        </button>
      )}
    </div>
  );
}
