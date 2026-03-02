"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  Eye,
  Download,
  DollarSign,
  CreditCard,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Search,
  X,
  Banknote,
} from "lucide-react";

type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "VOID";

type PaymentMethod =
  | "CASH"
  | "CHECK"
  | "CREDIT_CARD"
  | "CARECREDIT"
  | "CHERRY"
  | "PATIENTFI"
  | "WIRE_TRANSFER"
  | "OTHER";

interface InvoiceData {
  id: string;
  invoiceNumber: string | null;
  description: string | null;
  status: InvoiceStatus;
  total: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  dueDate: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string } | null;
  opportunity: { id: string; title: string } | null;
  coordinator: { id: string; firstName: string; lastName: string } | null;
  quote: { id: string; quoteNumber: string } | null;
  payments: any[];
}

interface KpiData {
  totalInvoiced: number;
  amountCollected: number;
  outstandingBalance: number;
  overdue: number;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
}

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  DRAFT: { bg: "rgba(107,114,128,0.1)", text: "#6B7280" },
  SENT: { bg: "rgba(59,130,246,0.1)", text: "#3B82F6" },
  PARTIALLY_PAID: { bg: "rgba(245,158,11,0.1)", text: "#F59E0B" },
  PAID: { bg: "rgba(16,185,129,0.1)", text: "#10B981" },
  VOID: { bg: "rgba(239,68,68,0.1)", text: "#EF4444" },
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  VOID: "Void",
};

const ALL_STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID"];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CHECK: "Check",
  CREDIT_CARD: "Credit Card",
  CARECREDIT: "CareCredit",
  CHERRY: "Cherry",
  PATIENTFI: "PatientFi",
  WIRE_TRANSFER: "Wire Transfer",
  OTHER: "Other",
};

const PAYMENT_REF_LABELS: Record<PaymentMethod, string> = {
  CASH: "Receipt #",
  CHECK: "Check #",
  CREDIT_CARD: "Last 4 Digits",
  CARECREDIT: "Approval Code",
  CHERRY: "Approval Code",
  PATIENTFI: "Approval Code",
  WIRE_TRANSFER: "Wire Ref #",
  OTHER: "Reference #",
};

const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CHECK",
  "CREDIT_CARD",
  "CARECREDIT",
  "CHERRY",
  "PATIENTFI",
  "WIRE_TRANSFER",
  "OTHER",
];

function formatCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "$0.00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "$0.00";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

