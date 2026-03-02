"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CalendarDays,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";

const navSections = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    items: [
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Pipeline", href: "/pipeline", icon: Kanban },
      { label: "Appointments", href: "/appointments", icon: CalendarDays },
    ],
  },
  {
    items: [
      { label: "Quotes", href: "/quotes", icon: FileText },
      { label: "Invoices", href: "/invoices", icon: Receipt },
    ],
  },
  {
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function LogoIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="1" />
          <stop offset="100%" stopColor="#064E3B" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="5" y="30" width="32" height="18" fill="url(#logoGrad)" opacity="0.4" rx="3"/>
      <rect x="13" y="22" width="32" height="18" fill="url(#logoGrad)" opacity="0.7" rx="3"/>
      <rect x="21" y="14" width="32" height="18" fill="url(#logoGrad)" rx="3"/>
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [practiceName, setPracticeName] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/practice")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.name) setPracticeName(data.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!newMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [newMenuOpen]);

  const handleNewMenuAction = useCallback(
    (action: string) => {
      setNewMenuOpen(false);
      if (action === "deal") {
        router.push("/pipeline?addDeal=true");
      } else if (action === "quote") {
        router.push("/quotes/builder");
      }
    },
    [router]
  );

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "";

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] || ""}`
    : displayName?.[0] || "?";

  return (
    <aside
      className="flex h-screen w-[240px] flex-shrink-0 flex-col"
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      <div
        className="flex items-center gap-[10px] px-4"
        style={{
          height: "56px",
          borderBottom: "1px solid var(--sidebar-divider)",
        }}
      >
        <Link href="/dashboard" className="flex items-center gap-[10px]">
          <LogoIcon />
          <span
            style={{
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "-0.2px",
            }}
          >
            Playbook<span style={{ color: '#10B981' }}>MD</span>
          </span>
        </Link>
      </div>

      <div ref={newMenuRef} style={{ position: "relative", padding: "8px 8px 0" }}>
        <button
          data-testid="button-new-menu"
          onClick={() => setNewMenuOpen((v) => !v)}
          className="flex items-center justify-center gap-1.5 transition-colors duration-150"
          style={{
            width: "100%",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            color: "#10B981",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
          New
        </button>

        {newMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: "8px",
              right: "8px",
              minWidth: "220px",
              backgroundColor: "var(--sidebar-bg)",
              border: "1px solid var(--sidebar-divider)",
              borderRadius: "8px",
              padding: "6px",
              zIndex: 50,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              animation: "sidebarDropdownIn 150ms ease-out both",
            }}
          >
            <style>{`@keyframes sidebarDropdownIn { from { opacity: 0; transform: scale(0.96) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
            <button
              data-testid="menu-item-new-deal"
              onClick={() => handleNewMenuAction("deal")}
              className="flex items-center gap-2 transition-colors duration-150"
              style={{
                width: "100%",
                height: "32px",
                borderRadius: "5px",
                padding: "0 10px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--sidebar-text)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Kanban size={14} style={{ color: "var(--sidebar-icon-default)", flexShrink: 0 }} />
              New Deal
            </button>
            <button
              data-testid="menu-item-new-quote"
              onClick={() => handleNewMenuAction("quote")}
              className="flex items-center gap-2 transition-colors duration-150"
              style={{
                width: "100%",
                height: "32px",
                borderRadius: "5px",
                padding: "0 10px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--sidebar-text)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <FileText size={14} style={{ color: "var(--sidebar-icon-default)", flexShrink: 0 }} />
              New Quote
            </button>
            <button
              data-testid="menu-item-new-invoice"
              disabled
              className="flex items-center gap-2"
              style={{
                width: "100%",
                height: "32px",
                borderRadius: "5px",
                padding: "0 10px",
                border: "none",
                backgroundColor: "transparent",
                color: "rgba(255,255,255,0.3)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "not-allowed",
                textAlign: "left",
              }}
            >
              <Receipt size={14} style={{ flexShrink: 0, opacity: 0.4 }} />
              <span className="flex-1">New Invoice</span>
              <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "9px", lineHeight: "16px" }}>Soon</span>
            </button>
            <button
              data-testid="menu-item-book-appointment"
              disabled
              className="flex items-center gap-2"
              style={{
                width: "100%",
                height: "32px",
                borderRadius: "5px",
                padding: "0 10px",
                border: "none",
                backgroundColor: "transparent",
                color: "rgba(255,255,255,0.3)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "not-allowed",
                textAlign: "left",
              }}
            >
              <CalendarDays size={14} style={{ flexShrink: 0, opacity: 0.4 }} />
              <span className="flex-1">Book Appointment</span>
              <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "9px", lineHeight: "16px" }}>Soon</span>
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            {sIdx > 0 && (
              <div
                style={{
                  height: "1px",
                  backgroundColor: "var(--sidebar-divider)",
                  margin: "6px 16px",
                }}
              />
            )}
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center transition-colors duration-150"
                  style={{
                    height: "34px",
                    borderRadius: "6px",
                    padding: "0 10px",
                    margin: "1px 8px",
                    gap: "9px",
                    backgroundColor: active
                      ? "var(--sidebar-item-active)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      e.currentTarget.style.backgroundColor =
                        "var(--sidebar-item-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Icon
                    size={15}
                    style={{
                      color: active
                        ? "var(--sidebar-icon-active)"
                        : "var(--sidebar-icon-default)",
                      flexShrink: 0,
                    }}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: active
                        ? "var(--sidebar-text-active)"
                        : "var(--sidebar-text)",
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--sidebar-divider)",
          padding: "12px 16px",
        }}
      >
        {practiceName && (
          <div
            className="mb-2 truncate"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {practiceName}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div
            className="flex flex-shrink-0 items-center justify-center rounded-full text-white"
            style={{
              width: "26px",
              height: "26px",
              fontSize: "11px",
              fontWeight: 500,
              backgroundColor: "#059669",
            }}
          >
            {initials.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {displayName}
            </div>
          </div>
          <SignOutButton>
            <button
              className="flex flex-shrink-0 items-center justify-center rounded-md transition-colors duration-150"
              style={{
                width: "28px",
                height: "28px",
                color: "rgba(255,255,255,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.3)";
              }}
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </SignOutButton>
        </div>
      </div>
    </aside>
  );
}
