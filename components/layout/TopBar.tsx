"use client";

import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Search, Bell } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/patients": "Patients",
  "/pipeline": "",
  "/appointments": "Appointments",
  "/quotes": "Quotes",
  "/invoices": "Invoices",
  "/reports": "Reports",
  "/settings": "Settings",
  "/pipeline/settings": "Pipeline Settings",
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  const title = pageTitles[pathname] ?? pageTitles[Object.keys(pageTitles).find((k) => pathname.startsWith(k)) ?? ""] ?? "Dashboard";
  const isPipeline = pathname === "/pipeline";

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] || ""}`
    : "?";

  return (
    <header
      className="flex flex-shrink-0 items-center"
      style={{
        height: "52px",
        padding: "0 24px",
        backgroundColor: "var(--topbar-bg)",
        borderBottom: "1px solid var(--topbar-border)",
        gap: "16px",
      }}
    >
      {!isPipeline && (
        <h1
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
            flexShrink: 0,
          }}
        >
          {title}
        </h1>
      )}

      {isPipeline && (
        <>
          <div
            style={{
              width: "1px",
              height: "16px",
              backgroundColor: "var(--border-default)",
              flexShrink: 0,
            }}
          />
          <div id="topbar-left-slot" className="flex items-center" style={{ flexShrink: 0 }} />
        </>
      )}

      <div className="flex items-center" style={{ flex: 1, justifyContent: "center" }}>
        <div
          className="flex items-center"
          style={{
            width: "220px",
            height: "32px",
            padding: "0 10px",
            gap: "8px",
            borderRadius: "16px",
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          <Search size={14} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: "13px",
              color: "var(--text-subtle)",
            }}
          >
            Search...
          </span>
        </div>
      </div>

      {isPipeline && (
        <div id="topbar-right-slot" className="flex items-center" style={{ gap: "8px", flexShrink: 0 }} />
      )}

      <button
        className="flex items-center justify-center rounded-full transition-colors duration-150"
        style={{ width: "32px", height: "32px", flexShrink: 0 }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <Bell size={16} style={{ color: "var(--text-muted)" }} strokeWidth={1.8} />
      </button>

      <button
        data-testid="button-user-avatar"
        onClick={() => router.push("/settings/account")}
        className="flex items-center justify-center rounded-full text-white transition-opacity duration-150"
        title="Account settings"
        style={{
          width: "28px",
          height: "28px",
          fontSize: "12px",
          fontWeight: 500,
          backgroundColor: "#059669",
          flexShrink: 0,
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        {initials.toUpperCase()}
      </button>
    </header>
  );
}
