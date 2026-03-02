"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Eye,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "CONVERTED" | "EXPIRED";

interface Quote {
  id: string;
  quoteNumber: string;
  title: string | null;
  status: QuoteStatus;
  total: number | string;
  subtotal: number | string;
  expirationDate: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string } | null;
  opportunity: { id: string; title: string } | null;
  coordinator: { id: string; firstName: string; lastName: string } | null;
}

interface KpiData {
  totalActiveQuotes: number;
  totalValueQuoted: number;
  acceptanceRate: number | null;
  expiringSoon: number;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
}

const STATUS_COLORS: Record<QuoteStatus, { bg: string; text: string }> = {
  DRAFT: { bg: "rgba(107,114,128,0.1)", text: "#6B7280" },
  SENT: { bg: "rgba(59,130,246,0.1)", text: "#3B82F6" },
  ACCEPTED: { bg: "rgba(16,185,129,0.1)", text: "#10B981" },
  DECLINED: { bg: "rgba(239,68,68,0.1)", text: "#EF4444" },
  CONVERTED: { bg: "rgba(16,185,129,0.15)", text: "#059669" },
  EXPIRED: { bg: "rgba(245,158,11,0.1)", text: "#F59E0B" },
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CONVERTED: "Converted",
  EXPIRED: "Expired",
};

const ALL_STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "CONVERTED", "EXPIRED"];

function formatCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "$0.00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "$0.00";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isPast(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  cursor: "pointer",
  userSelect: "none",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  color: "var(--text-secondary)",
  fontSize: "13px",
};

