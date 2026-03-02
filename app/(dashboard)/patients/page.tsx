"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  Search,
  Star,
  ChevronLeft,
  ChevronRight,
  Users,
  ArrowUpDown,
} from "lucide-react";

interface PatientNextAppointment {
  id: string;
  startTime: string;
  title: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  isVip: boolean;
  tags: string[];
  lifetimeValue: number;
  activeOpportunities: number;
  totalOpportunities: number;
  nextAppointment: PatientNextAppointment | null;
  createdAt: string;
}

interface PatientsResponse {
  patients: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_OPTIONS = ["ALL", "ACTIVE", "LEAD", "VIP", "INACTIVE", "FLAGGED"];

function getStatusBadgeStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: "20px",
    whiteSpace: "nowrap",
  };
  switch (status) {
    case "ACTIVE":
      return { ...base, backgroundColor: "#D1FAE5", color: "#065F46" };
    case "LEAD":
      return { ...base, backgroundColor: "#DBEAFE", color: "#1E40AF" };
    case "VIP":
      return { ...base, backgroundColor: "#A7F3D0", color: "#064E3B" };
    case "INACTIVE":
      return { ...base, backgroundColor: "#F3F4F6", color: "#6B7280" };
    case "FLAGGED":
      return { ...base, backgroundColor: "#FEE2E2", color: "#991B1B" };
    default:
      return { ...base, backgroundColor: "#F3F4F6", color: "#6B7280" };
  }
}

