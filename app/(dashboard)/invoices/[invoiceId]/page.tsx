"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  X,
  Search,
  ChevronDown,
  Eye,
  Send,
  Save,
  Download,
  FileText,
  Loader2,
  Trash2,
  Ban,
  AlertTriangle,
} from "lucide-react";

interface LineItem {
  id: string;
  productServiceId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  hours: number | null;
  providerId: string | null;
  discountType: "FIXED" | "PERCENTAGE" | null;
  discountValue: number | null;
  taxable: boolean;
  itemType: string | null;
  sortOrder: number;
}

interface PaymentData {
  id: string;
  amount: number | string;
  paymentDate: string;
  method: string;
  referenceNumber: string | null;
  notes: string | null;
  recorder: { id: string; firstName: string; lastName: string } | null;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

type PaymentMethod =
  | "CASH"
  | "CHECK"
  | "CREDIT_CARD"
  | "CARECREDIT"
  | "CHERRY"
  | "PATIENTFI"
  | "WIRE_TRANSFER"
  | "OTHER";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "rgba(107,114,128,0.12)", text: "#6B7280" },
  SENT: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6" },
  PARTIALLY_PAID: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
  PAID: { bg: "rgba(16,185,129,0.12)", text: "#10B981" },
  VOID: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  VOID: "Void",
};

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
  CREDIT_CARD: "Transaction ID",
  CARECREDIT: "Approval Code",
  CHERRY: "Approval Code",
  PATIENTFI: "Approval Code",
  WIRE_TRANSFER: "Wire Ref #",
  OTHER: "Reference #",
};

const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH", "CHECK", "CREDIT_CARD", "CARECREDIT", "CHERRY", "PATIENTFI", "WIRE_TRANSFER", "OTHER",
];

function generateTempId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

