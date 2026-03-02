import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-full"
          style={{
            width: "48px",
            height: "48px",
            backgroundColor: "var(--brand-light)",
          }}
        >
          <BarChart3 size={24} style={{ color: "var(--brand-primary)" }} strokeWidth={1.8} />
        </div>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Reports
        </h2>
        <p
          style={{
            marginTop: "8px",
            fontSize: "14px",
            color: "var(--text-muted)",
          }}
        >
          The numbers that run your business. Coming soon.
        </p>
      </div>
    </div>
  );
}
