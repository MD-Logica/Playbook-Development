"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Users, Plus, Shield, UserCircle, Clock, MoreHorizontal,
  Mail, Phone, ChevronDown, Loader2, Check, AlertTriangle,
  RefreshCw, X, ArrowRight, UserMinus, UserPlus,
} from "lucide-react";
import {
  COUNTRY_CODES,
  stripNonDigits,
  formatPhoneAsYouType,
  normalizePhone,
  formatPhoneDisplay,
} from "@/lib/phone";
import type { CountryCode } from "@/lib/phone";

interface StaffUser {
  id: string;
  clerkId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PendingInvite {
  id: string;
  emailAddress: string;
  role: string;
  status: string;
  createdAt: number;
  publicMetadata: {
    staffRole?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

const ROLE_INFO: Record<string, { label: string; description: string; bannerType?: "info" | "amber" }> = {
  ADMIN: {
    label: "Admin",
    description: "Full access to all practice settings, data, and user management.",
  },
  PROVIDER: {
    label: "Provider",
    description: "Full operational access plus exclusive clinical permissions including medical charting, record sign-off, and clinical documentation.",
    bannerType: "info",
  },
  COORDINATOR: {
    label: "Coordinator",
    description: "Operational access to pipeline, patients, deals, and scheduling.",
    bannerType: "amber",
  },
  FRONT_DESK: {
    label: "Front Desk",
    description: "Standard access for reception and scheduling tasks.",
    bannerType: "amber",
  },
};

export default function UsersPage() {
  const { user: clerkUser } = useUser();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<StaffUser | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/settings/users");
      if (res.status === 403) {
        setIsAdmin(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUsers(data.users || []);
      setInvites(data.pendingInvitations || []);
      setIsAdmin(true);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
        <Loader2 size={20} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "400px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Shield size={22} style={{ color: "#D97706" }} strokeWidth={1.6} />
          </div>
          <h2 data-testid="text-access-denied" style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
            Access Denied
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Only administrators can manage users and permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 data-testid="text-users-title" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            Users & Permissions
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Manage your team members, roles, and access.
          </p>
        </div>
        <button
          data-testid="button-invite-staff"
          onClick={() => setShowInviteModal(true)}
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
          }}
        >
          <Plus size={15} />
          Invite Staff Member
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "6px", backgroundColor: "#FEE2E2", fontSize: "13px", color: "#DC2626" }}>
          {error}
        </div>
      )}

      <StaffTable
        users={users}
        currentClerkId={clerkUser?.id}
        onRoleChange={async (userId, role) => {
          const res = await fetch(`/api/settings/users/${userId}/role`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
          });
          if (res.ok) fetchData();
          else {
            const data = await res.json();
            setError(data.error || "Failed to update role");
            setTimeout(() => setError(null), 4000);
          }
        }}
        onDeactivate={(u) => setDeactivatingUser(u)}
        onReactivate={async (userId) => {
          const res = await fetch(`/api/settings/users/${userId}/reactivate`, { method: "PATCH" });
          if (res.ok) fetchData();
        }}
      />

      {invites.length > 0 && (
        <div style={{ marginTop: "28px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px" }}>
            Pending Invites
          </h2>
          <PendingInvitesTable
            invites={invites}
            onCancel={async (inviteId) => {
              const res = await fetch(`/api/settings/users/invites/${inviteId}`, { method: "DELETE" });
              if (res.ok) fetchData();
            }}
            onResend={async () => {
              fetchData();
            }}
          />
        </div>
      )}

      <div style={{ marginTop: "28px", padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-default)" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Full role permissions configuration is coming soon. You'll be able to define exactly what each role can access across the platform.
        </p>
      </div>

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => { setShowInviteModal(false); fetchData(); }}
        />
      )}

      {deactivatingUser && (
        <DeactivateModal
          user={deactivatingUser}
          activeUsers={users.filter((u) => u.isActive && u.id !== deactivatingUser.id)}
          onClose={() => setDeactivatingUser(null)}
          onSuccess={() => { setDeactivatingUser(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function StaffTable({
  users,
  currentClerkId,
  onRoleChange,
  onDeactivate,
  onReactivate,
}: {
  users: StaffUser[];
  currentClerkId?: string;
  onRoleChange: (userId: string, role: string) => void;
  onDeactivate: (user: StaffUser) => void;
  onReactivate: (userId: string) => void;
}) {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-default)", borderRadius: "10px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 18px", borderBottom: "1px solid var(--border-default)" }}>
        <Users size={15} strokeWidth={1.8} style={{ color: "var(--text-muted)" }} />
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Staff Members</h2>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>({users.length})</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
            {["Name", "Role", "Status", "Last Active", "Actions"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "10px 18px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  textAlign: "left",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <StaffRow
              key={u.id}
              user={u}
              isSelf={u.clerkId === currentClerkId}
              onRoleChange={onRoleChange}
              onDeactivate={onDeactivate}
              onReactivate={onReactivate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffRow({
  user,
  isSelf,
  onRoleChange,
  onDeactivate,
  onReactivate,
}: {
  user: StaffUser;
  isSelf: boolean;
  onRoleChange: (userId: string, role: string) => void;
  onDeactivate: (user: StaffUser) => void;
  onReactivate: (userId: string) => void;
}) {
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  const isActive = user.isActive;

  return (
    <tr
      data-testid={`row-user-${user.id}`}
      style={{
        borderBottom: "1px solid var(--border-default)",
        opacity: isActive ? 1 : 0.5,
        backgroundColor: isActive ? "transparent" : "var(--bg-secondary)",
      }}
    >
      <td style={{ padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: isActive ? "#059669" : "var(--bg-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isActive ? "#fff" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              {user.firstName} {user.lastName}
              {isSelf && (
                <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "6px", fontWeight: 400 }}>(you)</span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{user.email}</div>
          </div>
        </div>
      </td>

      <td style={{ padding: "12px 18px" }}>
        <select
          data-testid={`select-role-${user.id}`}
          value={user.role}
          onChange={(e) => onRoleChange(user.id, e.target.value)}
          disabled={!isActive}
          style={{
            padding: "4px 8px",
            fontSize: "12px",
            border: "1px solid var(--border-default)",
            borderRadius: "4px",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
            cursor: isActive ? "pointer" : "default",
            outline: "none",
          }}
        >
          <option value="ADMIN">Admin</option>
          <option value="PROVIDER">Provider</option>
          <option value="COORDINATOR">Coordinator</option>
          <option value="FRONT_DESK">Front Desk</option>
        </select>
      </td>

      <td style={{ padding: "12px 18px" }}>
        <span
          data-testid={`badge-status-${user.id}`}
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: "4px",
            backgroundColor: isActive ? "#D1FAE5" : "#F3F4F6",
            color: isActive ? "#065F46" : "#6B7280",
          }}
        >
          {isActive ? "Active" : "Deactivated"}
        </span>
      </td>

      <td style={{ padding: "12px 18px" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {formatRelativeTime(user.updatedAt)}
        </span>
      </td>

      <td style={{ padding: "12px 18px" }}>
        {isActive && !isSelf && (
          <button
            data-testid={`button-deactivate-${user.id}`}
            onClick={() => onDeactivate(user)}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 500,
              color: "#EF4444",
              backgroundColor: "transparent",
              border: "1px solid #FECACA",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            Deactivate
          </button>
        )}
        {!isActive && (
          <button
            data-testid={`button-reactivate-${user.id}`}
            onClick={() => onReactivate(user.id)}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 500,
              color: "#059669",
              backgroundColor: "transparent",
              border: "1px solid #A7F3D0",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#ECFDF5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            Reactivate
          </button>
        )}
      </td>
    </tr>
  );
}

function PendingInvitesTable({
  invites,
  onCancel,
  onResend,
}: {
  invites: PendingInvite[];
  onCancel: (id: string) => void;
  onResend: (id: string) => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  return (
    <div style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-default)", borderRadius: "10px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
            {["Name", "Contact", "Role", "Invited", "Actions"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "10px 18px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  textAlign: "left",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => (
            <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
              <td style={{ padding: "12px 18px", fontSize: "13px", color: "var(--text-primary)" }}>
                {inv.publicMetadata?.firstName || ""} {inv.publicMetadata?.lastName || ""}
              </td>
              <td style={{ padding: "12px 18px", fontSize: "12px", color: "var(--text-muted)" }}>
                {inv.emailAddress || inv.publicMetadata?.phone || "—"}
              </td>
              <td style={{ padding: "12px 18px", fontSize: "12px", color: "var(--text-secondary)" }}>
                {ROLE_INFO[inv.publicMetadata?.staffRole || ""]?.label || inv.publicMetadata?.staffRole || "—"}
              </td>
              <td style={{ padding: "12px 18px", fontSize: "12px", color: "var(--text-muted)" }}>
                {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}
              </td>
              <td style={{ padding: "12px 18px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  {cancellingId === inv.id ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Cancel invite?</span>
                      <button
                        data-testid={`button-confirm-cancel-${inv.id}`}
                        onClick={() => { onCancel(inv.id); setCancellingId(null); }}
                        style={{ padding: "3px 8px", fontSize: "11px", color: "#EF4444", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setCancellingId(null)}
                        style={{ padding: "3px 8px", fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "4px", cursor: "pointer" }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        data-testid={`button-cancel-invite-${inv.id}`}
                        onClick={() => setCancellingId(inv.id)}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          color: "#EF4444",
                          backgroundColor: "transparent",
                          border: "1px solid #FECACA",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [role, setRole] = useState("COORDINATOR");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneChange = (raw: string) => {
    const digits = stripNonDigits(raw);
    if (digits.length <= countryCode.digits) {
      setPhone(formatPhoneAsYouType(digits));
    }
  };

  const handleSubmit = async () => {
    setSending(true);
    setError(null);
    try {
      const body: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactMethod,
        role,
      };
      if (contactMethod === "email") {
        body.email = email.trim();
      } else {
        body.phone = normalizePhone(stripNonDigits(phone), countryCode.dial);
      }

      const res = await fetch("/api/settings/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite");
      }

      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const selectedRoleInfo = ROLE_INFO[role];

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", width: "480px", padding: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Invite Staff Member</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
              First Name
            </label>
            <input
              data-testid="input-invite-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", fontSize: "13px", border: "1px solid var(--border-default)", borderRadius: "6px", outline: "none", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
              Last Name
            </label>
            <input
              data-testid="input-invite-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", fontSize: "13px", border: "1px solid var(--border-default)", borderRadius: "6px", outline: "none", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
            Contact Method
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                data-testid={`button-contact-${m}`}
                onClick={() => setContactMethod(m)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px",
                  fontSize: "13px",
                  fontWeight: contactMethod === m ? 600 : 400,
                  color: contactMethod === m ? "var(--brand-primary)" : "var(--text-secondary)",
                  backgroundColor: contactMethod === m ? "rgba(16,185,129,0.08)" : "var(--bg-secondary)",
                  border: contactMethod === m ? "1px solid var(--brand-primary)" : "1px solid var(--border-default)",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {m === "email" ? <Mail size={14} /> : <Phone size={14} />}
                {m === "email" ? "Email" : "Phone Number"}
              </button>
            ))}
          </div>
        </div>

        {contactMethod === "email" ? (
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
              Email Address
            </label>
            <input
              data-testid="input-invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              style={{ width: "100%", padding: "8px 12px", fontSize: "13px", border: "1px solid var(--border-default)", borderRadius: "6px", outline: "none", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}
            />
          </div>
        ) : (
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
              Phone Number
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ position: "relative" }}>
                <button
                  data-testid="button-invite-country-code"
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
                      zIndex: 51,
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
                          backgroundColor: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <span>{cc.flag}</span>
                        <span>{cc.code} +{cc.dial}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                data-testid="input-invite-phone"
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(555) 555-5555"
                style={{ flex: 1, padding: "8px 12px", fontSize: "13px", border: "1px solid var(--border-default)", borderRadius: "6px", outline: "none", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}
              />
            </div>
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
            Role
          </label>
          <select
            data-testid="select-invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", fontSize: "13px", border: "1px solid var(--border-default)", borderRadius: "6px", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", outline: "none" }}
          >
            <option value="ADMIN">Admin</option>
            <option value="PROVIDER">Provider</option>
            <option value="COORDINATOR">Coordinator</option>
            <option value="FRONT_DESK">Front Desk</option>
          </select>
          {selectedRoleInfo && (
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
              {selectedRoleInfo.description}
            </p>
          )}
          {selectedRoleInfo?.bannerType === "info" && (
            <div style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "5px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", fontSize: "11px", color: "#1E40AF", lineHeight: 1.4 }}>
              Permissions not yet configured.
            </div>
          )}
          {selectedRoleInfo?.bannerType === "amber" && (
            <div style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "5px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontSize: "11px", color: "#92400E", lineHeight: 1.4 }}>
              Configure permissions before assigning this role. Default permissions for this role haven't been set up yet. Assign carefully until permissions are configured.
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: "12px", padding: "8px 10px", borderRadius: "5px", backgroundColor: "#FEE2E2", fontSize: "12px", color: "#DC2626" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: "13px", color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            data-testid="button-send-invite"
            onClick={handleSubmit}
            disabled={sending || !firstName.trim() || !lastName.trim() || (contactMethod === "email" ? !email.trim() : !stripNonDigits(phone))}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              opacity: sending || !firstName.trim() || !lastName.trim() ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {sending && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeactivateModal({
  user,
  activeUsers,
  onClose,
  onSuccess,
}: {
  user: StaffUser;
  activeUsers: StaffUser[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [openDealCount, setOpenDealCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState(false);
  const [reassignOption, setReassignOption] = useState<"bulk" | "manual">("bulk");
  const [reassignToId, setReassignToId] = useState<string>(activeUsers[0]?.id || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkDeals() {
      try {
        const res = await fetch(`/api/settings/users/${user.id}/open-deals`);
        if (res.ok) {
          const data = await res.json();
          setOpenDealCount(data.count);
        }
      } catch {
        setOpenDealCount(0);
      } finally {
        setLoading(false);
      }
    }
    checkDeals();
  }, [user.id]);

  const handleDeactivate = async () => {
    setDeactivating(true);
    setError(null);
    try {
      const body: any = {};
      if (openDealCount && openDealCount > 0 && reassignOption === "bulk" && reassignToId) {
        body.reassignToUserId = reassignToId;
      }

      const res = await fetch(`/api/settings/users/${user.id}/deactivate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to deactivate");
      }

      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", width: "480px", padding: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
          Deactivate {user.firstName} {user.lastName}?
        </h3>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "20px 0" }}>
            <Loader2 size={16} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Checking open deals...</span>
          </div>
        ) : openDealCount === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "16px" }}>
            They will lose access immediately but their activity history will be preserved.
          </p>
        ) : (
          <div>
            <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "6px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <AlertTriangle size={16} style={{ color: "#D97706", flexShrink: 0, marginTop: "2px" }} />
              <p style={{ fontSize: "13px", color: "#92400E", lineHeight: 1.5 }}>
                {user.firstName} has <strong>{openDealCount}</strong> open deal{openDealCount !== 1 ? "s" : ""} assigned to them. Choose how to handle reassignment before deactivating.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              <button
                data-testid="button-bulk-reassign"
                onClick={() => setReassignOption("bulk")}
                style={{
                  padding: "14px",
                  border: reassignOption === "bulk" ? "2px solid var(--brand-primary)" : "1px solid var(--border-default)",
                  borderRadius: "8px",
                  backgroundColor: reassignOption === "bulk" ? "rgba(16,185,129,0.04)" : "var(--bg-secondary)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "3px" }}>
                  Bulk Reassign
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Move all {openDealCount} open deal{openDealCount !== 1 ? "s" : ""} to one staff member
                </div>
              </button>

              {reassignOption === "bulk" && (
                <div style={{ paddingLeft: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Reassign all deals to:
                  </label>
                  <select
                    data-testid="select-reassign-to"
                    value={reassignToId}
                    onChange={(e) => setReassignToId(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: "13px", border: "1px solid var(--border-default)", borderRadius: "6px", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", outline: "none" }}
                  >
                    {activeUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} — {ROLE_INFO[u.role]?.label || u.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                data-testid="button-manual-reassign"
                onClick={() => setReassignOption("manual")}
                style={{
                  padding: "14px",
                  border: reassignOption === "manual" ? "2px solid var(--brand-primary)" : "1px solid var(--border-default)",
                  borderRadius: "8px",
                  backgroundColor: reassignOption === "manual" ? "rgba(16,185,129,0.04)" : "var(--bg-secondary)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "3px" }}>
                  Reassign Manually
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  I'll reassign deals individually from each patient's profile or the pipeline board.
                </div>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: "12px", padding: "8px 10px", borderRadius: "5px", backgroundColor: "#FEE2E2", fontSize: "12px", color: "#DC2626" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            data-testid="button-cancel-deactivate"
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: "13px", color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            data-testid="button-confirm-deactivate"
            onClick={handleDeactivate}
            disabled={deactivating || loading}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: "#EF4444",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              opacity: deactivating || loading ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {deactivating && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {deactivating ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
