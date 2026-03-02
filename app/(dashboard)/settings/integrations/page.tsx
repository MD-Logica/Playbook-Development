import { Plug } from "lucide-react";

export default function IntegrationsPage() {
  return <ComingSoon icon={Plug} title="Integrations" />;
}

function ComingSoon({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "400px" }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "var(--bg-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Icon size={22} style={{ color: "var(--text-muted)" }} strokeWidth={1.6} />
        </div>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
          {title}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          This section is on its way.
        </p>
      </div>
    </div>
  );
}