function calcLineTotal(li: LineItem): number {
  let base = 0;
  if (li.hours != null && li.hours > 0) {
    base = li.hours * li.unitPrice;
  } else {
    base = li.quantity * li.unitPrice;
  }
  let disc = 0;
  if (li.discountType && li.discountValue) {
    if (li.discountType === "FIXED") disc = li.discountValue;
    else disc = base * (li.discountValue / 100);
  }
  return Math.max(0, base - disc);
}

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invoiceId = params.invoiceId as string;

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [coordinatorId, setCoordinatorId] = useState<string | null>(null);
  const [depositType, setDepositType] = useState<"FLAT" | "PERCENTAGE">("PERCENTAGE");
  const [depositValue, setDepositValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [internalNotes, setInternalNotes] = useState("");
  const [patientNotes, setPatientNotes] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeletePaymentId, setShowDeletePaymentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CREDIT_CARD");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["/api/invoices", invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) throw new Error("Failed to load invoice");
      return res.json();
    },
    enabled: !!invoiceId,
  });

  const { data: usersData } = useQuery({
    queryKey: ["/api/settings/users"],
    queryFn: async () => {
      const res = await fetch("/api/settings/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ["/api/settings/products-services"],
    queryFn: async () => {
      const res = await fetch("/api/settings/products-services");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const { data: taxData } = useQuery({
    queryKey: ["/api/settings/tax"],
    queryFn: async () => {
      const res = await fetch("/api/settings/tax");
      if (!res.ok) throw new Error("Failed to load tax");
      return res.json();
    },
  });

  const { data: currentUserData } = useQuery({
    queryKey: ["/api/user/role"],
    queryFn: async () => {
      const res = await fetch("/api/user/role");
      if (!res.ok) throw new Error("Failed to load user");
      return res.json();
    },
  });

  const users: UserData[] = useMemo(() => {
    if (!usersData) return [];
    const list = usersData.users || usersData;
    return Array.isArray(list) ? list : [];
  }, [usersData]);

  const activeUsers = useMemo(() => users.filter((u) => u.isActive), [users]);
  const providers = useMemo(() => activeUsers.filter((u) => u.role === "PROVIDER"), [activeUsers]);
  const taxRate = taxData?.defaultTaxRate != null ? Number(taxData.defaultTaxRate) : null;
  const isAdmin = currentUserData?.role === "ADMIN";
  const isEditable = invoice && !["VOID", "PAID"].includes(invoice.status);

  const products = useMemo(() => {
    if (!productsData) return [];
    return Array.isArray(productsData) ? productsData.filter((p: any) => p.status === "ACTIVE") : [];
  }, [productsData]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p: any) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  useEffect(() => {
    if (invoice && !dataLoaded) {
      setCoordinatorId(invoice.coordinatorId || null);
      setDepositType(invoice.depositType || "PERCENTAGE");
      setDepositValue(invoice.depositValue ? Number(invoice.depositValue) : 0);
      setDiscountType(invoice.discountType || "FIXED");
      setDiscountValue(invoice.discountValue ? Number(invoice.discountValue) : 0);
      setInternalNotes(invoice.internalNotes || "");
      setPatientNotes(invoice.patientNotes || "");
      setLineItems(
        (invoice.lineItems || []).map((li: any) => ({
          id: li.id,
          productServiceId: li.productServiceId,
          name: li.name || "",
          description: li.description || "",
          quantity: Number(li.quantity || 1),
          unitPrice: Number(li.unitPrice || 0),
          hours: li.hours ? Number(li.hours) : null,
          providerId: li.providerId || null,
          discountType: li.discountType || null,
          discountValue: li.discountValue ? Number(li.discountValue) : null,
          taxable: li.productService?.taxable ?? false,
          itemType: li.productService?.itemType || null,
          sortOrder: li.sortOrder || 0,
        }))
      );
      setDataLoaded(true);
    }
  }, [invoice, dataLoaded]);

  const subtotal = useMemo(() => lineItems.reduce((sum, li) => sum + calcLineTotal(li), 0), [lineItems]);

  const invoiceLevelDiscount = useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0;
    if (discountType === "FIXED") return discountValue;
    return subtotal * (discountValue / 100);
  }, [subtotal, discountType, discountValue]);

  const taxAmount = useMemo(() => {
    if (taxRate === null || taxRate === 0) return 0;
    let taxableTotal = lineItems.reduce((sum, li) => {
      if (!li.taxable) return sum;
      return sum + calcLineTotal(li);
    }, 0);
    if (invoiceLevelDiscount > 0 && subtotal > 0) {
      taxableTotal = taxableTotal * (1 - invoiceLevelDiscount / subtotal);
    }
    return taxableTotal * (taxRate / 100);
  }, [lineItems, taxRate, invoiceLevelDiscount, subtotal]);

  const total = useMemo(() => subtotal - invoiceLevelDiscount + taxAmount, [subtotal, invoiceLevelDiscount, taxAmount]);

  const depositAmount = useMemo(() => {
    if (!depositValue || depositValue <= 0) return 0;
    if (depositType === "FLAT") return depositValue;
    return total * (depositValue / 100);
  }, [total, depositType, depositValue]);

  const amountPaid = invoice ? Number(invoice.amountPaid || 0) : 0;
  const balanceDue = Math.max(0, total - amountPaid);

  const addProduct = useCallback((product: any) => {
    const newItem: LineItem = {
      id: generateTempId(),
      productServiceId: product.id,
      name: product.name,
      description: product.description || "",
      quantity: 1,
      unitPrice: Number(product.price || 0),
      hours: ["SERVICE_HOURLY", "SERVICE_TIERED"].includes(product.itemType) ? 1 : null,
      providerId: null,
      discountType: null,
      discountValue: null,
      taxable: product.taxable ?? false,
      itemType: product.itemType || null,
      sortOrder: 0,
    };
    setLineItems((prev) => [...prev, newItem]);
    setProductSearch("");
    setShowProductDropdown(false);
  }, []);

  const updateLineItem = useCallback((id: string, field: string, value: any) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    if (!isEditable) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinatorId,
          depositType,
          depositValue,
          discountType,
          discountValue,
          internalNotes,
          patientNotes,
          lineItems: lineItems.map((li, idx) => ({
            productServiceId: li.productServiceId,
            name: li.name,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            hours: li.hours,
            providerId: li.providerId,
            discountType: li.discountType,
            discountValue: li.discountValue,
            taxable: li.taxable,
            sortOrder: idx,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to save invoice");
      setDataLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      setToast({ message: "Invoice saved successfully", type: "success" });
    } catch {
      setToast({ message: "Failed to save invoice", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }, [invoiceId, coordinatorId, depositType, depositValue, discountType, discountValue, internalNotes, patientNotes, lineItems, isEditable, queryClient]);

  const handleMarkSent = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }
      setDataLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      setToast({ message: "Invoice marked as sent", type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || "Failed to mark as sent", type: "error" });
    }
  }, [invoiceId, queryClient]);

  const handleVoid = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VOID" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to void");
      }
      setShowVoidModal(false);
      setDataLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      setToast({ message: "Invoice voided", type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || "Failed to void invoice", type: "error" });
    }
  }, [invoiceId, queryClient]);

  const handleDownloadPdf = useCallback(async () => {
    setPdfDownloading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const patientLast = invoice?.patient?.lastName || "Patient";
      a.download = `Invoice-${invoice?.invoiceNumber || "draft"}-${patientLast}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setToast({ message: "Failed to download PDF", type: "error" });
    } finally {
      setPdfDownloading(false);
    }
  }, [invoiceId, invoice]);

  const handleRecordPayment = useCallback(async () => {
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setToast({ message: "Enter a valid payment amount", type: "error" });
      return;
    }
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          paymentDate,
          method: paymentMethod,
          referenceNumber: paymentRef || null,
          notes: paymentNotes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record payment");
      }
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("CREDIT_CARD");
      setPaymentRef("");
      setPaymentNotes("");
      setDataLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      setToast({ message: "Payment recorded successfully", type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || "Failed to record payment", type: "error" });
    }
  }, [invoiceId, paymentAmount, paymentDate, paymentMethod, paymentRef, paymentNotes, queryClient]);

  const handleDeletePayment = useCallback(async (paymentId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete payment");
      }
      setShowDeletePaymentId(null);
      setDataLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      setToast({ message: "Payment deleted", type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || "Failed to delete payment", type: "error" });
    }
  }, [invoiceId, queryClient]);

  if (isLoading || !invoice) {
    return (
      <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#10B981" }} />
        <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>Loading invoice...</span>
      </div>
    );
  }

  const payments: PaymentData[] = invoice.payments || [];
  const statusColor = STATUS_COLORS[invoice.status] || STATUS_COLORS.DRAFT;

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1000px", margin: "0 auto" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: "8px",
            background: toast.type === "success" ? "#10B981" : "#EF4444",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
          data-testid="toast-message"
        >
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.push("/invoices")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "13px",
            padding: 0,
            marginBottom: 16,
          }}
          data-testid="button-back-invoices"
        >
          <ArrowLeft size={14} /> Back to Invoices
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
              Invoice
            </span>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }} data-testid="text-invoice-number">
              {invoice.invoiceNumber || "Draft"}
            </h1>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                background: statusColor.bg,
                color: statusColor.text,
                textTransform: "uppercase",
              }}
              data-testid="text-invoice-status"
            >
              {STATUS_LABELS[invoice.status] || invoice.status}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowPreview(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                borderRadius: "6px",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              data-testid="button-preview-invoice"
            >
              <Eye size={14} /> Preview
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfDownloading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                borderRadius: "6px",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: pdfDownloading ? "wait" : "pointer",
                opacity: pdfDownloading ? 0.6 : 1,
              }}
              data-testid="button-download-pdf"
            >
              {pdfDownloading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
              PDF
            </button>
            {invoice.status === "DRAFT" && (
              <button
                onClick={handleMarkSent}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "1px solid #3B82F6",
                  background: "rgba(59,130,246,0.1)",
                  color: "#3B82F6",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                data-testid="button-mark-sent"
              >
                <Send size={14} /> Mark as Sent
              </button>
            )}
            {invoice.status !== "VOID" && (
              <button
                onClick={() => setShowVoidModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "1px solid #EF4444",
                  background: "rgba(239,68,68,0.08)",
                  color: "#EF4444",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                data-testid="button-void-invoice"
              >
                <Ban size={14} /> Void
              </button>
            )}
          </div>
        </div>

        {invoice.quote && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Generated from </span>
            <Link
              href={`/quotes/builder?quoteId=${invoice.quote.id}`}
              style={{ fontSize: "12px", color: "#10B981", textDecoration: "none", fontWeight: 500 }}
              data-testid="link-source-quote"
            >
              {invoice.quote.quoteNumber || "Quote"}
            </Link>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
          padding: "16px",
          background: "var(--bg-primary)",
          borderRadius: "10px",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 4 }}>
            Patient
          </div>
          {invoice.patient ? (
            <Link
              href={`/patients/${invoice.patient.id}`}
              style={{ fontSize: "13px", color: "#10B981", textDecoration: "none", fontWeight: 500 }}
              data-testid="link-patient"
            >
              {invoice.patient.firstName} {invoice.patient.lastName}
            </Link>
          ) : (
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>—</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 4 }}>
            Deal
          </div>
          {invoice.opportunity ? (
            <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }} data-testid="text-deal">
              {invoice.opportunity.title}
            </span>
          ) : (
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>—</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 4 }}>
            Coordinator
          </div>
          {isEditable ? (
            <select
              value={coordinatorId || ""}
              onChange={(e) => setCoordinatorId(e.target.value || null)}
              style={{
                width: "100%",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "13px",
              }}
              data-testid="select-coordinator"
            >
              <option value="">Select...</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: "13px", color: "var(--text-primary)" }} data-testid="text-coordinator">
              {invoice.coordinator ? `${invoice.coordinator.firstName} ${invoice.coordinator.lastName}` : "—"}
            </span>
          )}
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 4 }}>
            Created
          </div>
          <span style={{ fontSize: "13px", color: "var(--text-primary)" }} data-testid="text-created-date">
            {formatDate(invoice.createdAt)}
          </span>
        </div>
      </div>

      <div style={{ background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-primary)", marginBottom: 24 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Line Items</h2>
          {isEditable && (
            <div ref={productSearchRef} style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                  width: 220,
                }}
              >
                <Search size={13} style={{ color: "var(--text-muted)" }} />
                <input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Add product or service..."
                  style={{
                    border: "none",
                    background: "none",
                    outline: "none",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                    width: "100%",
                  }}
                  data-testid="input-product-search"
                />
              </div>
              {showProductDropdown && filteredProducts.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    width: 300,
                    maxHeight: 240,
                    overflowY: "auto",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "8px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 100,
                    marginTop: 4,
                  }}
                >
                  {filteredProducts.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        color: "var(--text-primary)",
                      }}
                      data-testid={`button-add-product-${p.id}`}
                    >
                      <span>{p.name}</span>
                      <span style={{ color: "var(--text-muted)" }}>{formatCurrency(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {lineItems.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No line items yet. Search for a product or service to add.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <th style={{ padding: "8px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Item</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", width: 70 }}>Qty</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", width: 100 }}>Unit Price</th>
                {providers.length > 0 && (
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", width: 130 }}>Provider</th>
                )}
                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", width: 100 }}>Total</th>
                {isEditable && <th style={{ width: 36 }}></th>}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => (
                <tr key={li.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{li.name}</div>
                    {li.description && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>{li.description}</div>
                    )}
                    {li.taxable && (
                      <span style={{ fontSize: "10px", color: "#10B981", marginTop: 2, display: "inline-block" }}>Taxable</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {isEditable ? (
                      <input
                        type="number"
                        min={1}
                        value={li.hours != null ? li.hours : li.quantity}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          if (li.hours != null) updateLineItem(li.id, "hours", val);
                          else updateLineItem(li.id, "quantity", val);
                        }}
                        style={{
                          width: 50,
                          padding: "4px 6px",
                          borderRadius: "4px",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          fontSize: "13px",
                          textAlign: "right",
                        }}
                        data-testid={`input-qty-${li.id}`}
                      />
                    ) : (
                      <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{li.hours != null ? li.hours : li.quantity}</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {isEditable ? (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={li.unitPrice}
                        onChange={(e) => updateLineItem(li.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        style={{
                          width: 80,
                          padding: "4px 6px",
                          borderRadius: "4px",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          fontSize: "13px",
                          textAlign: "right",
                        }}
                        data-testid={`input-price-${li.id}`}
                      />
                    ) : (
                      <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{formatCurrency(li.unitPrice)}</span>
                    )}
                  </td>
                  {providers.length > 0 && (
                    <td style={{ padding: "10px 12px" }}>
                      {isEditable ? (
                        <select
                          value={li.providerId || ""}
                          onChange={(e) => updateLineItem(li.id, "providerId", e.target.value || null)}
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: "4px",
                            border: "1px solid var(--border-primary)",
                            background: "var(--bg-primary)",
                            color: "var(--text-primary)",
                            fontSize: "12px",
                          }}
                          data-testid={`select-provider-${li.id}`}
                        >
                          <option value="">—</option>
                          {providers.map((p) => (
                            <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {li.providerId ? providers.find((p) => p.id === li.providerId)?.firstName || "—" : "—"}
                        </span>
                      )}
                    </td>
                  )}
                  <td style={{ padding: "10px 12px", textAlign: "right", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {formatCurrency(calcLineTotal(li))}
                  </td>
                  {isEditable && (
                    <td style={{ padding: "10px 4px", textAlign: "center" }}>
                      <button
                        onClick={() => removeLineItem(li.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                        data-testid={`button-remove-item-${li.id}`}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div>
          {isEditable && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Invoice-Level Discount
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "13px" }}
                    data-testid="select-discount-type"
                  >
                    <option value="FIXED">$ Fixed</option>
                    <option value="PERCENTAGE">% Percentage</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={discountType === "PERCENTAGE" ? 1 : 0.01}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    style={{ width: 100, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "13px", textAlign: "right" }}
                    data-testid="input-discount-value"
                  />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Deposit
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={depositType}
                    onChange={(e) => setDepositType(e.target.value as any)}
                    style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "13px" }}
                    data-testid="select-deposit-type"
                  >
                    <option value="FLAT">$ Flat</option>
                    <option value="PERCENTAGE">% Percentage</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={depositType === "PERCENTAGE" ? 1 : 0.01}
                    value={depositValue}
                    onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                    style={{ width: 100, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "13px", textAlign: "right" }}
                    data-testid="input-deposit-value"
                  />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Internal Notes
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "13px", resize: "vertical" }}
                  data-testid="input-internal-notes"
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Patient Notes
                </label>
                <textarea
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "13px", resize: "vertical" }}
                  data-testid="input-patient-notes"
                />
              </div>
            </>
          )}
        </div>

        <div style={{ background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-primary)", padding: "16px", height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "13px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }} data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
          </div>
          {invoiceLevelDiscount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "13px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Discount</span>
              <span style={{ color: "#EF4444", fontWeight: 500 }} data-testid="text-discount">-{formatCurrency(invoiceLevelDiscount)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "13px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Tax{taxRate ? ` (${taxRate}%)` : ""}</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }} data-testid="text-tax">{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border-primary)", borderBottom: "1px solid var(--border-primary)", marginBottom: 8, fontSize: "15px" }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Invoice Total</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700 }} data-testid="text-total">{formatCurrency(total)}</span>
          </div>
          {depositAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "13px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Deposit Due</span>
              <span style={{ color: "#3B82F6", fontWeight: 500 }} data-testid="text-deposit">{formatCurrency(depositAmount)}</span>
            </div>
          )}
          {amountPaid > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "13px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Total Paid</span>
              <span style={{ color: "#10B981", fontWeight: 500 }} data-testid="text-amount-paid">{formatCurrency(amountPaid)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingTop: 4 }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Balance Remaining</span>
            <span
              style={{
                fontWeight: 700,
                color: balanceDue <= 0 ? "#10B981" : "#F59E0B",
              }}
              data-testid="text-balance-due"
            >
              {formatCurrency(balanceDue)}
            </span>
          </div>
        </div>
      </div>

      {isEditable && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 20px",
              borderRadius: "6px",
              border: "none",
              background: "#10B981",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: isSaving ? "wait" : "pointer",
              opacity: isSaving ? 0.7 : 1,
            }}
            data-testid="button-save-invoice"
          >
            {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
            Save Invoice
          </button>
        </div>
      )}

      <div style={{ background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-primary)", marginBottom: 24 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Payment History</h2>
          {invoice.status !== "VOID" && invoice.status !== "PAID" && (
            <button
              onClick={() => {
                setPaymentAmount(balanceDue > 0 ? balanceDue.toFixed(2) : "");
                setShowPaymentModal(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: "#10B981",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              data-testid="button-record-payment"
            >
              <Plus size={13} /> Record Payment
            </button>
          )}
        </div>

        {payments.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No payments recorded yet.
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <th style={{ padding: "8px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Date</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Method</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Amount</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Reference</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Recorded By</th>
                  {isAdmin && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((p: PaymentData) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    <td style={{ padding: "10px 16px", fontSize: "13px", color: "var(--text-primary)" }}>{formatDate(p.paymentDate)}</td>
                    <td style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-primary)" }}>
                      {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] || p.method}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "13px", fontWeight: 500, color: "#10B981", textAlign: "right" }}>
                      {formatCurrency(p.amount)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                      {p.referenceNumber || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                      {p.recorder ? `${p.recorder.firstName} ${p.recorder.lastName}` : "—"}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "10px 4px", textAlign: "center" }}>
                        <button
                          onClick={() => setShowDeletePaymentId(p.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                          data-testid={`button-delete-payment-${p.id}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", gap: 6, fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Invoice Total</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Total Paid</span>
                <span style={{ color: "#10B981", fontWeight: 500 }}>{formatCurrency(amountPaid)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, paddingTop: 4, borderTop: "1px solid var(--border-primary)" }}>
                <span style={{ color: "var(--text-primary)" }}>Balance Remaining</span>
                <span style={{ color: balanceDue <= 0 ? "#10B981" : "#F59E0B" }}>{formatCurrency(balanceDue)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {showVoidModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9000,
          }}
          onClick={() => setShowVoidModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-primary)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={18} style={{ color: "#EF4444" }} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Void Invoice</h3>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              Voiding this invoice cannot be undone. Any recorded payments will be preserved for audit purposes. Continue?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowVoidModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                data-testid="button-void-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#EF4444",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                data-testid="button-void-confirm"
              >
                Void Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9000,
          }}
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-primary)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 20px 0" }}>Record Payment</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Amount
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Balance: ${formatCurrency(balanceDue)}`}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                  }}
                  data-testid="input-payment-amount"
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                  }}
                  data-testid="input-payment-date"
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setPaymentRef("");
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                  }}
                  data-testid="select-payment-method"
                >
                  {ALL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  {PAYMENT_REF_LABELS[paymentMethod]} (optional)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                  }}
                  data-testid="input-payment-ref"
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Notes (optional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    resize: "vertical",
                  }}
                  data-testid="input-payment-notes"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                data-testid="button-payment-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#10B981",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                data-testid="button-payment-save"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeletePaymentId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9000,
          }}
          onClick={() => setShowDeletePaymentId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-primary)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px 0" }}>Delete Payment</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              Delete this payment record? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeletePaymentId(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                data-testid="button-delete-payment-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePayment(showDeletePaymentId)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#EF4444",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                data-testid="button-delete-payment-confirm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9000,
          }}
          onClick={() => setShowPreview(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                  {invoice.practice?.name && (
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: invoice.practice?.primaryColor || "#0A1628", margin: "0 0 4px 0" }}>
                      {invoice.practice.name}
                    </h2>
                  )}
                  {invoice.practice?.address && (
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>
                      {invoice.practice.address}
                      {invoice.practice.city && `, ${invoice.practice.city}`}
                      {invoice.practice.state && `, ${invoice.practice.state}`}
                    </div>
                  )}
                  {invoice.practice?.phone && (
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>{invoice.practice.phone}</div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: invoice.practice?.primaryColor || "#10B981", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Invoice
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1F2937", marginTop: 4 }}>
                    {invoice.invoiceNumber || "Draft"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6B7280", marginTop: 2 }}>
                    {formatDate(invoice.createdAt)}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, padding: "16px", background: "#F9FAFB", borderRadius: "8px" }}>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9CA3AF", marginBottom: 4 }}>
                    Bill To
                  </div>
                  {invoice.patient && (
                    <>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#1F2937" }}>
                        {invoice.patient.firstName} {invoice.patient.lastName}
                      </div>
                      {invoice.patient.email && <div style={{ fontSize: "12px", color: "#6B7280" }}>{invoice.patient.email}</div>}
                      {invoice.patient.phone && <div style={{ fontSize: "12px", color: "#6B7280" }}>{invoice.patient.phone}</div>}
                    </>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9CA3AF", marginBottom: 4 }}>
                    Invoice Details
                  </div>
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>
                    <strong>Status:</strong> {STATUS_LABELS[invoice.status]}
                  </div>
                  {invoice.quote && (
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>
                      <strong>Quote:</strong> {invoice.quote.quoteNumber}
                    </div>
                  )}
                  {invoice.opportunity && (
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>
                      <strong>Regarding:</strong> {invoice.opportunity.title}
                    </div>
                  )}
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                    <th style={{ padding: "8px 0", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "#6B7280" }}>Description</th>
                    <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "#6B7280", width: 60 }}>Qty</th>
                    <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "#6B7280", width: 90 }}>Rate</th>
                    <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "#6B7280", width: 90 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => (
                    <tr key={li.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0" }}>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "#1F2937" }}>{li.name}</div>
                        {li.description && <div style={{ fontSize: "11px", color: "#9CA3AF" }}>{li.description}</div>}
                      </td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "13px", color: "#374151" }}>
                        {li.hours != null ? li.hours : li.quantity}
                      </td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "13px", color: "#374151" }}>
                        {formatCurrency(li.unitPrice)}
                      </td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "13px", fontWeight: 500, color: "#1F2937" }}>
                        {formatCurrency(calcLineTotal(li))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: 240 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: 6 }}>
                    <span style={{ color: "#6B7280" }}>Subtotal</span>
                    <span style={{ color: "#1F2937" }}>{formatCurrency(subtotal)}</span>
                  </div>
                  {invoiceLevelDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: 6 }}>
                      <span style={{ color: "#6B7280" }}>Discount</span>
                      <span style={{ color: "#EF4444" }}>-{formatCurrency(invoiceLevelDiscount)}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: 6 }}>
                      <span style={{ color: "#6B7280" }}>Tax</span>
                      <span style={{ color: "#1F2937" }}>{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 700, paddingTop: 8, borderTop: "2px solid #E5E7EB" }}>
                    <span style={{ color: "#1F2937" }}>Total</span>
                    <span style={{ color: invoice.practice?.primaryColor || "#10B981" }}>{formatCurrency(total)}</span>
                  </div>
                  {amountPaid > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: 8 }}>
                        <span style={{ color: "#6B7280" }}>Paid</span>
                        <span style={{ color: "#10B981" }}>{formatCurrency(amountPaid)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 600, marginTop: 4 }}>
                        <span style={{ color: "#1F2937" }}>Balance Due</span>
                        <span style={{ color: balanceDue <= 0 ? "#10B981" : "#F59E0B" }}>{formatCurrency(balanceDue)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {patientNotes && (
                <div style={{ marginTop: 24, padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9CA3AF", marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>{patientNotes}</div>
                </div>
              )}
            </div>

            <div style={{ padding: "12px 32px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #D1D5DB",
                  background: "#fff",
                  color: "#374151",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                data-testid="button-close-preview"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
