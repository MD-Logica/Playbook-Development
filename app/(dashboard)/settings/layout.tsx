"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Tag, Zap, Users, Plug, GitBranch, Building2, ChevronDown, ChevronRight, ListTree, Syringe, Megaphone, UserCircle, DollarSign, FolderTree, Package, Receipt, CalendarClock, Clock } from "lucide-react";

interface NavItem {
  label: string;
  href?: string;
  icon?: any;
  children?: NavItem[];
  adminOnly?: boolean;
  comingSoon?: boolean;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Account", href: "/settings/account", icon: UserCircle },
  { label: "Practice", href: "/settings/practice", icon: Building2 },
  {
    label: "Managed Lists",
    icon: ListTree,
    children: [
      { label: "Tags", href: "/settings/tags", icon: Tag },
      { label: "Lead Sources", href: "/settings/lead-sources", icon: Megaphone },
      { label: "Procedure Types", href: "/settings/procedure-types", icon: Syringe },
    ],
  },
  {
    label: "Finances",
    icon: DollarSign,
    children: [
      { label: "Income Categories", href: "/settings/income-categories", icon: FolderTree },
      { label: "Products & Services", href: "/settings/products-services", icon: Package },
      { label: "Tax Settings", href: "/settings/tax", icon: Receipt },
    ],
  },
  {
    label: "Appointments",
    icon: CalendarClock,
    children: [
      { label: "Appointment Types", href: "/settings/appointment-types", icon: CalendarClock },
      { label: "Working Hours", href: "/settings/working-hours", icon: Clock, comingSoon: true },
    ],
  },
  { label: "Pipeline", href: "/settings/pipeline", icon: GitBranch },
  { label: "Automation", href: "/settings/automation", icon: Zap },
  { label: "Users & Permissions", href: "/settings/users", icon: Users, adminOnly: true },
  { label: "Integrations", href: "/settings/integrations", icon: Plug },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["Managed Lists"]));
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/role")
      .then((r) => r.json())
      .then((d) => setUserRole(d.role))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pathname === "/settings") {
      router.replace("/settings/account");
    }
  }, [pathname, router]);

  const isActive = (href: string) => pathname === href;
  const isChildActive = (children?: NavItem[]) =>
    children?.some((c) => c.href && pathname === c.href);

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    for (const item of NAV_ITEMS) {
      if (item.children && isChildActive(item.children)) {
        setExpandedSections((prev) => new Set(prev).add(item.label));
      }
    }
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && userRole !== "ADMIN") return false;
    return true;
  });

  return (
    <div style={{ display: "flex", height: "100%", margin: "-28px -32px", overflow: "hidden" }}>
      <nav
        style={{
          width: "220px",
          flexShrink: 0,
          backgroundColor: "var(--bg-primary)",
          borderRight: "1px solid var(--border-default)",
          padding: "20px 0",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "0 16px 16px",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
          }}
        >
          Settings
        </div>

        {visibleItems.map((item) => {
          if (item.children) {
            const expanded = expandedSections.has(item.label) || isChildActive(item.children);
            const Icon = item.icon;
            return (
              <div key={item.label}>
                <button
                  data-testid={`settings-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => toggleSection(item.label)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {Icon && <Icon size={15} strokeWidth={1.8} />}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {expanded ? (
                    <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
                {expanded && (
                  <div style={{ paddingLeft: "12px" }}>
                    {item.children.map((child) => (
                      <SidebarItem key={child.label} item={child} active={isActive(child.href!)} />
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <SidebarItem key={item.label} item={item} active={isActive(item.href!)} />
          );
        })}
      </nav>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 32px",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const router = useRouter();
  const Icon = item.icon;
  const isDisabled = item.disabled;

  return (
    <button
      data-testid={`settings-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={() => !isDisabled && item.href && router.push(item.href)}
      disabled={isDisabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: active ? 600 : 400,
        color: isDisabled ? "var(--text-muted)" : active ? "var(--brand-primary)" : "var(--text-secondary)",
        backgroundColor: active ? "rgba(16, 185, 129, 0.08)" : "transparent",
        border: "none",
        borderRight: active ? "2px solid var(--brand-primary)" : "2px solid transparent",
        cursor: isDisabled ? "default" : "pointer",
        textAlign: "left",
        transition: "all 120ms ease",
        opacity: isDisabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active && !isDisabled) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
      }}
      onMouseLeave={(e) => {
        if (!active && !isDisabled) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {Icon && <Icon size={15} strokeWidth={1.8} />}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.comingSoon && (
        <span
          style={{
            fontSize: "9px",
            fontWeight: 500,
            color: "var(--text-muted)",
            backgroundColor: "var(--bg-tertiary)",
            padding: "1px 5px",
            borderRadius: "3px",
            whiteSpace: "nowrap",
          }}
        >
          Soon
        </span>
      )}
    </button>
  );
}
