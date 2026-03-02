"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  X,
  Calendar,
  FileText,
  ClipboardList,
  Activity,
  User,
  Mail,
  Phone,
  ChevronRight,
  DollarSign,
  ChevronDown,
  Pencil,
  MessageSquare,
  CalendarPlus,
  CheckCircle,
  ArrowRight,
  StickyNote,
  Plus,
  Landmark,
  Link2,
  Check,
  Search,
  Trophy,
  XCircle,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import { getTagStyle, getTagPillStyle } from "@/lib/tagStyles";
import BookingModal from "@/components/appointments/BookingModal";

interface OpportunityPanelProps {
  opportunityId: string | null;
  onClose: () => void;
  onStatusChange?: () => void;
}

type TabKey = "overview" | "appointments" | "finances" | "forms";

interface PanelData {
  id: string;
  title: string;
  value: number | null;
  conversionType: string | null;
  referralSource: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  stageEnteredAt: string | null;
  assignedToId: string | null;
  providerId: string | null;
  patientId: string;
  pipelineId: string;
  stageId: string;
  isWon: boolean;
  isLost: boolean;
  closedStatus: "WON" | "LOST" | null;
  closedLostReason: string | null;
  lostNote: string | null;
  closedAt: string | null;
  pipelineStages: {
    id: string;
    name: string;
    color: string | null;
    order: number;
    isWon: boolean;
    isLost: boolean;
  }[];
  allPipelines: {
    id: string;
    name: string;
  }[];
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    status: string;
    isVip: boolean;
    tags: string[];
    dateOfBirth: string | null;
    referralSource: string | null;
  };
  opportunityProcedures: {
    id: string;
    procedureType: { id: string; name: string; category: string };
  }[];
  stage: { name: string; color: string; order: number };
  pipeline: { name: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  provider: { id: string; firstName: string; lastName: string } | null;
  appointments: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    appointmentCategory: string | null;
    provider: { id: string; firstName: string; lastName: string } | null;
  }[];
  quotes: {
    id: string;
    quoteNumber: string | null;
    title: string | null;
    total: any;
    status: string;
    createdAt: string;
    expirationDate: string | null;
    coordinator: { id: string; firstName: string; lastName: string } | null;
    lineItems: { id: string; name: string; unitPrice: any; quantity: any }[];
  }[];
  forms: {
    id: string;
    formName: string;
    status: string;
    sentAt: string | null;
    completedAt: string | null;
    createdAt: string;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string | null;
    description: string | null;
    total: any;
    amountPaid: any;
    balanceDue: any;
    status: string;
    createdAt: string;
    dueDate: string | null;
    quoteId: string | null;
    quote: { id: string; status: string; quoteNumber: string | null } | null;
    coordinator: { id: string; firstName: string; lastName: string } | null;
    payments: {
      id: string;
      amount: any;
      paymentDate: string;
      method: string;
      referenceNumber: string | null;
      notes: string | null;
      recorder: { id: string; firstName: string; lastName: string } | null;
    }[];
  }[];
  activities: {
    id: string;
    type: string;
    body: string | null;
    createdAt: string;
    metadata: any;
    user: { firstName: string; lastName: string } | null;
  }[];
  users: { id: string; firstName: string; lastName: string; role: string }[];
}

const tabs: { key: TabKey; label: string; icon: typeof Calendar }[] = [
  { key: "overview", label: "Overview", icon: ClipboardList },
  { key: "appointments", label: "Appointments", icon: Calendar },
  { key: "finances", label: "Finances", icon: Landmark },
  { key: "forms", label: "Forms", icon: FileText },
];

const mono: React.CSSProperties = { fontFamily: "var(--font-geist-mono), monospace" };

function formatCurrency(val: number | any): string {
  const n = Number(val);
  if (isNaN(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return formatShortDate(dateStr);
}

function isWithin7Days(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < new Date().setHours(0, 0, 0, 0);
}

// Toast
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      data-testid="toast-message"
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: type === "success" ? "#10B981" : "#EF4444",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        animation: "toastSlideUp 250ms ease-out",
        whiteSpace: "nowrap",
      }}
    >
      {message}
    </div>
  );
}

