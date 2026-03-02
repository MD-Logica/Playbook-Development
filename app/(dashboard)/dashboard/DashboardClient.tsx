"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useCountUp } from "@/hooks/useCountUp";

interface KpiData {
  todayTotal: number;
  todayConfirmed: number;
  todayPending: number;
  todayHold: number;
  rottingLeads: number;
}

interface TodayAppointment {
  id: string;
  startTime: string;
  appointmentCategory: string;
  status: string;
  patient: { firstName: string; lastName: string };
  provider: { firstName: string; lastName: string };
}

interface RottingLead {
  id: string;
  lastActivityAt: string;
  patient: { firstName: string; lastName: string };
  stage: { name: string };
  assignedTo: { firstName: string } | null;
}

interface PendingQuote {
  id: string;
  status: string;
  total: string;
  sentAt: string | null;
  quoteNumber: string | null;
  expirationDate: string | null;
  patient: { firstName: string; lastName: string };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function Skeleton({ w, h }: { w: string; h: string }) {
  return (
    <span
      className="animate-pulse rounded"
      style={{
        display: "inline-block",
        width: w,
        height: h,
        backgroundColor: "var(--bg-tertiary)",
      }}
    />
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { time: `${h}:${m.toString().padStart(2, "0")}`, ampm };
}

function typeBadgeStyle(type: string) {
  const map: Record<string, { bg: string; color: string }> = {
    CONSULT: { bg: "var(--brand-light)", color: "var(--brand-secondary)" },
    TREATMENT: { bg: "#EFF6FF", color: "#3B82F6" },
    SURGERY: { bg: "#F5F3FF", color: "#7C3AED" },
    FOLLOW_UP: { bg: "var(--bg-tertiary)", color: "var(--text-muted)" },
    POST_OP: { bg: "#FFF7ED", color: "#EA580C" },
  };
  return map[type] || { bg: "var(--bg-tertiary)", color: "var(--text-muted)" };
}

function statusChip(status: string) {
  const map: Record<string, { color: string; label: string; isPending?: boolean }> = {
    CONFIRMED: { color: "var(--success)", label: "Confirmed" },
    PENDING: { color: "var(--warning)", label: "Pending", isPending: true },
    COMPLETED: { color: "var(--text-subtle)", label: "Completed" },
    CANCELLED: { color: "var(--danger)", label: "Cancelled" },
    NO_SHOW: { color: "var(--danger)", label: "No Show" },
    HOLD: { color: "var(--info)", label: "Hold" },
  };
  return map[status] || { color: "var(--text-subtle)", label: status };
}

function providerDisplay(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName.charAt(0)}.`;
}

function daysAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function sentAgoText(dateStr: string | null) {
  if (!dateStr) return "Not sent";
  const days = daysAgo(dateStr);
  if (days === 0) return "Sent today";
  if (days === 1) return "Sent 1 day ago";
  return `Sent ${days} days ago`;
}

export default function DashboardClient({
  firstName,
}: {
  firstName: string;
}) {
  const [greeting, setGreeting] = useState("Good morning");
  const [dateStr, setDateStr] = useState("");
  const [shortDate, setShortDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
    setDateStr(now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }));
    setShortDate(now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }));
  }, []);

  const kpis = useQuery<KpiData>({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => fetchJson("/api/dashboard/kpis"),
  });

  const appointments = useQuery<TodayAppointment[]>({
    queryKey: ["dashboard", "today-appointments"],
    queryFn: () => fetchJson("/api/dashboard/today-appointments"),
  });

  const leads = useQuery<RottingLead[]>({
    queryKey: ["dashboard", "rotting-leads"],
    queryFn: () => fetchJson("/api/dashboard/rotting-leads"),
  });

  const quotes = useQuery<PendingQuote[]>({
    queryKey: ["dashboard", "pending-quotes"],
    queryFn: () => fetchJson("/api/dashboard/pending-quotes"),
  });

  const kpiData = kpis.data;
  const todayTotal = kpiData?.todayTotal ?? 0;
  const todayConfirmed = kpiData?.todayConfirmed ?? 0;
  const needsAttention = kpiData ? kpiData.todayPending + kpiData.todayHold : 0;
  const rottingLeads = kpiData?.rottingLeads ?? 0;

  const count1 = useCountUp(kpis.isLoading ? 0 : todayTotal, 600, 0);
  const count2 = useCountUp(kpis.isLoading ? 0 : todayConfirmed, 600, 80);
  const count3 = useCountUp(kpis.isLoading ? 0 : needsAttention, 600, 160);
  const count4 = useCountUp(kpis.isLoading ? 0 : rottingLeads, 600, 240);

  return (
    <div>
      <div
        style={{
          marginBottom: "24px",
          animation: "fadeUp 280ms ease-out 0ms both",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
          }}
        >
          {greeting}, {firstName}.
        </h2>
        <p
          style={{
            marginTop: "4px",
            fontSize: "14px",
            color: "var(--text-muted)",
          }}
        >
          {dateStr}
        </p>
      </div>

      <div className="grid grid-cols-4" style={{ gap: "16px", marginBottom: "24px" }}>
        {/* Card 1 — Today's Appointments (neutral/emerald) */}
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderLeft: "3px solid #10B981",
            borderRadius: "10px",
            padding: "18px 20px",
            cursor: "default",
            animation: "fadeUp 280ms ease-out 60ms both",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                TODAY&apos;S APPOINTMENTS
              </p>
              {kpis.isLoading ? (
                <Skeleton w="48px" h="36px" />
              ) : (
                <p
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}
                >
                  {todayTotal === 0 ? "—" : count1}
                </p>
              )}
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                }}
              >
                {kpis.isLoading ? (
                  <Skeleton w="100px" h="14px" />
                ) : todayTotal === 0 ? (
                  "No appointments today"
                ) : (
                  `${kpiData!.todayConfirmed} confirmed · ${kpiData!.todayPending} pending`
                )}
              </p>
            </div>
            <div
              className="flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                backgroundColor: "#D1FAE5",
              }}
            >
              <CalendarDays size={16} style={{ color: "#059669" }} strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Card 2 — Confirmed Today (positive/emerald) */}
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderLeft: "3px solid #10B981",
            borderRadius: "10px",
            padding: "18px 20px",
            cursor: "default",
            animation: "fadeUp 280ms ease-out 110ms both",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                CONFIRMED TODAY
              </p>
              {kpis.isLoading ? (
                <Skeleton w="48px" h="36px" />
              ) : (
                <p
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}
                >
                  {todayConfirmed === 0 ? "—" : count2}
                </p>
              )}
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                }}
              >
                {kpis.isLoading ? (
                  <Skeleton w="100px" h="14px" />
                ) : todayConfirmed === 0 ? (
                  "Nothing to confirm yet"
                ) : (
                  "On schedule"
                )}
              </p>
            </div>
            <div
              className="flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                backgroundColor: "#D1FAE5",
              }}
            >
              <CheckCircle2 size={16} style={{ color: "#10B981" }} strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Card 3 — Needs Attention (warning — zero is GOOD) */}
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderLeft: "3px solid #F59E0B",
            borderRadius: "10px",
            padding: "18px 20px",
            cursor: "default",
            animation: "fadeUp 280ms ease-out 160ms both",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                NEEDS ATTENTION
              </p>
              {kpis.isLoading ? (
                <Skeleton w="48px" h="36px" />
              ) : (
                <p
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}
                >
                  {count3}
                </p>
              )}
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                }}
              >
                {kpis.isLoading ? (
                  <Skeleton w="100px" h="14px" />
                ) : needsAttention === 0 ? (
                  "All clear ✓"
                ) : (
                  `${kpiData!.todayPending} unconfirmed · ${kpiData!.todayHold} on hold`
                )}
              </p>
            </div>
            <div
              className="flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                backgroundColor: "#FEF3C7",
              }}
            >
              <AlertCircle size={16} style={{ color: "#D97706" }} strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Card 4 — Pipeline Alerts (dynamic red/emerald) */}
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderLeft: `3px solid ${rottingLeads > 0 ? "#EF4444" : "#10B981"}`,
            borderRadius: "10px",
            padding: "18px 20px",
            cursor: "default",
            animation: "fadeUp 280ms ease-out 210ms both",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                PIPELINE ALERTS
              </p>
              {kpis.isLoading ? (
                <Skeleton w="48px" h="36px" />
              ) : (
                <p
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}
                >
                  {count4}
                </p>
              )}
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                }}
              >
                {kpis.isLoading ? (
                  <Skeleton w="100px" h="14px" />
                ) : rottingLeads > 0 ? (
                  `${rottingLeads} deals needing follow-up`
                ) : (
                  "Pipeline is healthy"
                )}
              </p>
            </div>
            <div
              className="flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                backgroundColor: rottingLeads > 0 ? "#FEE2E2" : "#D1FAE5",
              }}
            >
              {rottingLeads > 0 ? (
                <TrendingDown size={16} style={{ color: "#EF4444" }} strokeWidth={2} />
              ) : (
                <TrendingUp size={16} style={{ color: "#10B981" }} strokeWidth={2} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "3fr 2fr",
          gap: "16px",
        }}
      >
        {/* Left column — Today's Schedule */}
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "10px",
            overflow: "hidden",
            animation: "fadeUp 280ms ease-out 270ms both",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <span
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Today&apos;s Schedule
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-tertiary)",
                padding: "2px 10px",
                borderRadius: "10px",
              }}
            >
              {shortDate}
            </span>
          </div>

          {appointments.isLoading ? (
            <div style={{ padding: "16px" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center"
                  style={{
                    gap: "12px",
                    padding: "12px 0",
                    borderBottom:
                      i < 3 ? "1px solid var(--border-default)" : "none",
                  }}
                >
                  <Skeleton w="56px" h="16px" />
                  <Skeleton w="120px" h="16px" />
                  <Skeleton w="60px" h="20px" />
                  <Skeleton w="72px" h="14px" />
                  <Skeleton w="72px" h="14px" />
                </div>
              ))}
            </div>
          ) : !appointments.data?.length ? (
            <div
              className="flex flex-col items-center justify-center"
              style={{ padding: "48px 16px" }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "var(--bg-tertiary)",
                  marginBottom: "12px",
                }}
              >
                <CalendarDays
                  size={22}
                  style={{ color: "var(--text-subtle)" }}
                />
              </div>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                Nothing scheduled today.
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                Enjoy the quiet.
              </p>
            </div>
          ) : (
            <div>
              {appointments.data.map((apt, idx) => {
                const { time, ampm } = formatTime(apt.startTime);
                const badge = typeBadgeStyle(apt.appointmentCategory);
                const chip = statusChip(apt.status);
                const isLast = idx === appointments.data!.length - 1;

                return (
                  <div
                    key={apt.id}
                    className="flex items-center"
                    style={{
                      height: "52px",
                      padding: "0 16px",
                      borderBottom: isLast
                        ? "none"
                        : "1px solid var(--border-default)",
                      transition: "background-color 150ms ease",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--bg-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        flexShrink: 0,
                        fontFamily:
                          "var(--font-geist-mono, 'Geist Mono', monospace)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {time}
                      </span>{" "}
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {ampm}
                      </span>
                    </div>

                    <div
                      className="min-w-0 flex-1"
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {apt.patient.firstName} {apt.patient.lastName}
                    </div>

                    <div style={{ marginRight: "16px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {apt.appointmentCategory.replace("_", " ")}
                      </span>
                    </div>

                    <div
                      style={{
                        width: "80px",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {providerDisplay(apt.provider)}
                    </div>

                    <div
                      className="flex items-center"
                      style={{
                        gap: "5px",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className={chip.isPending ? "status-dot-pending" : ""}
                        style={{
                          display: "inline-block",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: chip.isPending ? undefined : chip.color,
                        }}
                      />
                      {chip.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column — Alerts + Quotes */}
        <div
          className="flex flex-col"
          style={{
            gap: "16px",
            animation: "fadeUp 280ms ease-out 310ms both",
          }}
        >
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
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Deals Needing Follow-Up
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                No activity in 7+ days
              </p>
            </div>

            {leads.isLoading ? (
              <div style={{ padding: "12px 16px" }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 0",
                      borderBottom:
                        i < 3 ? "1px solid var(--border-default)" : "none",
                    }}
                  >
                    <Skeleton w="140px" h="14px" />
                    <div style={{ marginTop: "4px" }}>
                      <Skeleton w="100px" h="12px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !leads.data?.length ? (
              <div
                className="flex items-center justify-center"
                style={{
                  padding: "32px 16px",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    color: "var(--success)",
                    fontSize: "14px",
                  }}
                >
                  ✓
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                  }}
                >
                  Pipeline is healthy. No stalled deals.
                </span>
              </div>
            ) : (
              <div>
                {leads.data.map((lead, idx) => {
                  const days = daysAgo(lead.lastActivityAt);
                  const isDanger = days >= 14;
                  const isLast = idx === leads.data!.length - 1;

                  return (
                    <div
                      key={lead.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: isLast
                          ? "none"
                          : "1px solid var(--border-default)",
                        transition: "background-color 150ms ease",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--bg-secondary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {lead.patient.firstName} {lead.patient.lastName}
                        </span>
                        <span
                          className={isDanger ? "shake-on-hover" : ""}
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            fontFamily:
                              "var(--font-geist-mono, 'Geist Mono', monospace)",
                            color: isDanger
                              ? "var(--danger)"
                              : "var(--warning)",
                          }}
                        >
                          {isDanger ? "🔥 " : ""}
                          {days}d ago
                        </span>
                      </div>
                      <div className="flex items-center justify-between" style={{ marginTop: "2px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {lead.stage.name}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-subtle)",
                          }}
                        >
                          {lead.assignedTo?.firstName || "Unassigned"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Quotes Awaiting Response
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                Sent but not yet accepted
              </p>
            </div>

            {quotes.isLoading ? (
              <div style={{ padding: "12px 16px" }}>
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 0",
                      borderBottom:
                        i < 2 ? "1px solid var(--border-default)" : "none",
                    }}
                  >
                    <Skeleton w="140px" h="14px" />
                    <div style={{ marginTop: "4px" }}>
                      <Skeleton w="100px" h="12px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !quotes.data?.length ? (
              <div
                className="flex items-center justify-center"
                style={{ padding: "32px 16px" }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                  }}
                >
                  No quotes pending. Time to send some.
                </span>
              </div>
            ) : (
              <div>
                {quotes.data.map((quote, idx) => {
                  const isLast = idx === quotes.data!.length - 1;
                  const hasDueDate = !!quote.expirationDate;

                  return (
                    <div
                      key={quote.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: isLast
                          ? "none"
                          : "1px solid var(--border-default)",
                        transition: "background-color 150ms ease",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--bg-secondary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {quote.patient.firstName} {quote.patient.lastName}
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {formatCurrency(quote.total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between" style={{ marginTop: "2px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {sentAgoText(quote.sentAt)}
                        </span>
                        <span
                          className="flex items-center"
                          style={{
                            gap: "4px",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: hasDueDate
                              ? "var(--text-subtle)"
                              : "var(--text-muted)",
                          }}
                        >
                          {hasDueDate
                            ? `Expires ${new Date(quote.expirationDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                            : "No expiration"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
