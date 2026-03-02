"use client";

import { Clock } from "lucide-react";

export default function WorkingHoursPage() {
  return (
    <div data-testid="page-working-hours" style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 data-testid="text-page-title" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
          Working Hours
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Configure your practice's operating hours and provider availability.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 32px",
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          border: "1px solid var(--border-default)",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            backgroundColor: "var(--bg-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <Clock size={22} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
        </div>
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
          Coming Soon
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", maxWidth: "360px" }}>
          Set your practice's operating hours, break times, and provider-specific schedules. This feature will be available in a future update.
        </p>
      </div>
    </div>
  );
}