export default function QuotesPage() {
  const router = useRouter();

  const [selectedStatuses, setSelectedStatuses] = useState<QuoteStatus[]>([]);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const toggleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }, [sortBy]);

  const toggleStatus = useCallback((status: QuoteStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }, []);

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    selectedStatuses.forEach((s) => params.append("status", s));
    if (coordinatorId) params.set("coordinatorId", coordinatorId);
    if (searchText) params.set("search", searchText);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [selectedStatuses, coordinatorId, searchText, dateFrom, dateTo]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams(filterParams);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    return params.toString();
  }, [filterParams, sortBy, sortDir]);

  const { data: kpis, isLoading: kpisLoading, isFetching: kpisFetching } = useQuery<KpiData>({
    queryKey: ["/api/quotes/kpis", filterParams],
    queryFn: async () => {
      const kpiUrl = filterParams ? `/api/quotes/kpis?${filterParams}` : "/api/quotes/kpis";
      const res = await fetch(kpiUrl);
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    },
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/quotes?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<UserData[]>({
    queryKey: ["/api/settings/users"],
    queryFn: async () => {
      const res = await fetch("/api/settings/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return Array.isArray(data) ? data : data.users || [];
    },
  });

  const activeUsers = useMemo(() => (Array.isArray(users) ? users : []).filter((u: any) => u.isActive !== false), [users]);

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp size={12} style={{ marginLeft: 2, display: "inline" }} />
    ) : (
      <ChevronDown size={12} style={{ marginLeft: 2, display: "inline" }} />
    );
  };

  const hasFilters = selectedStatuses.length > 0 || coordinatorId || searchText || dateFrom || dateTo;

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1200px", margin: "0 auto" }}>
      <style>{`@keyframes kpiPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "24px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}
            data-testid="page-title"
          >
            Quotes
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.5 }}>
            Manage proposals and close deals
          </p>
        </div>
        <button
          onClick={() => router.push("/quotes/builder")}
          data-testid="new-quote-button"
          style={{
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "6px",
            border: "none",
            backgroundColor: "var(--brand-primary)",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Plus size={14} />
          New Quote
        </button>
      </div>

      {/* KPI STRIP */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
        data-testid="kpi-strip"
      >
        <KpiCard
          label="Total Active Quotes"
          value={kpisLoading ? "—" : String(kpis?.totalActiveQuotes ?? 0)}
          icon={<FileText size={18} />}
          accentColor="#3B82F6"
          testId="kpi-active-quotes"
          loading={kpisLoading}
          refetching={kpisFetching && !kpisLoading}
        />
        <KpiCard
          label="Total Value Quoted"
          value={kpisLoading ? "—" : formatCurrency(kpis?.totalValueQuoted ?? 0)}
          icon={<DollarSign size={18} />}
          accentColor="#10B981"
          testId="kpi-total-value"
          loading={kpisLoading}
          refetching={kpisFetching && !kpisLoading}
        />
        <KpiCard
          label="Acceptance Rate"
          value={kpisLoading ? "—" : kpis?.acceptanceRate !== null && kpis?.acceptanceRate !== undefined ? `${kpis.acceptanceRate}%` : "—"}
          icon={<TrendingUp size={18} />}
          accentColor="#F59E0B"
          testId="kpi-acceptance-rate"
          loading={kpisLoading}
          refetching={kpisFetching && !kpisLoading}
        />
        <KpiCard
          label="Expiring Soon"
          value={kpisLoading ? "—" : String(kpis?.expiringSoon ?? 0)}
          icon={<AlertTriangle size={18} />}
          accentColor={(kpis?.expiringSoon ?? 0) > 0 ? "#EF4444" : "#6B7280"}
          testId="kpi-expiring-soon"
          loading={kpisLoading}
          refetching={kpisFetching && !kpisLoading}
        />
      </div>

      {/* FILTER BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
        data-testid="filter-bar"
      >
        {/* Status multi-select */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setStatusDropdownOpen((v) => !v)}
            data-testid="filter-status-toggle"
            style={{
              padding: "7px 12px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              color: selectedStatuses.length > 0 ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              minWidth: "140px",
            }}
          >
            {selectedStatuses.length > 0
              ? `Status (${selectedStatuses.length})`
              : "All Statuses"}
            <ChevronDown size={12} style={{ marginLeft: "auto" }} />
          </button>
          {statusDropdownOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 99 }}
                onClick={() => setStatusDropdownOpen(false)}
              />
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "4px",
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 100,
                  minWidth: "180px",
                  padding: "4px 0",
                }}
                data-testid="filter-status-dropdown"
              >
                {ALL_STATUSES.map((status) => (
                  <label
                    key={status}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: "var(--text-primary)",
                    }}
                    data-testid={`filter-status-option-${status}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                      style={{ accentColor: "var(--brand-primary)" }}
                    />
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: STATUS_COLORS[status].text,
                        flexShrink: 0,
                      }}
                    />
                    {STATUS_LABELS[status]}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Coordinator filter */}
        <select
          value={coordinatorId}
          onChange={(e) => setCoordinatorId(e.target.value)}
          data-testid="filter-coordinator"
          style={{
            padding: "7px 12px",
            fontSize: "13px",
            borderRadius: "6px",
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-primary)",
            color: coordinatorId ? "var(--text-primary)" : "var(--text-muted)",
            cursor: "pointer",
            minWidth: "140px",
          }}
        >
          <option value="">All Coordinators</option>
          {activeUsers.map((u: UserData) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>

        {/* Patient search */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "10px",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search patient..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            data-testid="filter-search"
            style={{
              padding: "7px 12px 7px 30px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              width: "180px",
              outline: "none",
            }}
          />
        </div>

        {/* Date from */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          data-testid="filter-date-from"
          style={{
            padding: "7px 12px",
            fontSize: "13px",
            borderRadius: "6px",
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-primary)",
            color: dateFrom ? "var(--text-primary)" : "var(--text-muted)",
          }}
        />
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          data-testid="filter-date-to"
          style={{
            padding: "7px 12px",
            fontSize: "13px",
            borderRadius: "6px",
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-primary)",
            color: dateTo ? "var(--text-primary)" : "var(--text-muted)",
          }}
        />

        {hasFilters && (
          <button
            onClick={() => {
              setSelectedStatuses([]);
              setCoordinatorId("");
              setSearchText("");
              setDateFrom("");
              setDateTo("");
            }}
            data-testid="filter-clear"
            style={{
              padding: "7px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* TABLE / CONTENT */}
      {quotesLoading ? (
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-default)",
            overflow: "hidden",
          }}
          data-testid="loading-skeleton"
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                {["Quote #", "Patient", "Deal", "Coordinator", "Status", "Total", "Expires", "Created", ""].map(
                  (h, i) => (
                    <th key={i} style={thStyle}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: "14px",
                          borderRadius: "4px",
                          backgroundColor: "var(--border-default)",
                          width: j === 8 ? "30px" : `${60 + Math.random() * 40}%`,
                          animation: "pulse 1.5s ease-in-out infinite",
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
      ) : quotes.length === 0 ? (
        <div
          style={{
            padding: "60px 40px",
            textAlign: "center",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-default)",
          }}
          data-testid="empty-state"
        >
          <FileText
            size={40}
            strokeWidth={1.2}
            style={{ color: "var(--text-muted)", margin: "0 auto 16px" }}
          />
          <h3
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 8px",
            }}
          >
            No quotes yet
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              margin: "0 0 24px",
              maxWidth: "400px",
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.5,
            }}
          >
            Create your first quote to start managing proposals and closing deals with patients.
          </p>
          <button
            onClick={() => router.push("/quotes/builder")}
            data-testid="empty-new-quote"
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--brand-primary)",
              color: "white",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={14} />
            New Quote
          </button>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-default)",
            overflow: "hidden",
          }}
          data-testid="quotes-table"
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                <th
                  style={thStyle}
                  onClick={() => toggleSort("quoteNumber")}
                  data-testid="sort-quoteNumber"
                >
                  Quote # <SortIcon field="quoteNumber" />
                </th>
                <th style={{ ...thStyle, cursor: "default" }}>Patient</th>
                <th style={{ ...thStyle, cursor: "default" }}>Deal</th>
                <th style={{ ...thStyle, cursor: "default" }}>Coordinator</th>
                <th
                  style={thStyle}
                  onClick={() => toggleSort("status")}
                  data-testid="sort-status"
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  style={{ ...thStyle, textAlign: "right" }}
                  onClick={() => toggleSort("total")}
                  data-testid="sort-total"
                >
                  Total <SortIcon field="total" />
                </th>
                <th
                  style={thStyle}
                  onClick={() => toggleSort("expirationDate")}
                  data-testid="sort-expirationDate"
                >
                  Expires <SortIcon field="expirationDate" />
                </th>
                <th
                  style={thStyle}
                  onClick={() => toggleSort("createdAt")}
                  data-testid="sort-createdAt"
                >
                  Created <SortIcon field="createdAt" />
                </th>
                <th style={{ ...thStyle, textAlign: "right", cursor: "default" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const expired = isPast(quote.expirationDate);
                return (
                  <tr
                    key={quote.id}
                    data-testid={`quote-row-${quote.id}`}
                    style={{ borderBottom: "1px solid var(--border-default)" }}
                  >
                    <td style={tdStyle}>
                      <span
                        onClick={() => router.push(`/quotes/builder?quoteId=${quote.id}`)}
                        data-testid={`quote-number-${quote.id}`}
                        style={{
                          fontWeight: 600,
                          color: "var(--brand-primary)",
                          cursor: "pointer",
                        }}
                      >
                        {quote.quoteNumber}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {quote.patient ? (
                        <span
                          onClick={() => router.push(`/patients/${quote.patient!.id}`)}
                          data-testid={`quote-patient-${quote.id}`}
                          style={{ color: "var(--text-primary)", cursor: "pointer" }}
                        >
                          {quote.patient.firstName} {quote.patient.lastName}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {quote.opportunity ? (
                        <span
                          onClick={() => router.push("/pipeline")}
                          data-testid={`quote-deal-${quote.id}`}
                          style={{ color: "var(--text-primary)", cursor: "pointer" }}
                        >
                          {quote.opportunity.title}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle} data-testid={`quote-coordinator-${quote.id}`}>
                      {quote.coordinator
                        ? `${quote.coordinator.firstName} ${quote.coordinator.lastName}`
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      <span
                        data-testid={`quote-status-${quote.id}`}
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 500,
                          backgroundColor: STATUS_COLORS[quote.status]?.bg,
                          color: STATUS_COLORS[quote.status]?.text,
                        }}
                      >
                        {STATUS_LABELS[quote.status] || quote.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }} data-testid={`quote-total-${quote.id}`}>
                      {formatCurrency(quote.total)}
                    </td>
                    <td style={tdStyle} data-testid={`quote-expiration-${quote.id}`}>
                      {expired && quote.expirationDate ? (
                        <span style={{ color: "#EF4444", fontWeight: 500 }}>Expired</span>
                      ) : (
                        formatDate(quote.expirationDate)
                      )}
                    </td>
                    <td style={tdStyle} data-testid={`quote-created-${quote.id}`}>
                      {formatDate(quote.createdAt)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => router.push(`/quotes/builder?quoteId=${quote.id}`)}
                        data-testid={`quote-view-${quote.id}`}
                        title="View quote"
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor: "transparent",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-secondary)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                        }}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accentColor,
  testId,
  loading,
  refetching = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
  testId: string;
  loading: boolean;
  refetching?: boolean;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        transition: "opacity 0.2s ease",
        ...(refetching ? { animation: "kpiPulse 1.5s ease-in-out infinite" } : {}),
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          backgroundColor: `${accentColor}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accentColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        {loading ? (
          <div
            style={{
              height: "22px",
              width: "60px",
              borderRadius: "4px",
              backgroundColor: "var(--border-default)",
              marginBottom: "4px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ) : (
          <div
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
            data-testid={`${testId}-value`}
          >
            {value}
          </div>
        )}
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "2px",
          }}
          data-testid={`${testId}-label`}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
