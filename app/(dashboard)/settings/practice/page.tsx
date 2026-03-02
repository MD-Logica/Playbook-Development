"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Upload, X, Palette } from "lucide-react";

interface Practice {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export default function PracticePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const { data: practice, isLoading } = useQuery<Practice>({
    queryKey: ["/api/practice"],
    queryFn: async () => {
      const res = await fetch("/api/practice");
      if (!res.ok) throw new Error("Failed to fetch practice");
      return res.json();
    },
  });

  useEffect(() => {
    if (practice && !initialized) {
      setPrimaryColor(practice.primaryColor || "");
      setSecondaryColor(practice.secondaryColor || "");
      setInitialized(true);
    }
  }, [practice, initialized]);

  const saveMutation = useMutation({
    mutationFn: async (data: { primaryColor?: string; secondaryColor?: string }) => {
      const res = await fetch("/api/practice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
      setToast({ message: "Changes saved", type: "success" });
    },
    onError: () => {
      setToast({ message: "Failed to save changes", type: "error" });
    },
  });

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/practice/logo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload logo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
      setToast({ message: "Logo uploaded", type: "success" });
    },
    onError: () => {
      setToast({ message: "Failed to upload logo", type: "error" });
    },
  });

  const logoDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/practice/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove logo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
      setToast({ message: "Logo removed", type: "success" });
    },
    onError: () => {
      setToast({ message: "Failed to remove logo", type: "error" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      logoUploadMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    saveMutation.mutate({
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid var(--border-default)",
            borderTopColor: "var(--brand-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading practice settings...</span>
      </div>
    );
  }

  if (!practice) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>No practice found.</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}
          data-testid="page-title"
        >
          Practice Settings
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.5 }}>
          View your practice information and customize branding.
        </p>
      </div>

      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          border: "1px solid var(--border-default)",
          padding: "24px",
          marginBottom: "20px",
        }}
        data-testid="practice-info-section"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Building2 size={18} style={{ color: "var(--brand-primary)" }} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Practice Information
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <InfoField label="Practice Name" value={practice.name} testId="field-name" />
          <InfoField label="Timezone" value={practice.timezone} testId="field-timezone" />
          <InfoField label="Address" value={practice.address} testId="field-address" />
          <InfoField
            label="City, State"
            value={[practice.city, practice.state].filter(Boolean).join(", ") || null}
            testId="field-city-state"
          />
          <InfoField label="Phone" value={practice.phone} testId="field-phone" />
          <InfoField label="Email" value={practice.email} testId="field-email" />
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          border: "1px solid var(--border-default)",
          padding: "24px",
          marginBottom: "20px",
        }}
        data-testid="practice-branding-section"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Palette size={18} style={{ color: "var(--brand-primary)" }} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Practice Branding
          </h2>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "8px" }}>
            Practice Logo
          </label>

          {practice.logoUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-default)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                <img
                  src={practice.logoUrl}
                  alt="Practice logo"
                  data-testid="logo-preview"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="change-logo-button"
                  disabled={logoUploadMutation.isPending}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    borderRadius: "6px",
                    border: "1px solid var(--border-default)",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Upload size={12} />
                  Change
                </button>
                <button
                  onClick={() => logoDeleteMutation.mutate()}
                  data-testid="remove-logo-button"
                  disabled={logoDeleteMutation.isPending}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    borderRadius: "6px",
                    border: "1px solid var(--border-default)",
                    backgroundColor: "var(--bg-primary)",
                    color: "#EF4444",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <X size={12} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-logo-button"
              disabled={logoUploadMutation.isPending}
              style={{
                padding: "24px",
                width: "100%",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "8px",
                border: "2px dashed var(--border-default)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Upload size={20} style={{ color: "var(--text-muted)" }} />
              <span>{logoUploadMutation.isPending ? "Uploading..." : "Click to upload logo"}</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>PNG, JPG, or SVG</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={handleFileChange}
            data-testid="logo-file-input"
            style={{ display: "none" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <ColorField
            label="Primary Color"
            value={primaryColor}
            onChange={setPrimaryColor}
            placeholder="#1a3a2a"
            testId="primary-color"
          />
          <ColorField
            label="Secondary Accent Color"
            value={secondaryColor}
            onChange={setSecondaryColor}
            placeholder="#10B981"
            testId="secondary-color"
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="save-changes-button"
          style={{
            padding: "8px 20px",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "6px",
            border: "none",
            backgroundColor: "var(--brand-primary)",
            color: "white",
            cursor: saveMutation.isPending ? "not-allowed" : "pointer",
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            color: "white",
            backgroundColor: toast.type === "success" ? "#10B981" : "#EF4444",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 9999,
            animation: "slideIn 200ms ease",
          }}
          data-testid="toast-message"
        >
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function InfoField({ label, value, testId }: { label: string; value: string | null; testId: string }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "4px" }}>
        {label}
      </div>
      <div
        style={{ fontSize: "14px", color: value ? "var(--text-primary)" : "var(--text-muted)" }}
        data-testid={testId}
      >
        {value || "Not set"}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  testId: string;
}) {
  const displayColor = value || placeholder;
  const isValidHex = /^#[0-9A-Fa-f]{3,8}$/.test(displayColor);

  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "8px" }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          data-testid={`${testId}-swatch`}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            border: "1px solid var(--border-default)",
            backgroundColor: isValidHex ? displayColor : "#ccc",
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={`${testId}-input`}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: "13px",
            borderRadius: "6px",
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}
