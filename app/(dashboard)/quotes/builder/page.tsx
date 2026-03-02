"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Eye,
  Send,
  Save,
  Download,
  FileCheck,
  CheckCircle,
  FileText,
  Loader2,
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
  bundleComponents: any[];
  showComponents: boolean;
  tieredBaseRate: number | null;
  tieredSubRate: number | null;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}


const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "rgba(107,114,128,0.12)", text: "#6B7280" },
  SENT: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6" },
  ACCEPTED: { bg: "rgba(16,185,129,0.12)", text: "#10B981" },
  DECLINED: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
  CONVERTED: { bg: "rgba(139,92,246,0.12)", text: "#8B5CF6" },
  EXPIRED: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
};

function generateTempId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function calcLineTotal(li: LineItem): number {
  let base = 0;
  if (li.itemType === "SERVICE_TIERED" && li.tieredBaseRate != null && li.tieredSubRate != null) {
    const hrs = li.hours || 0;
    base = li.tieredBaseRate + li.tieredSubRate * Math.max(0, hrs - 1);
  } else if (li.hours != null && li.hours > 0) {
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

function QuoteBuilderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const quoteId = searchParams.get("quoteId");
  const opportunityId = searchParams.get("opportunityId");
  const urlPatientId = searchParams.get("patientId");
  const isEditing = !!quoteId;

  const [dealId, setDealId] = useState<string | null>(opportunityId || null);
  const [dealTitle, setDealTitle] = useState("");
  const [patientId, setPatientId] = useState<string | null>(urlPatientId || null);
  const [patientName, setPatientName] = useState("");
  const [coordinatorId, setCoordinatorId] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [expirationPreset, setExpirationPreset] = useState<"30" | "60" | "90" | "custom">("30");
  const [internalNotes, setInternalNotes] = useState("");
  const [patientNotes, setPatientNotes] = useState("");
  const [depositType, setDepositType] = useState<"FLAT" | "PERCENTAGE">("PERCENTAGE");
  const [depositValue, setDepositValue] = useState<number>(20);
  const [quoteLevelDiscountType, setQuoteLevelDiscountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [quoteLevelDiscountValue, setQuoteLevelDiscountValue] = useState<number>(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [status, setStatus] = useState("DRAFT");
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(quoteId);

  const [patientSearch, setPatientSearch] = useState("");
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const [dataLoaded, setDataLoaded] = useState(!isEditing && !opportunityId && !urlPatientId);
  const isFromDeal = !!opportunityId;
  const isFromPatient = !!urlPatientId && !opportunityId;

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPatientSearch(patientSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  useEffect(() => {
    if (urlPatientId && !isEditing && !patientName) {
      fetch(`/api/patients/${urlPatientId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setPatientId(data.id);
            setPatientName(`${data.firstName} ${data.lastName}`);
            setDataLoaded(true);
          }
        })
        .catch(() => {});
    }
  }, [urlPatientId, isEditing, patientName]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: existingQuote } = useQuery({
    queryKey: ["/api/quotes", quoteId],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) throw new Error("Failed to load quote");
      return res.json();
    },
    enabled: !!quoteId,
  });

  const { data: dealData } = useQuery({
    queryKey: ["/api/opportunities", opportunityId, "panel"],
    queryFn: async () => {
      const res = await fetch(`/api/opportunities/${opportunityId}/panel`);
      if (!res.ok) throw new Error("Failed to load deal");
      return res.json();
    },
    enabled: !!opportunityId && !quoteId,
  });

  const { data: patientSearchResults, isLoading: isSearching, isError: isSearchError } = useQuery({
    queryKey: ["/api/search", debouncedPatientSearch],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedPatientSearch)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedPatientSearch.length >= 1,
  });

  const { data: patientDeals } = useQuery({
    queryKey: ["/api/search", "patientDeals", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/search?patientId=${patientId}`);
      if (!res.ok) throw new Error("Failed to load deals");
      return res.json();
    },
    enabled: !!patientId && !dealId && !isFromDeal,
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
    if (!isEditing && !expirationDate) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setExpirationDate(d.toISOString().split("T")[0]);
      setExpirationPreset("30");
    }
  }, [isEditing, expirationDate]);

  useEffect(() => {
    if (patientDeals?.deals?.length === 1 && !dealId && !isFromDeal) {
      setDealId(patientDeals.deals[0].id);
      setDealTitle(patientDeals.deals[0].title);
    }
  }, [patientDeals, dealId, isFromDeal]);

  useEffect(() => {
    if (existingQuote && !dataLoaded) {
      setDealId(existingQuote.opportunityId || null);
      setDealTitle(existingQuote.opportunity?.title || "");
      setPatientId(existingQuote.patientId);
      setPatientName(
        existingQuote.patient
          ? `${existingQuote.patient.firstName} ${existingQuote.patient.lastName}`
          : ""
      );
      setCoordinatorId(existingQuote.coordinatorId);
      setExpirationDate(
        existingQuote.expirationDate
          ? new Date(existingQuote.expirationDate).toISOString().split("T")[0]
          : ""
      );
      setExpirationPreset("custom");
      setInternalNotes(existingQuote.internalNotes || "");
      setPatientNotes(existingQuote.patientNotes || "");
      setDepositType(existingQuote.depositType || "PERCENTAGE");
      setDepositValue(Number(existingQuote.depositValue) || 20);
      setQuoteLevelDiscountType(existingQuote.quoteLevelDiscountType || "FIXED");
      setQuoteLevelDiscountValue(Number(existingQuote.quoteLevelDiscountValue) || 0);
      setStatus(existingQuote.status);
      setQuoteNumber(existingQuote.quoteNumber);
      setLineItems(
        (existingQuote.lineItems || []).map((li: any) => ({
          id: li.id || generateTempId(),
          productServiceId: li.productServiceId,
          name: li.name || "",
          description: li.description || "",
          quantity: Number(li.quantity) || 1,
          unitPrice: Number(li.unitPrice) || 0,
          hours: li.hours != null ? Number(li.hours) : null,
          providerId: li.providerId,
          discountType: li.discountType,
          discountValue: li.discountValue != null ? Number(li.discountValue) : null,
          taxable: li.productService?.taxable ?? false,
          itemType: li.productService?.itemType || null,
          bundleComponents: li.productService?.bundleComponents || [],
          showComponents: false,
          tieredBaseRate: li.productService?.tieredBaseRate
            ? Number(li.productService.tieredBaseRate)
            : null,
          tieredSubRate: li.productService?.tieredSubRate
            ? Number(li.productService.tieredSubRate)
            : null,
        }))
      );
      setDataLoaded(true);
    }
  }, [existingQuote, dataLoaded]);

  useEffect(() => {
    if (dealData && !dataLoaded) {
      setDealId(dealData.id);
      setDealTitle(dealData.title);
      setPatientId(dealData.patient?.id || null);
      setPatientName(
        dealData.patient
          ? `${dealData.patient.firstName} ${dealData.patient.lastName}`
          : ""
      );
      setDataLoaded(true);
    }
  }, [dealData, dataLoaded]);

  useEffect(() => {
    if (!coordinatorId && currentUserData?.userId && activeUsers.length > 0) {
      const match = activeUsers.find((u) => u.id === currentUserData.userId);
      if (match) setCoordinatorId(match.id);
      else if (activeUsers.length > 0) setCoordinatorId(activeUsers[0].id);
    }
  }, [currentUserData, activeUsers, coordinatorId]);

  const subtotal = useMemo(() => lineItems.reduce((sum, li) => sum + calcLineTotal(li), 0), [lineItems]);

  const quoteLevelDiscount = useMemo(() => {
    if (!quoteLevelDiscountValue) return 0;
    if (quoteLevelDiscountType === "FIXED") return quoteLevelDiscountValue;
    return subtotal * (quoteLevelDiscountValue / 100);
  }, [subtotal, quoteLevelDiscountType, quoteLevelDiscountValue]);

  const afterDiscount = subtotal - quoteLevelDiscount;

  const taxableTotal = useMemo(() => {
    let t = 0;
    for (const li of lineItems) {
      if (li.taxable) t += calcLineTotal(li);
    }
    if (quoteLevelDiscount > 0 && subtotal > 0) {
      t = t * (1 - quoteLevelDiscount / subtotal);
    }
    return t;
  }, [lineItems, quoteLevelDiscount, subtotal]);

  const taxAmount = taxRate != null ? taxableTotal * (taxRate / 100) : 0;
  const total = afterDiscount + taxAmount;

  const depositAmount = useMemo(() => {
    if (depositType === "FLAT") return depositValue;
    return total * (depositValue / 100);
  }, [depositType, depositValue, total]);

  const updateLineItem = useCallback((id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, ...updates } : li)));
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }, []);

  const addProductAsLineItem = useCallback((product: any) => {
    const newItem: LineItem = {
      id: generateTempId(),
      productServiceId: product.id,
      name: product.name,
      description: product.description || "",
      quantity: 1,
      unitPrice:
        product.itemType === "SERVICE_HOURLY"
          ? Number(product.hourlyRate) || 0
          : product.itemType === "SERVICE_TIERED"
          ? Number(product.tieredBaseRate) || 0
          : Number(product.price) || 0,
      hours:
        product.itemType === "SERVICE_HOURLY" || product.itemType === "SERVICE_TIERED" ? 1 : null,
      providerId: null,
      discountType: null,
      discountValue: null,
      taxable: product.taxable ?? false,
      itemType: product.itemType,
      bundleComponents: product.bundleComponents || [],
      showComponents: false,
      tieredBaseRate: product.tieredBaseRate ? Number(product.tieredBaseRate) : null,
      tieredSubRate: product.tieredSubRate ? Number(product.tieredSubRate) : null,
    };
    setLineItems((prev) => [...prev, newItem]);
    setShowProductDropdown(false);
    setProductSearch("");
  }, []);

  const selectPatient = useCallback((patient: { id: string; firstName: string; lastName: string; email?: string; phone?: string }) => {
    setPatientId(patient.id);
    setPatientName(`${patient.firstName} ${patient.lastName}`);
    setShowPatientDropdown(false);
    setPatientSearch("");
    setDealId(null);
    setDealTitle("");
  }, []);

  const selectDealFromPatient = useCallback((deal: { id: string; title: string }) => {
    setDealId(deal.id);
    setDealTitle(deal.title);
  }, []);

  const applyExpirationPreset = useCallback((preset: "30" | "60" | "90" | "custom") => {
    setExpirationPreset(preset);
    if (preset !== "custom") {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(preset));
      setExpirationDate(d.toISOString().split("T")[0]);
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        opportunityId: dealId,
        patientId,
        coordinatorId,
        expirationDate,
        depositType,
        depositValue,
        quoteLevelDiscountType: quoteLevelDiscountValue ? quoteLevelDiscountType : null,
        quoteLevelDiscountValue: quoteLevelDiscountValue || null,
        internalNotes,
        patientNotes,
        lineItems: lineItems.map((li) => ({
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
        })),
      };

      const url = savedQuoteId ? `/api/quotes/${savedQuoteId}` : "/api/quotes";
      const method = savedQuoteId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save quote");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSavedQuoteId(data.id);
      setQuoteNumber(data.quoteNumber);
      setStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setToast({ message: "Quote saved successfully", type: "success" });
    },
    onError: (err: Error) => {
      setToast({ message: err.message, type: "error" });
    },
  });

  const markAsSentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        opportunityId: dealId,
        patientId,
        coordinatorId,
        expirationDate,
        depositType,
        depositValue,
        quoteLevelDiscountType: quoteLevelDiscountValue ? quoteLevelDiscountType : null,
        quoteLevelDiscountValue: quoteLevelDiscountValue || null,
        internalNotes,
        patientNotes,
        lineItems: lineItems.map((li) => ({
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
        })),
      };

      let id = savedQuoteId;
      if (!id) {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to save");
        }
        const created = await res.json();
        id = created.id;
        setSavedQuoteId(id);
        setQuoteNumber(created.quoteNumber);
      } else {
        const res = await fetch(`/api/quotes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to save");
        }
      }

      const statusRes = await fetch(`/api/quotes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      if (!statusRes.ok) throw new Error("Failed to mark as sent");
      return statusRes.json();
    },
    onSuccess: () => {
      setStatus("SENT");
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setToast({ message: "Quote marked as sent", type: "success" });
    },
    onError: (err: Error) => {
      setToast({ message: err.message, type: "error" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const id = savedQuoteId;
      if (!id) throw new Error("Quote must be saved before converting");
      const res = await fetch(`/api/quotes/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to convert quote");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setStatus("CONVERTED");
      setShowConvertModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setToast({ message: `Quote converted to Invoice ${data.invoiceNumber}`, type: "success" });
      router.push("/invoices");
    },
    onError: (err: Error) => {
      setToast({ message: err.message, type: "error" });
      setShowConvertModal(false);
    },
  });

  const convertibleStatuses = ["DRAFT", "SENT", "ACCEPTED"];
  const canConvert = savedQuoteId && convertibleStatuses.includes(status) && lineItems.length > 0;

  const canSave = patientId && expirationDate && lineItems.length > 0;
  const isSaving = saveMutation.isPending || markAsSentMutation.isPending;

  const showHoursColumn = lineItems.some(
    (li) => li.itemType === "SERVICE_HOURLY" || li.itemType === "SERVICE_TIERED"
  );

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => router.push("/quotes")}
            data-testid="back-button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
                data-testid="page-title"
              >
                Quote Builder
              </h1>
              {quoteNumber && (
                <span
                  style={{
                    fontSize: "14px",
                    color: "var(--text-muted)",
                    fontWeight: 400,
                  }}
                  data-testid="quote-number"
                >
                  {quoteNumber}
                </span>
              )}
              {status && (
                <span
                  data-testid="status-badge"
                  style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: STATUS_COLORS[status]?.bg || "rgba(107,114,128,0.12)",
                    color: STATUS_COLORS[status]?.text || "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {status}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {savedQuoteId && (
            <>
              <button
                onClick={() => router.push(`/quotes/${savedQuoteId}/preview`)}
                data-testid="preview-button"
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Eye size={14} />
                Preview
              </button>
              <button
                onClick={async () => {
                  setPdfDownloading(true);
                  try {
                    const res = await fetch(`/api/quotes/${savedQuoteId}/pdf`);
                    if (!res.ok) throw new Error("PDF generation failed");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    const lastName = patientName.split(" ").pop() || "Patient";
                    a.href = url;
                    a.download = `Quote-${quoteNumber || "Draft"}-${lastName}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch {
                    setToast({ message: "Failed to download PDF", type: "error" });
                  } finally {
                    setPdfDownloading(false);
                  }
                }}
                disabled={pdfDownloading}
                data-testid="download-pdf-button"
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  cursor: pdfDownloading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: pdfDownloading ? 0.6 : 1,
                }}
              >
                <Download size={14} />
                {pdfDownloading ? "Generating..." : "PDF"}
              </button>
            </>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || isSaving}
            data-testid="save-draft-button"
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              cursor: canSave && !isSaving ? "pointer" : "not-allowed",
              opacity: canSave && !isSaving ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Save size={14} />
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
          {status === "DRAFT" && (
            <button
              onClick={() => markAsSentMutation.mutate()}
              disabled={!canSave || isSaving}
              data-testid="mark-sent-button"
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#10B981",
                color: "white",
                cursor: canSave && !isSaving ? "pointer" : "not-allowed",
                opacity: canSave && !isSaving ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Send size={14} />
              Mark as Sent
            </button>
          )}
          {canConvert && (
            <button
              onClick={() => setShowConvertModal(true)}
              disabled={isSaving || convertMutation.isPending}
              data-testid="convert-to-invoice-button"
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#8B5CF6",
                color: "white",
                cursor: isSaving || convertMutation.isPending ? "not-allowed" : "pointer",
                opacity: isSaving || convertMutation.isPending ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FileCheck size={14} />
              Accept & Convert to Invoice
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 60%", minWidth: 0 }}>
          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "10px",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px",
              }}
            >
              Quote Details
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ position: "relative" }} ref={patientSearchRef}>
                <label style={labelStyle}>Patient <span style={{ color: "#EF4444" }}>*</span></label>
                {patientId ? (
                  <div
                    style={{
                      ...inputStyle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "var(--bg-secondary)",
                    }}
                    data-testid="patient-display"
                  >
                    <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>
                      {patientName}
                    </span>
                    {!isFromDeal && !isFromPatient && !isEditing && (
                      <button
                        onClick={() => {
                          setPatientId(null);
                          setPatientName("");
                          setDealId(null);
                          setDealTitle("");
                        }}
                        data-testid="clear-patient"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          padding: "2px",
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={14}
                        style={{
                          position: "absolute",
                          left: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                        }}
                      />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          setShowPatientDropdown(true);
                        }}
                        onFocus={() => patientSearch.length >= 2 && setShowPatientDropdown(true)}
                        placeholder="Search patients..."
                        data-testid="input-patient-search"
                        style={{ ...inputStyle, paddingLeft: "32px" }}
                      />
                    </div>
                    {showPatientDropdown && debouncedPatientSearch.length >= 1 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          backgroundColor: "var(--bg-primary)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          maxHeight: "240px",
                          overflowY: "auto",
                          marginTop: "4px",
                        }}
                      >
                        {isSearching ? (
                          <div data-testid="search-loading" style={{ padding: "14px 12px", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
                            Searching...
                          </div>
                        ) : isSearchError ? (
                          <div data-testid="search-error" style={{ padding: "14px 12px", fontSize: "13px", color: "#EF4444", textAlign: "center" }}>
                            Search failed — try again
                          </div>
                        ) : patientSearchResults?.patients?.length > 0 ? (
                          patientSearchResults.patients.map((p: any) => (
                            <button
                              key={p.id}
                              onClick={() => selectPatient(p)}
                              data-testid={`patient-option-${p.id}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                width: "100%",
                                padding: "10px 12px",
                                border: "none",
                                backgroundColor: "transparent",
                                cursor: "pointer",
                                textAlign: "left",
                                borderBottom: "1px solid var(--border-default)",
                              }}
                            >
                              <div style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                backgroundColor: "#ECFDF5",
                                color: "#065F46",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}>
                                {(p.firstName?.[0] || "").toUpperCase()}{(p.lastName?.[0] || "").toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                                  {p.firstName} {p.lastName}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                                  {p.email || p.phone || ""}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div data-testid="no-patients-found" style={{ padding: "14px 12px", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
                            No patients found
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label style={labelStyle}>Deal</label>
                {isFromDeal || (isEditing && dealId) ? (
                  <div
                    style={{
                      ...inputStyle,
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: "var(--bg-secondary)",
                    }}
                    data-testid="deal-display"
                  >
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      {dealTitle || "Linked deal"}
                    </span>
                  </div>
                ) : patientId && !dealId ? (
                  <div>
                    {patientDeals?.deals?.length > 0 ? (
                      <select
                        value={dealId || ""}
                        onChange={(e) => {
                          const d = patientDeals.deals.find((dd: any) => dd.id === e.target.value);
                          if (d) selectDealFromPatient(d);
                        }}
                        data-testid="select-deal"
                        style={inputStyle}
                      >
                        <option value="">Select a deal...</option>
                        {patientDeals.deals.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.title} — {d.stage?.name || ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ ...inputStyle, backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", fontSize: "12px" }} data-testid="no-deals-message">
                        No open deals — <a href="/pipeline?addDeal=true" style={{ color: "var(--brand-primary)", textDecoration: "underline" }}>create a deal first</a>
                      </div>
                    )}
                  </div>
                ) : dealId ? (
                  <div
                    style={{
                      ...inputStyle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "var(--bg-secondary)",
                    }}
                    data-testid="deal-display"
                  >
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{dealTitle}</span>
                    <button
                      onClick={() => { setDealId(null); setDealTitle(""); }}
                      data-testid="clear-deal"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ ...inputStyle, backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }} data-testid="deal-placeholder">
                    Select a patient first
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Coordinator</label>
                <select
                  value={coordinatorId || ""}
                  onChange={(e) => setCoordinatorId(e.target.value || null)}
                  data-testid="select-coordinator"
                  style={inputStyle}
                >
                  <option value="">Select coordinator...</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Expiration <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                  {(["30", "60", "90", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyExpirationPreset(preset)}
                      data-testid={`expiration-preset-${preset}`}
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        fontWeight: 500,
                        borderRadius: "6px",
                        border: expirationPreset === preset ? "1px solid var(--brand-primary)" : "1px solid var(--border-default)",
                        backgroundColor: expirationPreset === preset ? "rgba(16,185,129,0.1)" : "var(--bg-secondary)",
                        color: expirationPreset === preset ? "var(--brand-primary)" : "var(--text-secondary)",
                        cursor: "pointer",
                        flex: 1,
                      }}
                    >
                      {preset === "custom" ? "Custom" : `${preset}d`}
                    </button>
                  ))}
                </div>
                {expirationPreset === "custom" ? (
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    data-testid="input-expiration-date"
                    style={inputStyle}
                  />
                ) : (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }} data-testid="expiration-display">
                    {expirationDate ? `Expires on ${new Date(expirationDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "10px",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
                gap: "8px",
              }}
            >
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Line Items
              </h2>
            </div>

            {lineItems.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}
                  data-testid="line-items-table"
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Description</th>
                      <th style={{ ...thStyle, width: "60px", textAlign: "center" }}>Qty</th>
                      <th style={{ ...thStyle, width: "100px" }}>Unit Price</th>
                      {showHoursColumn && (
                        <th style={{ ...thStyle, width: "60px", textAlign: "center" }}>Hours</th>
                      )}
                      <th style={{ ...thStyle, width: "120px" }}>Provider</th>
                      <th style={{ ...thStyle, width: "110px" }}>Discount</th>
                      <th style={{ ...thStyle, width: "90px", textAlign: "right" }}>Total</th>
                      <th style={{ ...thStyle, width: "36px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li) => (
                      <LineItemRow
                        key={li.id}
                        item={li}
                        providers={providers}
                        showHoursColumn={showHoursColumn}
                        onUpdate={updateLineItem}
                        onRemove={removeLineItem}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {lineItems.length === 0 && (
              <div
                style={{
                  padding: "32px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
                data-testid="empty-line-items"
              >
                No line items yet. Add products or services below.
              </div>
            )}

            <div style={{ marginTop: "12px", position: "relative" }} ref={productSearchRef}>
              <button
                onClick={() => setShowProductDropdown((v) => !v)}
                data-testid="add-line-item-button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "1px dashed var(--border-default)",
                  backgroundColor: "transparent",
                  color: "var(--brand-primary)",
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Add Line Item
              </button>

              {showProductDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    zIndex: 50,
                    width: "360px",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    marginTop: "4px",
                  }}
                  data-testid="product-dropdown"
                >
                  <div style={{ padding: "8px", borderBottom: "1px solid var(--border-default)" }}>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={14}
                        style={{
                          position: "absolute",
                          left: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                        }}
                      />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products & services..."
                        data-testid="input-product-search"
                        autoFocus
                        style={{
                          ...inputStyle,
                          paddingLeft: "32px",
                          margin: 0,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                    {filteredProducts.length === 0 ? (
                      <div
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        No products found
                      </div>
                    ) : (
                      filteredProducts.map((product: any) => (
                        <button
                          key={product.id}
                          onClick={() => addProductAsLineItem(product)}
                          data-testid={`product-option-${product.id}`}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 12px",
                            border: "none",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                            borderBottom: "1px solid var(--border-default)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "var(--text-primary)",
                              }}
                            >
                              {product.name}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              {product.itemType === "SERVICE_HOURLY"
                                ? `${formatCurrency(Number(product.hourlyRate) || 0)}/hr`
                                : product.itemType === "SERVICE_TIERED"
                                ? "Tiered"
                                : formatCurrency(Number(product.price) || 0)}
                            </span>
                          </div>
                          {product.description && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                                marginTop: "2px",
                              }}
                            >
                              {product.description}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "10px",
              padding: "20px",
              marginTop: "20px",
            }}
          >
            <h2
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px",
              }}
            >
              Notes
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Internal Notes (hidden from patient)</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  data-testid="input-internal-notes"
                  style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Patient Notes (shown on quote)</label>
                <textarea
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  rows={2}
                  data-testid="input-patient-notes"
                  style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: "0 0 calc(40% - 24px)", minWidth: 0 }}>
          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "10px",
              padding: "20px",
              position: "sticky",
              top: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 20px",
              }}
            >
              Totals
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Subtotal</span>
                <span
                  style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}
                  data-testid="subtotal-display"
                >
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Discount</span>
                  <span style={{ fontSize: "13px", color: "#EF4444" }} data-testid="discount-display">
                    {quoteLevelDiscount > 0 ? `-${formatCurrency(quoteLevelDiscount)}` : "$0.00"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quoteLevelDiscountValue || ""}
                    onChange={(e) =>
                      setQuoteLevelDiscountValue(parseFloat(e.target.value) || 0)
                    }
                    data-testid="input-quote-discount"
                    style={{ ...inputStyle, flex: 1, margin: 0 }}
                    placeholder="0"
                  />
                  <div
                    style={{
                      display: "flex",
                      borderRadius: "6px",
                      border: "1px solid var(--border-default)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => setQuoteLevelDiscountType("FIXED")}
                      data-testid="discount-type-fixed"
                      style={{
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 500,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor:
                          quoteLevelDiscountType === "FIXED"
                            ? "var(--brand-primary)"
                            : "var(--bg-secondary)",
                        color:
                          quoteLevelDiscountType === "FIXED" ? "white" : "var(--text-secondary)",
                      }}
                    >
                      $
                    </button>
                    <button
                      onClick={() => setQuoteLevelDiscountType("PERCENTAGE")}
                      data-testid="discount-type-percent"
                      style={{
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 500,
                        border: "none",
                        borderLeft: "1px solid var(--border-default)",
                        cursor: "pointer",
                        backgroundColor:
                          quoteLevelDiscountType === "PERCENTAGE"
                            ? "var(--brand-primary)"
                            : "var(--bg-secondary)",
                        color:
                          quoteLevelDiscountType === "PERCENTAGE"
                            ? "white"
                            : "var(--text-secondary)",
                      }}
                    >
                      %
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Tax</span>
                  {taxRate != null ? (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      ({taxRate}%)
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        color: "#F59E0B",
                      }}
                      data-testid="tax-warning"
                    >
                      <AlertTriangle size={12} />
                      No rate set
                    </span>
                  )}
                </div>
                <span
                  style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}
                  data-testid="tax-display"
                >
                  {formatCurrency(taxAmount)}
                </span>
              </div>

              <div
                style={{
                  borderTop: "2px solid var(--border-default)",
                  paddingTop: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}
                >
                  TOTAL
                </span>
                <span
                  style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}
                  data-testid="total-display"
                >
                  {formatCurrency(total)}
                </span>
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border-default)",
                  paddingTop: "16px",
                  marginTop: "4px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Deposit
                  </span>
                  <span
                    style={{ fontSize: "13px", fontWeight: 500, color: "var(--brand-primary)" }}
                    data-testid="deposit-amount-display"
                  >
                    {formatCurrency(depositAmount)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositValue || ""}
                    onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                    data-testid="input-deposit-value"
                    style={{ ...inputStyle, flex: 1, margin: 0 }}
                    placeholder="20"
                  />
                  <div
                    style={{
                      display: "flex",
                      borderRadius: "6px",
                      border: "1px solid var(--border-default)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => setDepositType("FLAT")}
                      data-testid="deposit-type-flat"
                      style={{
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 500,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor:
                          depositType === "FLAT" ? "var(--brand-primary)" : "var(--bg-secondary)",
                        color: depositType === "FLAT" ? "white" : "var(--text-secondary)",
                      }}
                    >
                      $
                    </button>
                    <button
                      onClick={() => setDepositType("PERCENTAGE")}
                      data-testid="deposit-type-percent"
                      style={{
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 500,
                        border: "none",
                        borderLeft: "1px solid var(--border-default)",
                        cursor: "pointer",
                        backgroundColor:
                          depositType === "PERCENTAGE"
                            ? "var(--brand-primary)"
                            : "var(--bg-secondary)",
                        color: depositType === "PERCENTAGE" ? "white" : "var(--text-secondary)",
                      }}
                    >
                      %
                    </button>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border-default)",
                  paddingTop: "14px",
                  marginTop: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Financing Available
                </span>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    marginTop: "6px",
                  }}
                  data-testid="financing-info"
                >
                  CareCredit &bull; Cherry &bull; PatientFi
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConvertModal && (
        <div
          data-testid="convert-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !convertMutation.isPending) setShowConvertModal(false);
          }}
        >
          <div
            data-testid="convert-modal"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "440px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              animation: "slideInToast 200ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(139,92,246,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileCheck size={18} style={{ color: "#8B5CF6" }} />
              </div>
              <div>
                <h3
                  style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}
                  data-testid="convert-modal-title"
                >
                  Convert to Invoice
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                  This will accept the quote and create an invoice
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "8px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>
                    Quote
                  </div>
                  <div
                    style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}
                    data-testid="convert-modal-quote-number"
                  >
                    {quoteNumber || "Draft"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>
                    Patient
                  </div>
                  <div
                    style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}
                    data-testid="convert-modal-patient"
                  >
                    {patientName}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>
                    Line Items
                  </div>
                  <div
                    style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}
                    data-testid="convert-modal-line-items"
                  >
                    {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>
                    Total
                  </div>
                  <div
                    style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}
                    data-testid="convert-modal-total"
                  >
                    {formatCurrency(total)}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                backgroundColor: "rgba(139,92,246,0.06)",
                borderRadius: "6px",
                marginBottom: "20px",
              }}
            >
              <FileText size={14} style={{ color: "#8B5CF6", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                The quote status will be set to <strong>Converted</strong> and a new invoice will be created with all line items copied over.
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={convertMutation.isPending}
                data-testid="convert-modal-cancel"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  cursor: convertMutation.isPending ? "not-allowed" : "pointer",
                  opacity: convertMutation.isPending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                data-testid="convert-modal-confirm"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#8B5CF6",
                  color: "white",
                  cursor: convertMutation.isPending ? "not-allowed" : "pointer",
                  opacity: convertMutation.isPending ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {convertMutation.isPending ? (
                  <>
                    <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                    Converting...
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Confirm & Convert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          data-testid="toast-message"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            color: "white",
            backgroundColor: toast.type === "success" ? "#10B981" : "#EF4444",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 9999,
            animation: "slideInToast 200ms ease",
          }}
        >
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes slideInToast { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function LineItemRow({
  item,
  providers,
  showHoursColumn,
  onUpdate,
  onRemove,
}: {
  item: LineItem;
  providers: UserData[];
  showHoursColumn: boolean;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onRemove: (id: string) => void;
}) {
  const lineTotal = calcLineTotal(item);
  const isHourly = item.itemType === "SERVICE_HOURLY" || item.itemType === "SERVICE_TIERED";
  const isBundle = item.itemType === "BUNDLE";
  const isTiered = item.itemType === "SERVICE_TIERED";

  let tieredBreakdown = "";
  if (isTiered && item.tieredBaseRate != null && item.tieredSubRate != null && item.hours) {
    const addHrs = Math.max(0, item.hours - 1);
    if (addHrs > 0) {
      tieredBreakdown = `${formatCurrency(item.tieredBaseRate)} + (${formatCurrency(
        item.tieredSubRate
      )} x ${addHrs}hr${addHrs !== 1 ? "s" : ""}) = ${formatCurrency(lineTotal)}`;
    } else {
      tieredBreakdown = `Base: ${formatCurrency(item.tieredBaseRate)}`;
    }
  }

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid var(--border-default)" }}
        data-testid={`line-item-row-${item.id}`}
      >
        <td style={tdStyle}>
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
            data-testid={`line-item-name-${item.id}`}
            style={{ ...compactInputStyle, width: "100%", minWidth: "100px" }}
          />
        </td>
        <td style={tdStyle}>
          <input
            type="text"
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            data-testid={`line-item-desc-${item.id}`}
            style={{ ...compactInputStyle, width: "100%", minWidth: "80px" }}
            placeholder="..."
          />
        </td>
        <td style={{ ...tdStyle, textAlign: "center" }}>
          <input
            type="number"
            min="1"
            step="1"
            value={item.quantity}
            onChange={(e) => onUpdate(item.id, { quantity: parseInt(e.target.value) || 1 })}
            data-testid={`line-item-qty-${item.id}`}
            style={{ ...compactInputStyle, width: "50px", textAlign: "center" }}
          />
        </td>
        <td style={tdStyle}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.unitPrice || ""}
            onChange={(e) => onUpdate(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
            data-testid={`line-item-price-${item.id}`}
            style={{ ...compactInputStyle, width: "90px" }}
          />
        </td>
        {showHoursColumn && (
          <td style={{ ...tdStyle, textAlign: "center" }}>
            {isHourly ? (
              <input
                type="number"
                min="0"
                step="0.5"
                value={item.hours ?? ""}
                onChange={(e) =>
                  onUpdate(item.id, { hours: parseFloat(e.target.value) || null })
                }
                data-testid={`line-item-hours-${item.id}`}
                style={{ ...compactInputStyle, width: "50px", textAlign: "center" }}
              />
            ) : (
              <span style={{ color: "var(--text-muted)" }}>-</span>
            )}
          </td>
        )}
        <td style={tdStyle}>
          <select
            value={item.providerId || ""}
            onChange={(e) => onUpdate(item.id, { providerId: e.target.value || null })}
            data-testid={`line-item-provider-${item.id}`}
            style={{ ...compactInputStyle, width: "100%" }}
          >
            <option value="">-</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </td>
        <td style={tdStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.discountValue ?? ""}
              onChange={(e) =>
                onUpdate(item.id, {
                  discountValue: parseFloat(e.target.value) || null,
                  discountType: item.discountType || "FIXED",
                })
              }
              data-testid={`line-item-discount-${item.id}`}
              style={{ ...compactInputStyle, width: "55px" }}
              placeholder="0"
            />
            <button
              onClick={() =>
                onUpdate(item.id, {
                  discountType:
                    item.discountType === "PERCENTAGE" ? "FIXED" : "PERCENTAGE",
                })
              }
              data-testid={`line-item-discount-toggle-${item.id}`}
              style={{
                padding: "4px 6px",
                fontSize: "11px",
                fontWeight: 600,
                border: "1px solid var(--border-default)",
                borderRadius: "4px",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                minWidth: "24px",
                textAlign: "center",
              }}
            >
              {item.discountType === "PERCENTAGE" ? "%" : "$"}
            </button>
          </div>
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          <span
            style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "13px" }}
            data-testid={`line-item-total-${item.id}`}
          >
            {formatCurrency(lineTotal)}
          </span>
        </td>
        <td style={tdStyle}>
          <button
            onClick={() => onRemove(item.id)}
            data-testid={`line-item-remove-${item.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </td>
      </tr>
      {isTiered && tieredBreakdown && (
        <tr>
          <td
            colSpan={showHoursColumn ? 9 : 8}
            style={{
              padding: "4px 10px 8px 10px",
              fontSize: "11px",
              color: "var(--text-muted)",
              fontStyle: "italic",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            {tieredBreakdown}
          </td>
        </tr>
      )}
      {isBundle && (
        <tr>
          <td
            colSpan={showHoursColumn ? 9 : 8}
            style={{
              padding: "2px 10px 8px 10px",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <button
              onClick={() => onUpdate(item.id, { showComponents: !item.showComponents })}
              data-testid={`toggle-components-${item.id}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--brand-primary)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 0",
              }}
            >
              {item.showComponents ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {item.showComponents ? "Hide" : "Show"} components (
              {item.bundleComponents?.length || 0})
            </button>
            {item.showComponents && item.bundleComponents?.length > 0 && (
              <div style={{ marginTop: "4px", paddingLeft: "16px" }}>
                {item.bundleComponents.map((bc: any) => (
                  <div
                    key={bc.id || bc.itemId}
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      padding: "3px 0",
                      borderLeft: "2px solid var(--border-default)",
                      paddingLeft: "8px",
                      marginBottom: "2px",
                    }}
                    data-testid={`bundle-component-${bc.itemId || bc.id}`}
                  >
                    {bc.item?.name || bc.name || "Component"}
                    {bc.item?.price && (
                      <span style={{ marginLeft: "8px", color: "var(--text-muted)" }}>
                        {formatCurrency(Number(bc.item.price))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-secondary)",
  marginBottom: "4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  borderRadius: "6px",
  border: "1px solid var(--border-default)",
  backgroundColor: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const compactInputStyle: React.CSSProperties = {
  padding: "5px 7px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "1px solid var(--border-default)",
  backgroundColor: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "middle",
};

export default function QuoteBuilderPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              border: "3px solid var(--border-default)",
              borderTopColor: "var(--brand-primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading...</span>
        </div>
      }
    >
      <QuoteBuilderContent />
    </Suspense>
  );
}