export default function InvoicesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedStatuses, setSelectedStatuses] = useState<InvoiceStatus[]>([]);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    invoice: InvoiceData | null;
  }>({ open: false, invoice: null });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CREDIT_CARD");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const toggleSort = useCallback(
    (field: string) => {
      if (sortBy === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortDir("desc");
      }
    },
    [sortBy]
  );

  const toggleStatus = useCallback((status: InvoiceStatus) => {
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
    queryKey: ["/api/invoices/kpis", filterParams],
    queryFn: async () => {
      const url = filterParams ? `/api/invoices/kpis?${filterParams}` : "/api/invoices/kpis";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    },
  });

  const { data: invoicesResponse, isLoading: invoicesLoading } = useQuery<{
    invoices: InvoiceData[];
    total: number;
  }>({
    queryKey: ["/api/invoices", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/invoices?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
  });

  const invoices = invoicesResponse?.invoices ?? [];

  const { data: users = [] } = useQuery<UserData[]>({
    queryKey: ["/api/settings/users"],
    queryFn: async () => {
      const res = await fetch("/api/settings/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return Array.isArray(data) ? data : data.users || [];
    },
  });

  const activeUsers = useMemo(
    () => (Array.isArray(users) ? users : []).filter((u: any) => u.isActive !== false),
    [users]
  );

  const paymentMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      data,
    }: {
      invoiceId: string;
      data: {
        amount: number;
        paymentDate: string;
        method: string;
        referenceNumber: string;
        notes: string;
      };
    }) => {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to record payment" }));
        throw new Error(err.error || "Failed to record payment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/kpis"] });
      closePaymentModal();
    },
  });

  const openPaymentModal = (invoice: InvoiceData) => {
    setPaymentModal({ open: true, invoice });
    setPaymentAmount(String(Number(invoice.balanceDue)));
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("CREDIT_CARD");
    setPaymentRef("");
    setPaymentNotes("");
  };

  const closePaymentModal = () => {
    setPaymentModal({ open: false, invoice: null });
    setPaymentAmount("");
    setPaymentRef("");
    setPaymentNotes("");
  };

  const handleRecordPayment = () => {
    if (!paymentModal.invoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    paymentMutation.mutate({
      invoiceId: paymentModal.invoice.id,
      data: {
        amount,
        paymentDate: paymentDate,
        method: paymentMethod,
        referenceNumber: paymentRef,
        notes: paymentNotes,
      },
    });
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition");
      const match = disposition?.match(/filename="?(.+?)"?$/);
      a.download = match ? match[1] : `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

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
            Invoices
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginTop: "4px",
              lineHeight: 1.5,
            }}
          >
            Revenue collected and outstanding
          </p>
        </div>
        <button
          data-testid="new-invoice-button"
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
            opacity: 0.6,
          }}
          title="Manual invoice creation coming soon"
          onClick={() => {}}
        >
          <Plus size={14} />
          New Invoice
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
          label="Total Invoiced"
          value={kpisLoading ? "\u2014" : formatCurrency(kpis?.totalInvoiced ?? 0)}
          icon={<Receipt size={18} />}
          accentColor="#3B82F6"
          testId="kpi-total-invoiced"
          loading={kpisLoading}
          refetching={!kpisLoading && kpisFetching}
        />
        <KpiCard
          label="Amount Collected"
          value={kpisLoading ? "\u2014" : formatCurrency(kpis?.amountCollected ?? 0)}
          icon={<DollarSign size={18} />}
          accentColor="#10B981"
          testId="kpi-amount-collected"
          loading={kpisLoading}
          refetching={!kpisLoading && kpisFetching}
        />
        <KpiCard
          label="Outstanding Balance"
          value={kpisLoading ? "\u2014" : formatCurrency(kpis?.outstandingBalance ?? 0)}
          icon={<Banknote size={18} />}
          accentColor="#F59E0B"
          testId="kpi-outstanding-balance"
          loading={kpisLoading}
          refetching={!kpisLoading && kpisFetching}
        />
        <KpiCard
          label="Overdue"
          value={kpisLoading ? "\u2014" : String(kpis?.overdue ?? 0)}
          icon={<AlertTriangle size={18} />}
          accentColor={(kpis?.overdue ?? 0) > 0 ? "#EF4444" : "#6B7280"}
          testId="kpi-overdue"
          loading={kpisLoading}
          refetching={!kpisLoading && kpisFetching}
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

        {/* Date filters */}
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
      {invoicesLoading ? (
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
                {[
                  "Invoice #",
                  "Patient",
                  "Deal",
                  "Coordinator",
                  "Status",
                  "Total",
                  "Paid",
                  "Balance",
                  "Created",
                  "",
                ].map((h, i) => (
                  <th key={i} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: "14px",
                          borderRadius: "4px",
                          backgroundColor: "var(--border-default)",
                          width: j === 9 ? "60px" : `${60 + Math.random() * 40}%`,
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
      ) : invoices.length === 0 ? (
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
          <Receipt
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
            No invoices yet
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
            Invoices are created by converting accepted quotes. Go to a quote and use "Accept &
            Convert to Invoice" to get started.
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-default)",
            overflow: "hidden",
          }}
          data-testid="invoices-table"
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                <th
                  style={thStyle}
                  onClick={() => toggleSort("invoiceNumber")}
                  data-testid="sort-invoiceNumber"
                >
                  Invoice # <SortIcon field="invoiceNumber" />
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
                <th style={{ ...thStyle, textAlign: "right", cursor: "default" }}>Paid</th>
                <th
                  style={{ ...thStyle, textAlign: "right" }}
                  onClick={() => toggleSort("balanceDue")}
                  data-testid="sort-balanceDue"
                >
                  Balance <SortIcon field="balanceDue" />
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
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  data-testid={`invoice-row-${invoice.id}`}
                  style={{ borderBottom: "1px solid var(--border-default)" }}
                >
                  <td style={tdStyle}>
                    <span
                      data-testid={`invoice-number-${invoice.id}`}
                      style={{
                        fontWeight: 600,
                        color: "var(--brand-primary)",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        router.push(`/invoices/${invoice.id}`)
                      }
                    >
                      {invoice.invoiceNumber || "\u2014"}
                    </span>
                    {invoice.quote && (
                      <span
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        from {invoice.quote.quoteNumber}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {invoice.patient ? (
                      <span
                        onClick={() => router.push(`/patients/${invoice.patient!.id}`)}
                        data-testid={`invoice-patient-${invoice.id}`}
                        style={{ color: "var(--text-primary)", cursor: "pointer" }}
                      >
                        {invoice.patient.firstName} {invoice.patient.lastName}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>{"\u2014"}</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {invoice.opportunity ? (
                      <span
                        onClick={() => router.push("/pipeline")}
                        data-testid={`invoice-deal-${invoice.id}`}
                        style={{ color: "var(--text-primary)", cursor: "pointer" }}
                      >
                        {invoice.opportunity.title}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>{"\u2014"}</span>
                    )}
                  </td>
                  <td style={tdStyle} data-testid={`invoice-coordinator-${invoice.id}`}>
                    {invoice.coordinator
                      ? `${invoice.coordinator.firstName} ${invoice.coordinator.lastName}`
                      : "\u2014"}
                  </td>
                  <td style={tdStyle}>
                    <span
                      data-testid={`invoice-status-${invoice.id}`}
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 500,
                        backgroundColor: STATUS_COLORS[invoice.status]?.bg,
                        color: STATUS_COLORS[invoice.status]?.text,
                      }}
                    >
                      {STATUS_LABELS[invoice.status] || invoice.status}
                    </span>
                  </td>
                  <td
                    style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }}
                    data-testid={`invoice-total-${invoice.id}`}
                  >
                    {formatCurrency(invoice.total)}
                  </td>
                  <td
                    style={{ ...tdStyle, textAlign: "right" }}
                    data-testid={`invoice-paid-${invoice.id}`}
                  >
                    {formatCurrency(invoice.amountPaid)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontWeight: Number(invoice.balanceDue) > 0 ? 600 : 400,
                      color:
                        Number(invoice.balanceDue) > 0
                          ? "#F59E0B"
                          : "var(--text-secondary)",
                    }}
                    data-testid={`invoice-balance-${invoice.id}`}
                  >
                    {formatCurrency(invoice.balanceDue)}
                  </td>
                  <td style={tdStyle} data-testid={`invoice-created-${invoice.id}`}>
                    {formatDate(invoice.createdAt)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}
                    >
                      <ActionButton
                        icon={<Eye size={14} />}
                        title="View invoice"
                        testId={`invoice-view-${invoice.id}`}
                        onClick={() =>
                          router.push(`/invoices/${invoice.id}`)
                        }
                      />
                      <ActionButton
                        icon={<Download size={14} />}
                        title="Download PDF"
                        testId={`invoice-pdf-${invoice.id}`}
                        onClick={() => handleDownloadPdf(invoice.id)}
                      />
                      {invoice.status !== "VOID" && invoice.status !== "PAID" && (
                        <ActionButton
                          icon={<CreditCard size={14} />}
                          title="Record payment"
                          testId={`invoice-record-payment-${invoice.id}`}
                          onClick={() => openPaymentModal(invoice)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {paymentModal.open && paymentModal.invoice && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              zIndex: 999,
            }}
            onClick={closePaymentModal}
            data-testid="payment-modal-overlay"
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              padding: "24px",
              zIndex: 1000,
              width: "440px",
              maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            data-testid="payment-modal"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
                gap: "8px",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Record Payment
              </h3>
              <button
                onClick={closePaymentModal}
                data-testid="payment-modal-close"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div
              style={{
                padding: "12px",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "13px",
              }}
            >
              <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>
                {paymentModal.invoice.invoiceNumber} &mdash;{" "}
                {paymentModal.invoice.patient
                  ? `${paymentModal.invoice.patient.firstName} ${paymentModal.invoice.patient.lastName}`
                  : "Unknown"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)" }}>
                  Total: {formatCurrency(paymentModal.invoice.total)}
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  Paid: {formatCurrency(paymentModal.invoice.amountPaid)}
                </span>
                <span style={{ fontWeight: 600, color: "#F59E0B" }}>
                  Due: {formatCurrency(paymentModal.invoice.balanceDue)}
                </span>
              </div>
            </div>

            {paymentMutation.isError && (
              <div
                style={{
                  padding: "8px 12px",
                  marginBottom: "12px",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#EF4444",
                }}
                data-testid="payment-error"
              >
                {paymentMutation.error?.message || "Failed to record payment"}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <ModalField label="Amount">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  data-testid="payment-amount"
                  style={inputStyle}
                />
              </ModalField>
              <ModalField label="Payment Date">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  data-testid="payment-date"
                  style={inputStyle}
                />
              </ModalField>
              <ModalField label="Method">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  data-testid="payment-method"
                  style={inputStyle}
                >
                  {ALL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </ModalField>
              <ModalField label={PAYMENT_REF_LABELS[paymentMethod]}>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  data-testid="payment-reference"
                  style={inputStyle}
                  placeholder="Optional"
                />
              </ModalField>
              <ModalField label="Notes">
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  data-testid="payment-notes"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Optional"
                />
              </ModalField>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "20px",
              }}
            >
              <button
                onClick={closePaymentModal}
                data-testid="payment-cancel"
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={
                  paymentMutation.isPending ||
                  !paymentAmount ||
                  parseFloat(paymentAmount) <= 0
                }
                data-testid="payment-submit"
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--brand-primary)",
                  color: "white",
                  cursor:
                    paymentMutation.isPending ||
                    !paymentAmount ||
                    parseFloat(paymentAmount) <= 0
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    paymentMutation.isPending ||
                    !paymentAmount ||
                    parseFloat(paymentAmount) <= 0
                      ? 0.5
                      : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <CreditCard size={14} />
                {paymentMutation.isPending ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 12px",
  fontSize: "13px",
  borderRadius: "6px",
  border: "1px solid var(--border-default)",
  backgroundColor: "var(--bg-primary)",
  color: "var(--text-primary)",
  width: "100%",
  outline: "none",
};

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: "4px",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ActionButton({
  icon,
  title,
  testId,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      title={title}
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
      {icon}
    </button>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accentColor,
  testId,
  loading,
  refetching,
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
        opacity: refetching ? 0.6 : 1,
        animation: refetching ? "pulse 1.5s ease-in-out infinite" : undefined,
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