function formatCurrency(val: number): string {
  if (val === 0) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatApptDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td
          key={i}
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <span
            className="animate-pulse"
            style={{
              display: "block",
              height: "14px",
              width: i === 0 ? "140px" : i === 4 ? "80px" : "100px",
              backgroundColor: "var(--bg-tertiary, #F3F4F6)",
              borderRadius: "4px",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

type SortField = "name" | "createdAt" | "status";

export default function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [data, setData] = useState<PatientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      const res = await fetch(`/api/patients?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: PatientsResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page, sortBy, sortDir]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  const patients = data?.patients ?? [];
  const totalPages = data?.totalPages ?? 1;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 16px 10px 42px",
    fontSize: "14px",
    border: "1px solid var(--border-default)",
    borderRadius: "9999px",
    outline: "none",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    transition: "border-color 150ms",
  };

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "13px",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    transition: "border-color 150ms",
  };

  const headerCellStyle: React.CSSProperties = {
    padding: "12px 16px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border-default)",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  const cellStyle: React.CSSProperties = {
    padding: "14px 16px",
    fontSize: "14px",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-default)",
    whiteSpace: "nowrap",
  };

  const sortableHeaderStyle: React.CSSProperties = {
    ...headerCellStyle,
    cursor: "pointer",
    userSelect: "none",
  };

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: 500,
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    backgroundColor: "var(--bg-primary)",
    color: disabled ? "var(--text-subtle, #9CA3AF)" : "var(--text-secondary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "border-color 150ms, background-color 150ms",
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field)
      return (
        <ArrowUpDown
          size={13}
          style={{ color: "var(--text-subtle, #9CA3AF)", marginLeft: "4px" }}
        />
      );
    return (
      <span
        style={{
          marginLeft: "4px",
          fontSize: "13px",
          color: "var(--brand-primary)",
          fontWeight: 700,
        }}
      >
        {sortDir === "asc" ? "\u2191" : "\u2193"}
      </span>
    );
  }

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "var(--bg-secondary)",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "var(--brand-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Users
            size={18}
            style={{ color: "var(--brand-primary)" }}
            strokeWidth={1.8}
          />
        </div>
        <div>
          <h1
            data-testid="text-page-title"
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Patients
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            {data ? `${data.total} total patients` : "Loading..."}
          </p>
        </div>
      </div>

      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            data-testid="input-search"
            type="text"
            placeholder="Search patients by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--brand-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          />
        </div>
        <div>
          <select
            data-testid="select-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--brand-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter((s) => s !== "ALL").map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          border: "1px solid var(--border-default)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            data-testid="table-patients"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "900px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                <th
                  style={sortableHeaderStyle}
                  onClick={() => handleSort("name")}
                  data-testid="button-sort-name"
                >
                  <span
                    className="flex items-center"
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    Name
                    <SortIcon field="name" />
                  </span>
                </th>
                <th style={headerCellStyle}>Email</th>
                <th style={headerCellStyle}>Phone</th>
                <th
                  style={sortableHeaderStyle}
                  onClick={() => handleSort("status")}
                  data-testid="button-sort-status"
                >
                  <span
                    className="flex items-center"
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    Status
                    <SortIcon field="status" />
                  </span>
                </th>
                <th style={headerCellStyle}>Lifetime Value</th>
                <th style={headerCellStyle}>Active Opps</th>
                <th
                  style={sortableHeaderStyle}
                  onClick={() => handleSort("createdAt")}
                  data-testid="button-sort-created"
                >
                  <span
                    className="flex items-center"
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    Next Appointment
                    <SortIcon field="createdAt" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : patients.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "60px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          backgroundColor: "var(--brand-light)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Users
                          size={24}
                          style={{ color: "var(--brand-primary)" }}
                          strokeWidth={1.8}
                        />
                      </div>
                      <div>
                        <p
                          data-testid="text-empty-title"
                          style={{
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            margin: "0 0 4px",
                          }}
                        >
                          No patients found
                        </p>
                        <p
                          data-testid="text-empty-subtitle"
                          style={{
                            fontSize: "13px",
                            color: "var(--text-muted)",
                            margin: 0,
                          }}
                        >
                          {debouncedSearch || statusFilter
                            ? "Try adjusting your search or filters."
                            : "Patients will appear here once added."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr
                    key={patient.id}
                    data-testid={`row-patient-${patient.id}`}
                    style={{ transition: "background-color 100ms" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--bg-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <td style={cellStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {patient.isVip && (
                          <Star
                            size={14}
                            style={{
                              color: "#F59E0B",
                              fill: "#F59E0B",
                              flexShrink: 0,
                            }}
                            data-testid={`icon-vip-${patient.id}`}
                          />
                        )}
                        <Link
                          href={`/patients/${patient.id}`}
                          data-testid={`link-patient-${patient.id}`}
                          style={{
                            color: "var(--brand-primary)",
                            fontWeight: 600,
                            textDecoration: "none",
                            fontSize: "14px",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = "underline";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = "none";
                          }}
                        >
                          {patient.firstName} {patient.lastName}
                        </Link>
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <span
                        data-testid={`text-email-${patient.id}`}
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                        }}
                      >
                        {patient.email || "\u2014"}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span
                        data-testid={`text-phone-${patient.id}`}
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                        }}
                      >
                        {patient.phone ? formatPhoneDisplay(patient.phone) : "\u2014"}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span
                        data-testid={`badge-status-${patient.id}`}
                        style={getStatusBadgeStyle(patient.status)}
                      >
                        {patient.status}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span
                        data-testid={`text-ltv-${patient.id}`}
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          fontSize: "13px",
                          fontFamily: "var(--font-geist-mono, monospace)",
                        }}
                      >
                        {formatCurrency(patient.lifetimeValue)}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span
                        data-testid={`text-opps-${patient.id}`}
                        style={{
                          fontSize: "13px",
                          color:
                            patient.activeOpportunities > 0
                              ? "var(--text-primary)"
                              : "var(--text-muted)",
                          fontWeight:
                            patient.activeOpportunities > 0 ? 600 : 400,
                        }}
                      >
                        {patient.activeOpportunities}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span
                        data-testid={`text-appt-${patient.id}`}
                        style={{
                          fontSize: "13px",
                          color: patient.nextAppointment
                            ? "var(--brand-primary)"
                            : "var(--text-muted)",
                          fontWeight: patient.nextAppointment ? 500 : 400,
                        }}
                      >
                        {patient.nextAppointment
                          ? formatApptDate(patient.nextAppointment.startTime)
                          : "\u2014"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && patients.length > 0 && (
          <div
            data-testid="pagination-controls"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            <span
              data-testid="text-page-info"
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                data-testid="button-prev-page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={btnStyle(page <= 1)}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                data-testid="button-next-page"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={btnStyle(page >= totalPages)}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
