"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Save } from "lucide-react";

export default function TaxSettingsPage() {
  const queryClient = useQueryClient();
  const [taxRate, setTaxRate] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { data, isLoading } = useQuery<{ defaultTaxRate: number | null }>({
    queryKey: ["/api/settings/tax"],
    queryFn: async () => {
      const res = await fetch("/api/settings/tax");
      if (!res.ok) throw new Error("Failed to fetch tax settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setTaxRate(data.defaultTaxRate !== null ? String(data.defaultTaxRate) : "");
    }
  }, [data]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const saveMutation = useMutation({
    mutationFn: async (rate: string) => {
      const res = await fetch("/api/settings/tax", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultTaxRate: rate === "" ? null : parseFloat(rate),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save tax settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tax"] });
      setIsDirty(false);
      setToast({ message: "Tax settings saved successfully", type: "success" });
    },
    onError: (error: Error) => {
      setToast({ message: error.message, type: "error" });
    },
  });

  const handleSave = () => {
    if (taxRate !== "" && (isNaN(parseFloat(taxRate)) || parseFloat(taxRate) < 0 || parseFloat(taxRate) > 100)) {
      setToast({ message: "Tax rate must be a number between 0 and 100", type: "error" });
      return;
    }
    saveMutation.mutate(taxRate);
  };

  const handleChange = (value: string) => {
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setTaxRate(value);
      setIsDirty(true);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading tax settings...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", gap: "12px" }}>
        <div>
          <h1 data-testid="text-settings-title" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            Tax Settings
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Configure the default tax rate applied to quotes and invoices.
          </p>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "8px",
          border: "1px solid var(--border-default)",
          padding: "24px",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="tax-rate"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: "6px",
            }}
          >
            Default Tax Rate
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "200px" }}>
            <input
              data-testid="input-tax-rate"
              id="tax-rate"
              type="text"
              inputMode="decimal"
              value={taxRate}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                borderRadius: "6px",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isDirty) handleSave();
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", flexShrink: 0 }}>%</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", lineHeight: 1.5 }}>
            This rate will be used as the default when creating new quotes and invoices. You can override it on individual items.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button
            data-testid="button-save-tax"
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isPending}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: !isDirty || saveMutation.isPending ? "var(--text-muted)" : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: !isDirty || saveMutation.isPending ? "not-allowed" : "pointer",
              opacity: !isDirty || saveMutation.isPending ? 0.6 : 1,
              transition: "all 150ms ease",
            }}
          >
            <Save size={14} strokeWidth={2} />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {toast && (
        <div
          data-testid={`toast-${toast.type}`}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: toast.type === "success" ? "#10B981" : "#EF4444",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 200,
            animation: "fadeIn 200ms ease",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