export default function OpportunityPanel({ opportunityId, onClose, onStatusChange }: OpportunityPanelProps) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [bookingModal, setBookingModal] = useState<{ open: boolean; prefill?: any }>({ open: false });
  const [appointmentsRefreshKey, setAppointmentsRefreshKey] = useState(0);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${id}/panel`);
      if (!res.ok) throw new Error("Failed to load deal");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (opportunityId) {
      setActiveTab("overview");
      fetchData(opportunityId);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const timer = setTimeout(() => setData(null), 300);
      return () => clearTimeout(timer);
    }
  }, [opportunityId, fetchData]);

  useEffect(() => {
    if (!opportunityId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [opportunityId, onClose]);

  if (!opportunityId && !data) return null;

  return (
    <div
      data-testid="opportunity-panel-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastSlideUp { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      <div
        data-testid="opportunity-panel-backdrop"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
          opacity: visible ? 1 : 0,
          transition: "opacity 250ms ease-out",
        }}
      />

      <div
        data-testid="opportunity-panel"
        style={{
          position: "relative",
          width: "480px",
          maxWidth: "100vw",
          height: "100%",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.12)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms ease-out",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {loading && (
          <div data-testid="panel-loading" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid var(--border-default)", borderTopColor: "#10B981", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading...</span>
          </div>
        )}

        {error && !loading && (
          <div data-testid="panel-error" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", padding: "40px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={20} style={{ color: "#EF4444" }} />
            </div>
            <span style={{ fontSize: "14px", color: "var(--text-secondary)", textAlign: "center" }}>{error}</span>
            <button data-testid="button-retry" onClick={() => opportunityId && fetchData(opportunityId)} style={{ fontSize: "13px", fontWeight: 600, color: "#10B981", background: "none", border: "1px solid #10B981", borderRadius: "6px", padding: "6px 16px", cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {data && !loading && !error && (
          <>
            <PanelHeader data={data} setData={setData} onClose={onClose} showToast={showToast} onStatusChange={onStatusChange} />

            <div className="flex" style={{ borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    data-testid={`tab-${tab.key}`}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      padding: "10px 0",
                      fontSize: "12px",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#10B981" : "var(--text-muted)",
                      background: "none",
                      border: "none",
                      borderBottom: isActive ? "2px solid #10B981" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "color 150ms, border-color 150ms",
                    }}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {activeTab === "overview" && <OverviewTab data={data} showToast={showToast} setActiveTab={setActiveTab} onBookAppointment={() => {
                setBookingModal({
                  open: true,
                  prefill: {
                    patientId: data.patient.id,
                    patientName: `${data.patient.firstName} ${data.patient.lastName}`,
                    dealId: data.id,
                    dealTitle: data.title,
                    providerId: data.assignedTo?.id || data.provider?.id || undefined,
                    lockPatient: true,
                    lockDeal: true,
                  },
                });
              }} />}
              {activeTab === "appointments" && (
                <AppointmentsTab
                  data={data}
                  showToast={showToast}
                  refreshKey={appointmentsRefreshKey}
                  onBookAppointment={() => {
                    setBookingModal({
                      open: true,
                      prefill: {
                        patientId: data.patient.id,
                        patientName: `${data.patient.firstName} ${data.patient.lastName}`,
                        dealId: data.id,
                        dealTitle: data.title,
                        providerId: data.assignedTo?.id || data.provider?.id || undefined,
                        lockPatient: true,
                        lockDeal: true,
                      },
                    });
                  }}
                  onEditAppointment={(appointmentId: string) => {
                    setBookingModal({
                      open: true,
                      prefill: { appointmentId },
                    });
                  }}
                />
              )}
              {activeTab === "finances" && <FinancesTab data={data} showToast={showToast} />}
              {activeTab === "forms" && <FormsTab forms={data.forms} showToast={showToast} />}
            </div>

            <AuditLogTrigger activities={data.activities} />
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <BookingModal
        isOpen={bookingModal.open}
        onClose={() => setBookingModal({ open: false })}
        onSaved={() => {
          setAppointmentsRefreshKey((k) => k + 1);
          if (opportunityId) fetchData(opportunityId);
          showToast("Appointment saved");
        }}
        prefill={bookingModal.prefill}
      />
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────
function PanelHeader({
  data,
  setData,
  onClose,
  showToast,
  onStatusChange,
}: {
  data: PanelData;
  setData: React.Dispatch<React.SetStateAction<PanelData | null>>;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  onStatusChange?: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(data.title);
  const [savedFlash, setSavedFlash] = useState(false);
  const [coordOpen, setCoordOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [wonConfirmOpen, setWonConfirmOpen] = useState(false);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [pipelineDropdownOpen, setPipelineDropdownOpen] = useState(false);
  const [practiceTags, setPracticeTags] = useState<{ id: string; name: string; color: string; emoji: string | null }[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const coordRef = useRef<HTMLDivElement>(null);
  const provRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleValue(data.title);
  }, [data.title]);

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

  useEffect(() => {
    fetch("/api/practices/tags").then(r => r.json()).then(setPracticeTags).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (coordRef.current && !coordRef.current.contains(e.target as Node)) setCoordOpen(false);
      if (provRef.current && !provRef.current.contains(e.target as Node)) setProviderOpen(false);
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagDropdownOpen(false);
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) setStageDropdownOpen(false);
      if (pipelineRef.current && !pipelineRef.current.contains(e.target as Node)) setPipelineDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const saveTitle = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === data.title) {
      setEditingTitle(false);
      setTitleValue(data.title);
      return;
    }
    try {
      const res = await fetch(`/api/opportunities/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => prev ? { ...prev, title: trimmed } : prev);
      setEditingTitle(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1000);
    } catch {
      showToast("Failed to save title", "error");
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
    if (e.key === "Escape") { setEditingTitle(false); setTitleValue(data.title); }
  };

  const patchOpportunity = async (field: string, value: string | null) => {
    try {
      const res = await fetch(`/api/opportunities/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      if (field === "coordinatorId") {
        setData((prev) => prev ? { ...prev, assignedTo: updated.assignedTo, assignedToId: value } : prev);
      } else if (field === "providerId") {
        setData((prev) => prev ? { ...prev, provider: updated.provider, providerId: value } : prev);
      }
    } catch {
      showToast("Failed to update", "error");
    }
  };

  const changePipeline = async (newPipelineId: string) => {
    if (newPipelineId === data.pipelineId) {
      setPipelineDropdownOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/opportunities/${data.id}/pipeline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: newPipelineId }),
      });
      if (!res.ok) throw new Error();
      setPipelineDropdownOpen(false);
      showToast("Pipeline updated");
      onStatusChange?.();
      const panelRes = await fetch(`/api/opportunities/${data.id}/panel`);
      if (panelRes.ok) {
        const fresh = await panelRes.json();
        setData(fresh);
      }
    } catch {
      showToast("Failed to switch pipeline", "error");
    }
  };

  const changeStage = async (stageId: string) => {
    try {
      const res = await fetch(`/api/opportunities/${data.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      const newStage = data.pipelineStages.find((s) => s.id === stageId);
      if (newStage) {
        setData((prev) => prev ? { ...prev, stageId, stage: { name: newStage.name, color: newStage.color || "#6B7280", order: newStage.order } } : prev);
      }
      setStageDropdownOpen(false);
      onStatusChange?.();
    } catch {
      showToast("Failed to move stage", "error");
    }
  };

  const markWon = async () => {
    try {
      const res = await fetch(`/api/opportunities/${data.id}/won`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      setData((prev) => prev ? { ...prev, closedStatus: "WON", isWon: true, isLost: false, closedAt: new Date().toISOString() } : prev);
      setWonConfirmOpen(false);
      showToast("Deal marked as Won");
      onStatusChange?.();
    } catch {
      showToast("Failed to mark as won", "error");
    }
  };

  const markLost = async (reason: string, note: string) => {
    try {
      const res = await fetch(`/api/opportunities/${data.id}/lost`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => prev ? { ...prev, closedStatus: "LOST", isWon: false, isLost: true, closedLostReason: reason, lostNote: note || null, closedAt: new Date().toISOString() } : prev);
      setLostModalOpen(false);
      showToast("Deal marked as Lost");
      onStatusChange?.();
    } catch {
      showToast("Failed to mark as lost", "error");
    }
  };

  const reopenOpportunity = async () => {
    try {
      const res = await fetch(`/api/opportunities/${data.id}/reopen`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      setData((prev) => prev ? { ...prev, closedStatus: null, isWon: false, isLost: false, closedLostReason: null, lostNote: null, closedAt: null } : prev);
      showToast("Deal reopened");
      onStatusChange?.();
    } catch {
      showToast("Failed to reopen", "error");
    }
  };

  const saveTags = async (newTags: string[]) => {
    try {
      const res = await fetch(`/api/patients/${data.patient.id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => prev ? { ...prev, patient: { ...prev.patient, tags: newTags } } : prev);
    } catch {
      showToast("Failed to update tags", "error");
    }
  };

  const addTag = (tagName: string) => {
    if (!data.patient.tags.includes(tagName)) {
      saveTags([...data.patient.tags, tagName]);
    }
    setTagDropdownOpen(false);
  };

  const removeTag = (tag: string) => {
    saveTags(data.patient.tags.filter((t) => t !== tag));
  };

  const rowStyle: React.CSSProperties = { padding: "8px 20px", borderBottom: "1px solid var(--border-default)" };
  const upperLabel: React.CSSProperties = { fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Title + Close — compact */}
      <div style={{ padding: "10px 20px 6px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            {editingTitle ? (
              <input
                ref={titleRef}
                data-testid="input-edit-title"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={handleTitleKeyDown}
                style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", background: "none", border: "none", borderBottom: "2px solid #10B981", outline: "none", padding: "0 0 1px", width: "100%" }}
              />
            ) : (
              <div
                data-testid="text-opportunity-title"
                onClick={() => setEditingTitle(true)}
                style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.title}</span>
                <Pencil size={12} style={{ color: "var(--text-muted)", flexShrink: 0, visibility: "hidden" }} className="title-pencil" />
              </div>
            )}
            {savedFlash && <span style={{ fontSize: "11px", color: "#10B981", fontWeight: 600, flexShrink: 0 }}>Saved &#10003;</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {data.closedStatus ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div
                  data-testid="badge-closed-status"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: data.closedStatus === "WON" ? "#065F46" : "#991B1B",
                    backgroundColor: data.closedStatus === "WON" ? "#D1FAE5" : "#FEE2E2",
                    padding: "2px 10px",
                    borderRadius: "10px",
                  }}
                >
                  {data.closedStatus === "WON" ? <Trophy size={11} /> : <XCircle size={11} />}
                  {data.closedStatus === "WON" ? "Won" : "Lost"}
                </div>
                <button
                  data-testid="button-reopen"
                  onClick={reopenOpportunity}
                  title="Reopen this deal"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    background: "none",
                    border: "1px solid var(--border-default)",
                    borderRadius: "10px",
                    padding: "1px 8px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10B981"; e.currentTarget.style.color = "#10B981"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  <RotateCcw size={10} /> Reopen
                </button>
              </div>
            ) : (
              <div ref={stageRef} style={{ position: "relative" }}>
                <button
                  data-testid="badge-stage"
                  onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: data.stage.color,
                    backgroundColor: `${data.stage.color}15`,
                    padding: "1px 8px",
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: data.stage.color, flexShrink: 0 }} />
                  {data.stage.name}
                  <ChevronDown size={10} style={{ marginLeft: "1px" }} />
                </button>
                {stageDropdownOpen && (
                  <div
                    data-testid="stage-dropdown"
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
                      minWidth: "200px",
                      padding: "4px",
                    }}
                  >
                    {data.pipelineStages.filter(s => !s.isWon && !s.isLost).map((s) => (
                      <button
                        key={s.id}
                        data-testid={`stage-option-${s.id}`}
                        onClick={() => changeStage(s.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "7px 10px",
                          fontSize: "13px",
                          fontWeight: s.id === data.stageId ? 600 : 400,
                          color: s.id === data.stageId ? (s.color || "#10B981") : "var(--text-primary)",
                          background: "none",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.color || "#6B7280", flexShrink: 0 }} />
                        {s.name}
                        {s.id === data.stageId && <Check size={13} style={{ marginLeft: "auto", color: s.color || "#10B981" }} />}
                      </button>
                    ))}
                    <div style={{ height: "1px", backgroundColor: "var(--border-default)", margin: "4px 0" }} />
                    <div style={{ display: "flex", gap: "4px", padding: "2px" }}>
                      <button
                        data-testid="button-mark-won"
                        onClick={() => { setStageDropdownOpen(false); setWonConfirmOpen(true); }}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          padding: "7px 0",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#065F46",
                          backgroundColor: "#D1FAE5",
                          border: "1px solid #A7F3D0",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#A7F3D0"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#D1FAE5"; }}
                      >
                        <Trophy size={12} /> Won
                      </button>
                      <button
                        data-testid="button-mark-lost"
                        onClick={() => { setStageDropdownOpen(false); setLostModalOpen(true); }}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          padding: "7px 0",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#991B1B",
                          backgroundColor: "#FEE2E2",
                          border: "1px solid #FECACA",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FECACA"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FEE2E2"; }}
                      >
                        <XCircle size={12} /> Lost
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={pipelineRef} style={{ position: "relative" }}>
              <button
                data-testid="button-pipeline-switcher-panel"
                onClick={() => setPipelineDropdownOpen(!pipelineDropdownOpen)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                {data.pipeline.name}
                <ChevronDown size={9} />
              </button>
              {pipelineDropdownOpen && data.allPipelines.length > 1 && (
                <div
                  data-testid="pipeline-switcher-dropdown"
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
                    padding: "4px",
                  }}
                >
                  {data.allPipelines.map((p) => (
                    <button
                      key={p.id}
                      data-testid={`pipeline-option-${p.id}`}
                      onClick={() => changePipeline(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "7px 10px",
                        fontSize: "13px",
                        fontWeight: p.id === data.pipelineId ? 600 : 400,
                        color: p.id === data.pipelineId ? "#10B981" : "var(--text-primary)",
                        background: "none",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      {p.name}
                      {p.id === data.pipelineId && <Check size={13} style={{ marginLeft: "auto", color: "#10B981" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flexShrink: 0 }}>
          {data.value != null && (
            <div data-testid="text-value" style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", ...mono, marginTop: "1px" }}>
              {formatCurrency(data.value)}
            </div>
          )}
          <button data-testid="button-close-panel" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "3px", borderRadius: "6px" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Patient — compact inline, no card */}
      <div style={{ ...rowStyle, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", padding: "6px 20px" }}>
        <Link href={`/patients/${data.patient.id}`} data-testid="link-patient" style={{ fontSize: "13px", fontWeight: 600, color: "#10B981", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
        >
          {data.patient.firstName} {data.patient.lastName}
          <ChevronRight size={12} />
        </Link>
        {data.patient.isVip && (
          <span data-testid="badge-vip" style={{ fontSize: "10px", fontWeight: 700, color: "#065F46", backgroundColor: "#D1FAE5", padding: "1px 6px", borderRadius: "8px" }}>VIP</span>
        )}
        {data.patient.email && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "var(--text-muted)" }}>
            <Mail size={11} style={{ flexShrink: 0 }} />{data.patient.email}
          </span>
        )}
        {data.patient.phone && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "var(--text-muted)" }}>
            <Phone size={11} style={{ flexShrink: 0 }} />{formatPhoneDisplay(data.patient.phone)}
          </span>
        )}
      </div>

      {/* Coordinator + Provider + Source — 3-col compact row */}
      <div style={{ ...rowStyle, display: "flex", gap: "12px", padding: "6px 20px" }}>
        <div ref={coordRef} style={{ flex: 1, position: "relative" }}>
          <div style={upperLabel}>COORDINATOR</div>
          <button data-testid="dropdown-coordinator" onClick={() => { setCoordOpen(!coordOpen); setProviderOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
          >
            <User size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
              {data.assignedTo ? `${data.assignedTo.firstName} ${data.assignedTo.lastName}` : "\u2014"}
            </span>
            <ChevronDown size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>
          {coordOpen && (
            <UserDropdown users={data.users} selectedId={data.assignedToId} onSelect={(id) => { patchOpportunity("coordinatorId", id); setCoordOpen(false); }} />
          )}
        </div>
        <div ref={provRef} style={{ flex: 1, position: "relative" }}>
          <div style={upperLabel}>PROVIDER</div>
          <button data-testid="dropdown-provider" onClick={() => { setProviderOpen(!providerOpen); setCoordOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
          >
            <User size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
              {data.provider ? `${data.provider.firstName} ${data.provider.lastName}` : "\u2014"}
            </span>
            <ChevronDown size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>
          {providerOpen && (
            <UserDropdown users={data.users} selectedId={data.providerId} onSelect={(id) => { patchOpportunity("providerId", id); setProviderOpen(false); }} />
          )}
        </div>
      </div>

      {/* Source — compact row with chain inherit button */}
      <SourceField data={data} setData={setData} showToast={showToast} />

      {/* Tags + Procedures — tight chip rows */}
      <div style={{ padding: "5px 20px 4px", borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
          {data.patient.tags.map((tag) => {
            const ts = getTagStyle(tag);
            return (
              <span key={tag} data-testid={`tag-${tag}`} className="tag-pill-hover" style={{ ...getTagPillStyle(tag), position: "relative", cursor: "default" }}>
                {ts.emoji ? `${ts.emoji} ` : ""}{tag}
                <span data-testid={`button-remove-tag-${tag}`} className="tag-remove-btn" onClick={() => removeTag(tag)} style={{ cursor: "pointer", marginLeft: "2px", fontSize: "13px", lineHeight: 1, opacity: 0, transition: "opacity 150ms" }}>&times;</span>
              </span>
            );
          })}
          <div ref={tagRef} style={{ position: "relative" }}>
            <button data-testid="button-add-tag" onClick={() => setTagDropdownOpen(!tagDropdownOpen)} style={{ background: "none", border: "1px dashed var(--border-default)", borderRadius: "10px", padding: "1px 7px", fontSize: "10px", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px" }}>
              <Plus size={9} /> Tag
            </button>
            {tagDropdownOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-default)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100, minWidth: "180px", maxHeight: "220px", overflowY: "auto", padding: "4px" }}>
                {practiceTags.filter(pt => !data.patient.tags.includes(pt.name)).length === 0 ? (
                  <div style={{ padding: "8px 12px", fontSize: "12px", color: "var(--text-muted)" }}>All tags applied</div>
                ) : (
                  practiceTags.filter(pt => !data.patient.tags.includes(pt.name)).map(pt => (
                    <button key={pt.id} data-testid={`tag-option-${pt.name}`} onClick={() => addTag(pt.name)} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 10px", border: "none", background: "none", cursor: "pointer", borderRadius: "6px", textAlign: "left", transition: "background 150ms" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-secondary)"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <span style={getTagPillStyle(pt.name)}>{pt.emoji ? `${pt.emoji} ` : ""}{pt.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .tag-pill-hover:hover .tag-remove-btn { opacity: 1 !important; }
      `}</style>

      {/* Procedure Chips — tight */}
      <ProcedureChips data={data} setData={setData} showToast={showToast} />

      <style>{`
        .title-pencil { visibility: hidden !important; }
        [data-testid="text-opportunity-title"]:hover .title-pencil { visibility: visible !important; }
      `}</style>

      {wonConfirmOpen && (
        <WonConfirmDialog onConfirm={markWon} onCancel={() => setWonConfirmOpen(false)} />
      )}

      {lostModalOpen && (
        <LostModal onSubmit={markLost} onCancel={() => setLostModalOpen(false)} />
      )}
    </div>
  );
}

function WonConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <div
      data-testid="won-confirm-dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "12px",
        width: "360px",
        padding: "24px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        animation: "fadeUp 200ms ease-out both",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trophy size={18} style={{ color: "#065F46" }} />
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Mark as Won?</h3>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.5 }}>
          This will remove this opportunity from the active pipeline and move it to the Won column.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button data-testid="button-cancel-won" onClick={onCancel} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            data-testid="button-confirm-won"
            disabled={submitting}
            onClick={async () => { setSubmitting(true); await onConfirm(); setSubmitting(false); }}
            style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 600, color: "#FFFFFF", backgroundColor: "#10B981", border: "none", borderRadius: "6px", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LostModal({ onSubmit, onCancel }: { onSubmit: (reason: string, note: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reasons = [
    { value: "COMPETITOR", label: "Competitor" },
    { value: "PRICE_BUDGET", label: "Price / Budget" },
    { value: "UNRESPONSIVE", label: "Unresponsive" },
    { value: "NOT_A_CANDIDATE", label: "Not a Candidate" },
    { value: "DISTANCE_LOCATION", label: "Distance / Location" },
    { value: "OTHER", label: "Other" },
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "#FFFFFF",
    color: "var(--text-primary)",
  };

  return (
    <div
      data-testid="lost-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "12px",
        width: "400px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        animation: "fadeUp 200ms ease-out both",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <XCircle size={16} style={{ color: "#991B1B" }} />
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Mark as Lost</h3>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>Reason *</label>
            <select
              data-testid="select-lost-reason"
              style={{ ...inputStyle, cursor: "pointer" }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Select a reason...</option>
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>Notes</label>
            <textarea
              data-testid="input-lost-note"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any additional context..."
            />
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button data-testid="button-cancel-lost" onClick={onCancel} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            data-testid="button-confirm-lost"
            disabled={!reason || submitting}
            onClick={async () => { setSubmitting(true); await onSubmit(reason, note); setSubmitting(false); }}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: !reason || submitting ? "#9CA3AF" : "#EF4444",
              border: "none",
              borderRadius: "6px",
              cursor: !reason || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Saving..." : "Mark as Lost"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDropdown({ users, selectedId, onSelect }: { users: PanelData["users"]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <div style={{
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: "4px",
      backgroundColor: "var(--bg-primary)",
      border: "1px solid var(--border-default)",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      zIndex: 100,
      maxHeight: "200px",
      overflowY: "auto",
    }}>
      <div
        data-testid="dropdown-option-unassign"
        onClick={() => onSelect(null)}
        style={{ padding: "8px 12px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer", fontStyle: "italic" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Unassigned
      </div>
      {users.map((u) => (
        <div
          key={u.id}
          data-testid={`dropdown-option-${u.id}`}
          onClick={() => onSelect(u.id)}
          style={{
            padding: "8px 12px",
            fontSize: "13px",
            color: u.id === selectedId ? "#10B981" : "var(--text-primary)",
            fontWeight: u.id === selectedId ? 600 : 400,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          {u.firstName} {u.lastName}
          {u.role && <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "6px" }}>{u.role}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Source Field ─────────────────────────────────────────
function SourceField({
  data,
  setData,
  showToast,
}: {
  data: PanelData;
  setData: React.Dispatch<React.SetStateAction<PanelData | null>>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [leadSources, setLeadSources] = useState<{ id: string; name: string; channelType: string }[]>([]);
  const sourceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/settings/lead-sources?includeArchived=false")
      .then((r) => r.json())
      .then(setLeadSources)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) setSourceOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const saveSource = async (value: string | null) => {
    try {
      const res = await fetch(`/api/opportunities/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralSource: value }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => (prev ? { ...prev, referralSource: value } : prev));
      setSourceOpen(false);
    } catch {
      showToast("Failed to update source", "error");
    }
  };

  const inheritFromPatient = async () => {
    const patientSource = data.patient.referralSource;
    if (!patientSource) {
      showToast("Patient has no primary source set", "error");
      return;
    }
    await saveSource(patientSource);
  };

  const upperLabel: React.CSSProperties = { fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div style={{ padding: "6px 20px", borderBottom: "1px solid var(--border-default)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div ref={sourceRef} style={{ flex: 1, position: "relative" }}>
          <div style={upperLabel}>SOURCE</div>
          <button
            data-testid="dropdown-source"
            onClick={() => setSourceOpen(!sourceOpen)}
            style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: data.referralSource ? "var(--text-primary)" : "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                textAlign: "left",
                fontStyle: data.referralSource ? "normal" : "italic",
              }}
            >
              {data.referralSource || "Not set"}
            </span>
            <ChevronDown size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>
          {sourceOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 100,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              <div
                data-testid="source-option-clear"
                onClick={() => saveSource(null)}
                style={{ padding: "8px 12px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer", fontStyle: "italic" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                Clear
              </div>
              {leadSources.map((ls) => (
                <div
                  key={ls.id}
                  data-testid={`source-option-${ls.id}`}
                  onClick={() => saveSource(ls.name)}
                  style={{
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: ls.name === data.referralSource ? "#10B981" : "var(--text-primary)",
                    fontWeight: ls.name === data.referralSource ? 600 : 400,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {ls.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, paddingTop: "14px" }}>
          <button
            data-testid="button-inherit-source"
            onClick={inheritFromPatient}
            title="Inherit source from patient record"
            style={{
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              padding: "3px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#10B981";
              e.currentTarget.style.color = "#10B981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Link2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Procedure Chips ─────────────────────────────────────
function ProcedureChips({
  data,
  setData,
  showToast,
}: {
  data: PanelData;
  setData: React.Dispatch<React.SetStateAction<PanelData | null>>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allProcedures, setAllProcedures] = useState<{ id: string; name: string; category: string }[]>([]);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/settings/procedure-types?includeArchived=false")
      .then((r) => r.json())
      .then(setAllProcedures)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function generateTitle(procs: { id: string; name: string }[]): string {
    if (procs.length === 0) return "";
    if (procs.length === 1) return procs[0].name;
    if (procs.length === 2) return `${procs[0].name} + ${procs[1].name}`;
    return `${procs[0].name} + ${procs[1].name} +${procs.length - 2}`;
  }

  const currentProcIds = data.opportunityProcedures.map((op) => op.procedureType.id);

  const saveProcedures = async (newIds: string[]) => {
    const newProcs = newIds.map((id) => {
      const existing = data.opportunityProcedures.find((op) => op.procedureType.id === id);
      if (existing) return existing;
      const pt = allProcedures.find((p) => p.id === id);
      return { id: `temp_${id}`, procedureType: { id, name: pt?.name || "", category: pt?.category || "" } };
    });

    const autoTitle = generateTitle(newProcs.map((p) => ({ id: p.procedureType.id, name: p.procedureType.name })));

    try {
      const patchBody: any = { procedureTypeIds: newIds };
      if (!titleManuallyEdited && autoTitle) {
        patchBody.title = autoTitle;
      }

      const res = await fetch(`/api/opportunities/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          opportunityProcedures: updated.opportunityProcedures || newProcs,
          title: updated.title || (titleManuallyEdited ? prev.title : autoTitle || prev.title),
        };
      });
    } catch {
      showToast("Failed to update procedures", "error");
    }
  };

  const toggleProcedure = (id: string) => {
    const newIds = currentProcIds.includes(id)
      ? currentProcIds.filter((pid) => pid !== id)
      : [...currentProcIds, id];
    saveProcedures(newIds);
  };

  const removeProcedure = (id: string) => {
    saveProcedures(currentProcIds.filter((pid) => pid !== id));
  };

  return (
    <div style={{ padding: "5px 20px 4px", borderBottom: "1px solid var(--border-default)" }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>PROCEDURES</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {data.opportunityProcedures.map((op) => (
          <span
            key={op.procedureType.id}
            data-testid={`chip-proc-${op.procedureType.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "#ECFDF5",
              color: "#065F46",
              fontSize: "12px",
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: "12px",
              border: "1px solid #A7F3D0",
              lineHeight: "20px",
            }}
          >
            {op.procedureType.name}
            <button
              data-testid={`remove-proc-${op.procedureType.id}`}
              onClick={() => removeProcedure(op.procedureType.id)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", color: "#065F46" }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <div ref={pickerRef} style={{ position: "relative" }}>
          <button
            data-testid="button-add-procedure"
            onClick={() => setPickerOpen(!pickerOpen)}
            style={{
              background: "none",
              border: "1px dashed var(--border-default)",
              borderRadius: "10px",
              padding: "2px 8px",
              fontSize: "11px",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <Plus size={10} /> Procedure
          </button>
          {pickerOpen && (
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
                minWidth: "220px",
                maxHeight: "250px",
                overflowY: "auto",
              }}
            >
              {allProcedures.map((pt) => {
                const isSelected = currentProcIds.includes(pt.id);
                return (
                  <div
                    key={pt.id}
                    data-testid={`proc-option-${pt.id}`}
                    onClick={() => toggleProcedure(pt.id)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: isSelected ? "#F0FDF4" : "transparent",
                      color: "var(--text-primary)",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? "#F0FDF4" : "transparent"; }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "3px",
                        border: isSelected ? "none" : "1px solid #D1D5DB",
                        backgroundColor: isSelected ? "#10B981" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={11} color="#FFFFFF" />}
                    </div>
                    {pt.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────
function OverviewTab({
  data,
  showToast,
  setActiveTab,
  onBookAppointment,
}: {
  data: PanelData;
  showToast: (msg: string, type?: "success" | "error") => void;
  setActiveTab: (tab: TabKey) => void;
  onBookAppointment: () => void;
}) {
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [callOutcome, setCallOutcome] = useState("Answered");
  const [callReason, setCallReason] = useState("Follow-up");
  const [callNotes, setCallNotes] = useState("");
  const [callSaving, setCallSaving] = useState(false);

  const now = new Date();
  const upcomingAppt = data.appointments.find((a) => new Date(a.startTime) >= now && ["CONFIRMED", "CHECKED_IN", "UNCONFIRMED"].includes(a.status));
  const latestQuote = data.quotes[0] || null;
  const formsSnapshot = data.forms.slice(0, 3);

  const logCall = async () => {
    setCallSaving(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: data.patientId,
          opportunityId: data.id,
          type: "CALL",
          body: callNotes || null,
          metadata: { outcome: callOutcome, reason: callReason },
        }),
      });
      if (!res.ok) throw new Error();
      showToast("Call logged successfully");
      setLogCallOpen(false);
      setCallNotes("");
    } catch {
      showToast("Failed to log call", "error");
    } finally {
      setCallSaving(false);
    }
  };

  const sectionGap: React.CSSProperties = { marginBottom: "20px" };
  const sectionTitle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" };

  return (
    <div style={{ padding: "16px 20px" }}>
      {/* Next Appointment */}
      <div style={sectionGap}>
        <div style={sectionTitle}>Next Appointment</div>
        {upcomingAppt ? (
          <div
            data-testid="next-appointment-block"
            style={{
              borderLeft: "3px solid #10B981",
              backgroundColor: "rgba(16,185,129,0.05)",
              borderRadius: "0 8px 8px 0",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{
                fontSize: "13px",
                fontWeight: 600,
                color: isWithin7Days(upcomingAppt.startTime) ? "#10B981" : "var(--text-primary)",
                ...mono,
              }}>
                {formatShortDate(upcomingAppt.startTime)}
              </span>
              <StatusPill status={upcomingAppt.status} />
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              {new Date(upcomingAppt.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
              {" \u00B7 "}
              {upcomingAppt.appointmentCategory || upcomingAppt.title}
              {upcomingAppt.provider && ` \u00B7 ${upcomingAppt.provider.firstName} ${upcomingAppt.provider.lastName}`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div data-testid="text-no-upcoming-appointment" style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No upcoming appointments</div>
            <button data-testid="button-book-appointment-overview" onClick={onBookAppointment} style={{ fontSize: "12px", fontWeight: 600, color: "#10B981", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
              + Book
            </button>
          </div>
        )}
      </div>

      {/* Latest Quote */}
      <div style={sectionGap}>
        <div style={sectionTitle}>Latest Quote</div>
        {latestQuote ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span data-testid="text-latest-quote-amount" style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", ...mono }}>
                {formatCurrency(latestQuote.total)}
              </span>
              <StatusPill status={latestQuote.status} />
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", ...mono }}>
              Created {formatShortDate(latestQuote.createdAt)}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No quotes yet</div>
        )}
      </div>

      {/* Forms Snapshot */}
      <div style={sectionGap}>
        <div style={sectionTitle}>Forms</div>
        {formsSnapshot.length > 0 ? (
          <>
            {formsSnapshot.map((form) => (
              <div key={form.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                {form.status === "COMPLETED" ? (
                  <CheckCircle size={10} style={{ color: "#10B981", flexShrink: 0 }} />
                ) : (
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: form.status === "SENT" ? "#F59E0B" : "#9CA3AF",
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.formName}</span>
                <span style={{ fontSize: "11px", color: form.status === "COMPLETED" ? "#065F46" : form.status === "SENT" ? "#D97706" : "var(--text-muted)", fontWeight: form.status === "COMPLETED" ? 500 : 400 }}>
                  {form.status === "COMPLETED" ? "Completed" : form.status === "SENT" ? "Sent" : "Not Sent"}
                </span>
              </div>
            ))}
            {data.forms.length > 3 && (
              <button data-testid="button-view-all-forms" onClick={() => setActiveTab("forms")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#10B981", padding: "4px 0", marginTop: "4px" }}>
                View all &rarr;
              </button>
            )}
          </>
        ) : (
          <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No forms</div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <div style={sectionTitle}>Quick Actions</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <QuickActionBtn icon={MessageSquare} label="Text" testId="button-draft-text" onClick={() => showToast("SMS messaging coming in a future phase")} />
          <QuickActionBtn icon={Mail} label="Email" testId="button-draft-email" onClick={() => showToast("Email coming in a future phase")} />
          <QuickActionBtn icon={CalendarPlus} label="Book" testId="button-book-appt" onClick={() => showToast("Appointment booking coming in Phase 4")} />
          <QuickActionBtn icon={Phone} label="Log Call" testId="button-log-call" onClick={() => setLogCallOpen(!logCallOpen)} active={logCallOpen} />
        </div>

        {logCallOpen && (
          <div data-testid="log-call-form" style={{ marginTop: "12px", padding: "14px", backgroundColor: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>Outcome</div>
              <div style={{ display: "flex", gap: "8px" }}>
                {["Answered", "No Answer"].map((o) => (
                  <label key={o} data-testid={`radio-outcome-${o.toLowerCase().replace(" ", "-")}`} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input type="radio" name="outcome" checked={callOutcome === o} onChange={() => setCallOutcome(o)} style={{ accentColor: "#10B981" }} />
                    {o}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>Reason</div>
              <select
                data-testid="select-call-reason"
                value={callReason}
                onChange={(e) => setCallReason(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
              >
                <option value="Follow-up">Follow-up</option>
                <option value="Scheduling">Scheduling</option>
                <option value="Quote Discussion">Quote Discussion</option>
                <option value="General Inquiry">General Inquiry</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>Notes</div>
              <textarea
                data-testid="textarea-call-notes"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
                style={{ width: "100%", padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", resize: "none" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button data-testid="button-cancel-call" onClick={() => setLogCallOpen(false)} style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted)", background: "none", border: "1px solid var(--border-default)", borderRadius: "6px", padding: "6px 14px", cursor: "pointer" }}>Cancel</button>
              <button data-testid="button-submit-call" onClick={logCall} disabled={callSaving} style={{ fontSize: "13px", fontWeight: 600, color: "#fff", backgroundColor: "#10B981", border: "none", borderRadius: "6px", padding: "6px 14px", cursor: "pointer", opacity: callSaving ? 0.7 : 1 }}>
                {callSaving ? "Saving..." : "Log Call"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActionBtn({ icon: Icon, label, testId, onClick, active }: { icon: typeof Phone; label: string; testId: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        height: "48px",
        border: active ? "1px solid #10B981" : "1px solid var(--border-default)",
        borderRadius: "8px",
        backgroundColor: active ? "rgba(16,185,129,0.06)" : "#fff",
        cursor: "pointer",
        transition: "all 150ms",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "#10B981";
          e.currentTarget.style.backgroundColor = "rgba(16,185,129,0.06)";
          (e.currentTarget.querySelector(".qa-icon") as HTMLElement)?.style.setProperty("color", "#10B981");
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--border-default)";
          e.currentTarget.style.backgroundColor = "#fff";
          (e.currentTarget.querySelector(".qa-icon") as HTMLElement)?.style.setProperty("color", "var(--text-secondary)");
        }
      }}
    >
      <Icon className="qa-icon" size={18} style={{ color: active ? "#10B981" : "var(--text-secondary)", transition: "color 150ms" }} />
      <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-muted)", marginTop: "4px", lineHeight: 1 }}>{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status?.toUpperCase();
  let bg = "rgba(107,114,128,0.1)";
  let color = "#6B7280";
  if (s === "COMPLETED" || s === "ACCEPTED" || s === "CONFIRMED" || s === "PAID") { bg = "rgba(16,185,129,0.1)"; color = "#10B981"; }
  else if (s === "PENDING" || s === "UNCONFIRMED" || s === "SENT") { bg = "rgba(245,158,11,0.1)"; color = "#D97706"; }
  else if (s === "CANCELLED" || s === "NO_SHOW" || s === "EXPIRED" || s === "REJECTED") { bg = "rgba(239,68,68,0.1)"; color = "#DC2626"; }
  else if (s === "DRAFT") { bg = "rgba(107,114,128,0.1)"; color = "#6B7280"; }

  return (
    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px", backgroundColor: bg, color, flexShrink: 0, textTransform: "capitalize", whiteSpace: "nowrap" }}>
      {status?.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

// ─── Appointments Tab ────────────────────────────────────
const NEXT_STATUS_MAP: Record<string, { label: string; next: string; color: string }> = {
  CONFIRMED: { label: "Check In", next: "CHECKED_IN", color: "#10B981" },
  CHECKED_IN: { label: "Room", next: "ROOMED", color: "#3B82F6" },
  ROOMED: { label: "Start", next: "IN_PROGRESS", color: "#8B5CF6" },
  IN_PROGRESS: { label: "End", next: "ENDED", color: "#6B7280" },
  ENDED: { label: "Check Out", next: "CHECKED_OUT", color: "#6B7280" },
};

interface RealAppointment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  isInternal: boolean;
  roomName: string | null;
  notes: string | null;
  patient: { id: string; firstName: string; lastName: string } | null;
  provider: { id: string; firstName: string; lastName: string } | null;
  configuredType: { id: string; name: string; color: string; durationMins: number; bufferMins: number } | null;
  subcategory: { id: string; name: string } | null;
}

function AppointmentsTab({
  data,
  showToast,
  refreshKey,
  onBookAppointment,
  onEditAppointment,
}: {
  data: PanelData;
  showToast: (msg: string, type?: "success" | "error") => void;
  refreshKey: number;
  onBookAppointment: () => void;
  onEditAppointment: (appointmentId: string) => void;
}) {
  const [appointments, setAppointments] = useState<RealAppointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoadingAppts(true);
    try {
      const res = await fetch(`/api/opportunities/${data.id}/appointments`);
      if (res.ok) {
        const appts = await res.json();
        setAppointments(appts);
      }
    } catch {
    } finally {
      setLoadingAppts(false);
    }
  }, [data.id]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments, refreshKey]);

  const advanceStatus = async (apptId: string, nextStatus: string) => {
    setStatusUpdating(apptId);
    try {
      const res = await fetch(`/api/appointments/${apptId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        showToast("Status updated");
        fetchAppointments();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to update status", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setStatusUpdating(null);
    }
  };

  if (loadingAppts) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid var(--border-default)", borderTopColor: "#10B981", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading appointments...</div>
      </div>
    );
  }

  if (!appointments.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <Calendar size={24} style={{ color: "var(--text-muted)", opacity: 0.5, margin: "0 auto 8px" }} />
        <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>No appointments yet</div>
        <button data-testid="button-book-appointment-empty" onClick={onBookAppointment} style={{ fontSize: "13px", fontWeight: 600, color: "#10B981", background: "none", border: "1px solid #10B981", borderRadius: "6px", padding: "6px 16px", cursor: "pointer" }}>
          + Book Appointment
        </button>
      </div>
    );
  }

  const sorted = [...appointments].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const nowMs = Date.now();

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ marginBottom: "12px" }}>
        <button data-testid="button-book-appointment" onClick={onBookAppointment} style={{ fontSize: "13px", fontWeight: 600, color: "#10B981", background: "none", border: "1px solid #10B981", borderRadius: "6px", padding: "6px 16px", cursor: "pointer", width: "100%" }}>
          + Book Appointment
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {sorted.map((appt) => {
          const past = new Date(appt.startTime).getTime() < nowMs;
          const soon = isWithin7Days(appt.startTime);
          const nextAction = !past ? NEXT_STATUS_MAP[appt.status] : undefined;
          const typeName = appt.configuredType?.name || appt.title;
          const typeColor = appt.configuredType?.color || "#6B7280";

          return (
            <div
              key={appt.id}
              data-testid={`appointment-row-${appt.id}`}
              onClick={() => onEditAppointment(appt.id)}
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "background-color 150ms",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-secondary, rgba(0,0,0,0.03))"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: past ? "var(--text-muted)" : (soon ? "#10B981" : "var(--text-primary)"),
                      ...mono,
                    }}>
                      {formatShortDate(appt.startTime)}
                    </span>
                    <span style={{ fontSize: "12px", color: past ? "var(--text-muted)" : "var(--text-secondary)", ...mono }}>
                      {new Date(appt.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: typeColor, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: past ? "var(--text-muted)" : "var(--text-secondary)" }}>
                      {typeName}
                    </span>
                    {appt.provider && (
                      <>
                        <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>&middot;</span>
                        <span style={{ fontSize: "12px", color: past ? "var(--text-muted)" : "var(--text-secondary)" }}>
                          {appt.provider.firstName} {appt.provider.lastName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <StatusPill status={appt.status} />
                </div>
              </div>
              {nextAction && (
                <div style={{ marginTop: "6px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    data-testid={`button-status-${appt.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      advanceStatus(appt.id, nextAction.next);
                    }}
                    disabled={statusUpdating === appt.id}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: nextAction.color,
                      background: "none",
                      border: `1px solid ${nextAction.color}`,
                      borderRadius: "4px",
                      padding: "2px 10px",
                      cursor: statusUpdating === appt.id ? "not-allowed" : "pointer",
                      opacity: statusUpdating === appt.id ? 0.5 : 1,
                    }}
                  >
                    {statusUpdating === appt.id ? "..." : nextAction.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Finances Tab ────────────────────────────────────────
function PaymentModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: PanelData["invoices"][0];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const balance = Math.max(0, Number(invoice.balanceDue));
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : "");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentMethods = [
    { value: "CASH", label: "Cash" },
    { value: "CHECK", label: "Check" },
    { value: "CREDIT_CARD", label: "Credit Card" },
    { value: "CARECREDIT", label: "CareCredit" },
    { value: "CHERRY", label: "Cherry" },
    { value: "PATIENTFI", label: "PatientFi" },
    { value: "WIRE_TRANSFER", label: "Wire Transfer" },
    { value: "OTHER", label: "Other" },
  ];

  const referenceLabel = (() => {
    switch (method) {
      case "CHECK": return "Check Number";
      case "CREDIT_CARD": return "Last 4 Digits";
      case "WIRE_TRANSFER": return "Wire Reference";
      default: return "Reference Number";
    }
  })();

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Amount must be greater than zero");
      return;
    }
    if (!method) {
      setError("Please select a payment method");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          paymentDate,
          method,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record payment");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  };

  return (
    <div
      data-testid="payment-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: "var(--bg-primary)",
        borderRadius: "12px",
        width: "420px",
        maxWidth: "90vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard size={16} style={{ color: "#065F46" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Record Payment</h3>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {invoice.invoiceNumber || "Invoice"} — Balance: {formatCurrency(balance)}
            </div>
          </div>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div data-testid="payment-error" style={{ fontSize: "13px", color: "#EF4444", backgroundColor: "#FEF2F2", padding: "8px 12px", borderRadius: "6px" }}>{error}</div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>Amount *</label>
            <input
              data-testid="input-payment-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>Date *</label>
            <input
              data-testid="input-payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>Method *</label>
            <select
              data-testid="select-payment-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">Select method...</option>
              {paymentMethods.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>{referenceLabel}</label>
            <input
              data-testid="input-payment-reference"
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              style={inputStyle}
              placeholder={`Enter ${referenceLabel.toLowerCase()}...`}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>Notes</label>
            <textarea
              data-testid="input-payment-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Optional notes..."
            />
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button data-testid="button-cancel-payment" onClick={onClose} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            data-testid="button-confirm-payment"
            disabled={submitting}
            onClick={handleSubmit}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: submitting ? "#9CA3AF" : "#10B981",
              border: "none",
              borderRadius: "6px",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FinancesTab({ data, showToast }: { data: PanelData; showToast: (msg: string, type?: "success" | "error") => void }) {
  const [paymentInvoice, setPaymentInvoice] = useState<PanelData["invoices"][0] | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [localData, setLocalData] = useState(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const navigateToQuoteBuilder = (quoteId?: string) => {
    if (quoteId) {
      window.location.href = `/quotes/builder?quoteId=${quoteId}`;
    } else {
      window.location.href = `/quotes/builder?opportunityId=${localData.id}`;
    }
  };

  const { quotes, invoices } = localData;
  const sectionLabel: React.CSSProperties = { fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" };

  const hasNonVoidInvoice = invoices.some((inv) => inv.status !== "VOID");

  const getQuoteLeftBorder = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "CONVERTED") return "#10B981";
    if (s === "DRAFT") return "#9CA3AF";
    if (s === "SENT") return "#F59E0B";
    if (s === "ACCEPTED") return "#10B981";
    if (s === "DECLINED" || s === "EXPIRED") return "#EF4444";
    return "#9CA3AF";
  };

  const getQuoteOpacity = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "DECLINED" || s === "EXPIRED") return 0.6;
    return 1;
  };

  const isQuoteConvertible = (status: string) => {
    const s = status?.toUpperCase();
    return (s === "DRAFT" || s === "SENT" || s === "ACCEPTED") && !hasNonVoidInvoice;
  };

  const getInvoiceLeftBorder = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "PAID") return "#10B981";
    if (s === "PARTIALLY_PAID" || s === "SENT") return "#F59E0B";
    if (s === "VOID") return "#9CA3AF";
    return "#9CA3AF";
  };

  const findInvoiceForQuote = (quoteId: string) => {
    return invoices.find((inv) => inv.quoteId === quoteId);
  };

  const convertQuote = async (quoteId: string) => {
    setConverting(quoteId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to convert quote");
      }
      const invoice = await res.json();
      showToast(`Converted to ${invoice.invoiceNumber || "Invoice"}`);
      const panelRes = await fetch(`/api/opportunities/${localData.id}/panel`);
      if (panelRes.ok) {
        const fresh = await panelRes.json();
        setLocalData(fresh);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to convert", "error");
    } finally {
      setConverting(null);
    }
  };

  const handlePaymentSuccess = async () => {
    setPaymentInvoice(null);
    showToast("Payment recorded successfully");
    const panelRes = await fetch(`/api/opportunities/${localData.id}/panel`);
    if (panelRes.ok) {
      const fresh = await panelRes.json();
      setLocalData(fresh);
    }
  };

  const allPayments = invoices.flatMap((inv) =>
    inv.payments.map((p) => ({
      ...p,
      invoiceNumber: inv.invoiceNumber,
      invoiceDescription: inv.description,
    }))
  );
  allPayments.sort((a, b) => new Date(b.paymentDate || "").getTime() - new Date(a.paymentDate || "").getTime());

  const methodLabel = (method: string) => {
    switch (method?.toUpperCase()) {
      case "CREDIT_CARD": return "Card";
      case "CASH": return "Cash";
      case "CHECK": return "Check";
      case "CARECREDIT": return "CareCredit";
      case "CHERRY": return "Cherry";
      case "PATIENTFI": return "PatientFi";
      case "WIRE_TRANSFER": return "Wire";
      default: return method || "—";
    }
  };

  return (
    <div style={{ padding: "16px 20px" }}>
      {/* SECTION 1: QUOTES */}
      <div style={{ marginBottom: "24px" }}>
        <div style={sectionLabel}>QUOTES</div>
        {quotes.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {quotes.map((quote) => {
              const procName = quote.title || quote.quoteNumber || quote.lineItems?.[0]?.name || "Quote";
              const linkedInvoice = findInvoiceForQuote(quote.id);
              const isConverted = quote.status?.toUpperCase() === "CONVERTED";
              const opacity = getQuoteOpacity(quote.status);
              const canConvert = isQuoteConvertible(quote.status);
              const isConverting = converting === quote.id;

              return (
                <div
                  key={quote.id}
                  data-testid={`card-quote-${quote.id}`}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid var(--border-default)",
                    borderLeftWidth: "3px",
                    borderLeftColor: getQuoteLeftBorder(quote.status),
                    backgroundColor: "var(--bg-primary)",
                    padding: "14px",
                    opacity,
                    transition: "opacity 200ms",
                  }}
                >
                  <div
                    onClick={() => navigateToQuoteBuilder(quote.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{procName}</div>
                        <div data-testid={`text-quote-amount-${quote.id}`} style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", ...mono }}>{formatCurrency(quote.total)}</div>
                      </div>
                      <StatusPill status={quote.status} />
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", ...mono }}>
                      Created {formatShortDate(quote.createdAt)}
                    </div>
                  </div>
                  {isConverted && linkedInvoice && (
                    <Link
                      href={`/invoices/${linkedInvoice.id}`}
                      data-testid={`link-invoice-${linkedInvoice.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: "12px", color: "#10B981", marginTop: "6px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
                    >
                      <ArrowRight size={12} /> {linkedInvoice.invoiceNumber || `INV-${linkedInvoice.id.slice(-6)}`}
                    </Link>
                  )}
                  {canConvert && (
                    <button
                      data-testid={`button-convert-quote-${quote.id}`}
                      disabled={isConverting}
                      onClick={(e) => {
                        e.stopPropagation();
                        convertQuote(quote.id);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        marginTop: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: isConverting ? "var(--text-muted)" : "#10B981",
                        background: "none",
                        border: "1px solid",
                        borderColor: isConverting ? "var(--border-default)" : "#10B981",
                        borderRadius: "5px",
                        padding: "5px 10px",
                        cursor: isConverting ? "not-allowed" : "pointer",
                        opacity: isConverting ? 0.7 : 1,
                      }}
                    >
                      <CheckCircle size={12} />
                      {isConverting ? "Converting..." : "Accept & Convert to Invoice"}
                    </button>
                  )}
                </div>
              );
            })}
            <button data-testid="button-create-quote" onClick={() => navigateToQuoteBuilder()} style={{ fontSize: "13px", fontWeight: 600, color: "#10B981", background: "none", border: "1px solid #10B981", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", width: "100%", marginTop: "2px" }}>
              + New Quote
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "10px" }}>No quotes yet</div>
            <button data-testid="button-create-quote-empty" onClick={() => navigateToQuoteBuilder()} style={{ fontSize: "13px", fontWeight: 600, color: "#10B981", background: "none", border: "1px solid #10B981", borderRadius: "6px", padding: "6px 16px", cursor: "pointer" }}>
              + New Quote
            </button>
          </div>
        )}
      </div>

      {/* SECTION 2: INVOICES */}
      <div style={{ marginBottom: "24px" }}>
        <div style={sectionLabel}>INVOICES</div>
        {invoices.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {invoices.map((inv) => {
              const paid = Number(inv.amountPaid) || 0;
              const remaining = Math.max(0, Number(inv.balanceDue));
              const fullyPaid = inv.status === "PAID";
              const isVoid = inv.status === "VOID";
              const sourceQuote = inv.quote;
              const canRecordPayment = !isVoid && !fullyPaid;

              return (
                <div
                  key={inv.id}
                  data-testid={`card-invoice-${inv.id}`}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid var(--border-default)",
                    borderLeftWidth: "3px",
                    borderLeftColor: getInvoiceLeftBorder(inv.status),
                    backgroundColor: "var(--bg-primary)",
                    padding: "14px",
                    opacity: isVoid ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {inv.invoiceNumber && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", ...mono, marginBottom: "2px" }}>{inv.invoiceNumber}</div>
                      )}
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{inv.description || "Invoice"}</div>
                      {sourceQuote && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          From {sourceQuote.quoteNumber || `Quote #${sourceQuote.id.slice(-6)}`}
                        </div>
                      )}
                    </div>
                    <StatusPill status={inv.status} />
                  </div>

                  {fullyPaid ? (
                    <div data-testid={`text-paid-full-${inv.id}`} style={{ fontSize: "14px", fontWeight: 600, color: "#10B981", display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle size={14} /> Paid in Full
                    </div>
                  ) : !isVoid ? (
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>TOTAL</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", ...mono }}>{formatCurrency(inv.total)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>PAID</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "#10B981", ...mono }}>{formatCurrency(paid)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>REMAINING</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: remaining > 0 ? "#EF4444" : "#10B981", ...mono }}>{formatCurrency(remaining)}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Voided — {formatCurrency(inv.total)}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                    {inv.dueDate && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", ...mono }}>Due {formatShortDate(inv.dueDate)}</span>
                    )}
                    {canRecordPayment && (
                      <button
                        data-testid={`button-record-payment-${inv.id}`}
                        onClick={() => setPaymentInvoice(inv)}
                        style={{ fontSize: "12px", fontWeight: 600, color: "#10B981", background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <Plus size={12} /> Record Payment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No invoices yet</div>
        )}
      </div>

      {/* SECTION 3: PAYMENT HISTORY */}
      <div>
        <div style={sectionLabel}>PAYMENT HISTORY</div>
        {allPayments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {allPayments.map((payment, idx) => (
              <div
                key={payment.id || idx}
                data-testid={`row-payment-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 0",
                  borderBottom: idx < allPayments.length - 1 ? "1px solid var(--border-default)" : "none",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--text-muted)", ...mono, flexShrink: 0, minWidth: "60px" }}>
                  {payment.paymentDate ? formatShortDate(payment.paymentDate) : "—"}
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {payment.invoiceDescription || payment.invoiceNumber || "Payment"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#10B981", ...mono, flexShrink: 0 }}>
                  {formatCurrency(payment.amount)}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0, minWidth: "50px", textAlign: "right" }}>
                  {methodLabel(payment.method)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No payments recorded</div>
        )}
      </div>

      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

// ─── Forms Tab ───────────────────────────────────────────
function FormsTab({ forms, showToast }: { forms: PanelData["forms"]; showToast: (msg: string, type?: "success" | "error") => void }) {
  if (!forms.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <FileText size={24} style={{ color: "var(--text-muted)", opacity: 0.5, margin: "0 auto 8px" }} />
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No forms yet</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px" }}>
      {forms.map((form) => {
        const s = form.status?.toUpperCase();
        let dotEl: React.ReactNode;
        let statusText: string;
        let statusColor: string;
        let actionLabel: string;

        if (s === "COMPLETED") {
          dotEl = <CheckCircle size={14} style={{ color: "#10B981", flexShrink: 0 }} />;
          statusText = "Completed";
          statusColor = "#065F46";
          actionLabel = "View";
        } else if (s === "SENT") {
          dotEl = <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#F59E0B", flexShrink: 0, display: "inline-block" }} />;
          statusText = "Sent";
          statusColor = "#D97706";
          actionLabel = "Remind";
        } else {
          dotEl = <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#9CA3AF", flexShrink: 0, display: "inline-block" }} />;
          statusText = "Not Sent";
          statusColor = "var(--text-muted)";
          actionLabel = "Send \u2192";
        }

        return (
          <div
            key={form.id}
            data-testid={`row-form-${form.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              height: "44px",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <FileText size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.formName}</span>
            {dotEl}
            <span style={{ fontSize: "12px", color: statusColor, fontWeight: s === "COMPLETED" ? 500 : 400, minWidth: "60px" }}>{statusText}</span>
            <button
              data-testid={`button-form-action-${form.id}`}
              onClick={() => showToast(`${actionLabel === "View" ? "Form viewer" : actionLabel === "Remind" ? "Reminder" : "Form sending"} coming in a future phase`)}
              style={{ fontSize: "12px", fontWeight: 600, color: "#10B981", background: "none", border: "none", cursor: "pointer", padding: "2px 0", flexShrink: 0 }}
            >
              {actionLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Audit Log Trigger + Dialog ──────────────────────────
function AuditLogTrigger({ activities }: { activities: PanelData["activities"] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const getEventType = (type: string) => {
    switch (type?.toUpperCase()) {
      case "CALL": return "Call Logged";
      case "STAGE_CHANGE": return "Stage Changed";
      case "NOTE": return "Note Added";
      case "EMAIL": return "Email Sent";
      case "APPOINTMENT": return "Appointment";
      case "SOURCE_UPDATED": return "Source Updated";
      case "OPPORTUNITY_CREATED": return "Deal Created";
      case "FIELD_UPDATED": return "Field Updated";
      default: return type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Event";
    }
  };

  const getDetail = (act: PanelData["activities"][0]) => {
    const t = act.type?.toUpperCase();
    if (t === "STAGE_CHANGE") {
      const meta = act.metadata as any;
      if (meta?.fromStage && meta?.toStage) return `${meta.fromStage} \u2192 ${meta.toStage}`;
      if (meta?.toStage) return `Moved to ${meta.toStage}`;
      if (act.body) return act.body;
      return "";
    }
    if (t === "CALL") {
      const meta = act.metadata as any;
      const parts: string[] = [];
      if (meta?.outcome) parts.push(meta.outcome);
      if (meta?.reason) parts.push(meta.reason);
      return parts.join(" \u00B7 ");
    }
    if (t === "SOURCE_UPDATED") {
      const meta = act.metadata as any;
      if (meta?.value) return `Source set to ${meta.value}`;
      return "Source cleared";
    }
    if (act.body) return act.body.slice(0, 80) + (act.body.length > 80 ? "..." : "");
    return "";
  };

  const getIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "CALL": return Phone;
      case "STAGE_CHANGE": return ArrowRight;
      case "NOTE": return StickyNote;
      case "EMAIL": return Mail;
      case "APPOINTMENT": return Calendar;
      default: return Activity;
    }
  };

  return (
    <>
      <button
        data-testid="button-audit-log"
        onClick={() => setOpen(!open)}
        title="View audit log"
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: "1px solid var(--border-default)",
          backgroundColor: "var(--bg-primary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          opacity: 0.5,
          transition: "all 200ms",
          zIndex: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.borderColor = "#10B981";
          e.currentTarget.style.color = "#10B981";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.5";
          e.currentTarget.style.borderColor = "var(--border-default)";
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        <Search size={14} />
      </button>

      {open && (
        <div
          ref={dialogRef}
          data-testid="audit-log-dialog"
          style={{
            position: "absolute",
            bottom: "56px",
            right: "16px",
            width: "340px",
            maxHeight: "360px",
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-default)", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Audit Log
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {activities.length === 0 ? (
              <div style={{ padding: "32px 14px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                No activity recorded yet.
              </div>
            ) : (
              [...activities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((act) => {
                const Icon = getIcon(act.type);
                const detail = getDetail(act);
                const fullDate = new Date(act.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
                return (
                  <div
                    key={act.id}
                    data-testid={`audit-entry-${act.id}`}
                    style={{
                      padding: "8px 14px",
                      borderBottom: "1px solid var(--border-default)",
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <div style={{ paddingTop: "2px", flexShrink: 0 }}>
                      <Icon size={13} style={{ color: "var(--text-muted)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{getEventType(act.type)}</div>
                      {detail && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                        {act.user && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{act.user.firstName} {act.user.lastName}</span>}
                        <span title={fullDate} style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-geist-mono), monospace" }}>{timeAgo(act.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
