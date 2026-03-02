"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Activity,
  Users,
  ClipboardList,
  Image,
  Send,
  StickyNote,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Loader2,
  PhoneCall,
  AtSign,
  ArrowRightLeft,
  MapPin,
  Camera,
  Pencil,
  Check,
  Download,
  Eye,
  CreditCard,
} from "lucide-react";
import OpportunityPanel from "@/components/pipeline/OpportunityPanel";
import BookingModal from "@/components/appointments/BookingModal";
import { getTagStyle, getTagPillStyle } from "@/lib/tagStyles";

type TabKey = "timeline" | "financial" | "appointments" | "treatment" | "documents" | "photos" | "communications";

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  isVip: boolean;
  tags: string[];
  dateOfBirth: string | null;
  gender: string | null;
  notes: string | null;
  city: string | null;
  state: string | null;
  referralSource: string | null;
  referredByPatient: { id: string; firstName: string; lastName: string } | null;
  parentGuardian: { id: string; firstName: string; lastName: string } | null;
  opportunities: {
    id: string;
    title: string;
    estimatedValue: number;
    value: number | null;
    status: string;
    isWon: boolean;
    isLost: boolean;
    isArchived: boolean;
    referralSource: string | null;
    stage: { name: string; color: string };
    pipeline: { name: string };
    assignedTo: { firstName: string; lastName: string } | null;
  }[];
  appointments: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    appointmentCategory: string | null;
    provider: { firstName: string; lastName: string } | null;
  }[];
  treatmentPlans: { id: string; title: string; status: string }[];
  lifetimeValue: number;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
}

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  date: string;
  user: string | null;
  metadata: any;
}

interface TimelineResponse {
  items: TimelineItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FinancialData {
  quotes: any[];
  invoices: any[];
  summary: {
    totalQuoted: number;
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
  };
}

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDobWithAge(dob: string | null): string {
  if (!dob) return "\u2014";
  const birth = new Date(dob);
  const formatted = birth.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${formatted} \u00B7 ${age} yrs`;
}

function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date);
  itemDate.setHours(0, 0, 0, 0);

  if (itemDate.getTime() === today.getTime()) return "Today";
  if (itemDate.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

function isWithin7Days(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

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

function getTimelineColor(type: string): string {
  switch (type) {
    case "APPOINTMENT": return "#3B82F6";
    case "QUOTE": return "#F59E0B";
    case "CALL": return "#8B5CF6";
    case "STAGE_CHANGE": return "#9CA3AF";
    case "NOTE": return "#EAB308";
    case "INVOICE":
    case "PAYMENT": return "#10B981";
    case "EMAIL": return "#3B82F6";
    case "SMS": return "#8B5CF6";
    default: return "#6B7280";
  }
}

function getTimelineIcon(type: string) {
  switch (type) {
    case "NOTE": return StickyNote;
    case "CALL": return PhoneCall;
    case "EMAIL": return AtSign;
    case "SMS": return MessageSquare;
    case "STAGE_CHANGE": return ArrowRightLeft;
    case "APPOINTMENT": return Calendar;
    case "QUOTE": return FileText;
    case "INVOICE": return DollarSign;
    default: return Activity;
  }
}

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || "").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase();
}

function getTagPrefix(tag: string): string {
  const ts = getTagStyle(tag);
  return ts.emoji ? `${ts.emoji} ` : "";
}

const TABS: { key: TabKey; label: string; icon: typeof Calendar }[] = [
  { key: "timeline", label: "Timeline", icon: Activity },
  { key: "financial", label: "Financial", icon: DollarSign },
  { key: "appointments", label: "Appointments", icon: Calendar },
  { key: "treatment", label: "Treatment Plans", icon: ClipboardList },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "photos", label: "Photos", icon: Camera },
  { key: "communications", label: "Communications", icon: MessageSquare },
];

const FILTER_PILLS = [
  { value: "", label: "All Activity" },
  { value: "APPOINTMENT", label: "Appointments" },
  { value: "QUOTE", label: "Quotes" },
  { value: "CALL", label: "Calls" },
  { value: "NOTE", label: "Notes" },
];

function SkeletonBlock({ width, height }: { width: string; height: string }) {
  return (
    <span
      className="animate-pulse"
      style={{
        display: "block",
        width,
        height,
        backgroundColor: "var(--bg-tertiary, #F3F4F6)",
        borderRadius: "4px",
      }}
    />
  );
}

function SidebarSkeleton() {
  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <SkeletonBlock width="56px" height="56px" />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonBlock width="140px" height="20px" />
          <SkeletonBlock width="80px" height="16px" />
        </div>
      </div>
      <SkeletonBlock width="100%" height="14px" />
      <SkeletonBlock width="100%" height="14px" />
      <SkeletonBlock width="80%" height="14px" />
      <div style={{ display: "flex", gap: "8px" }}>
        <SkeletonBlock width="60px" height="24px" />
        <SkeletonBlock width="60px" height="24px" />
      </div>
      <SkeletonBlock width="100%" height="60px" />
      <SkeletonBlock width="100%" height="60px" />
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <SkeletonBlock width="100%" height="80px" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <SkeletonBlock width="36px" height="36px" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonBlock width="60%" height="14px" />
            <SkeletonBlock width="100%" height="14px" />
            <SkeletonBlock width="40%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
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
        backgroundColor: "#10B981",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap",
      }}
    >
      {message}
    </div>
  );
}

function AddDealFromPatientModal({
  open,
  onClose,
  patient,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  patient: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; referralSource: string | null };
  onCreated: () => void;
}) {
  const [pipelines, setPipelines] = useState<{ id: string; name: string; stages: { id: string; name: string }[] }[]>([]);
  const [leadSourceOptions, setLeadSourceOptions] = useState<{ id: string; name: string }[]>([]);
  const [procedureTypeOptions, setProcedureTypeOptions] = useState<{ id: string; name: string; category: string }[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [form, setForm] = useState({
    selectedProcedureIds: [] as string[],
    title: "",
    estimatedValue: "",
    leadSource: "",
    stageId: "",
    notes: "",
  });
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [procedureDropdownOpen, setProcedureDropdownOpen] = useState(false);
  const procedureRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/pipeline/board").then(r => r.json()).then((data: any) => {
      if (data.pipelines) {
        setPipelines(data.pipelines.map((p: any) => ({ id: p.id, name: p.name, stages: p.stages || [] })));
        if (data.pipelines.length > 0) {
          const def = data.pipelines.find((p: any) => p.isDefault) || data.pipelines[0];
          setSelectedPipelineId(def.id);
          if (def.stages?.length > 0) setForm(f => ({ ...f, stageId: def.stages[0].id }));
        }
      }
    }).catch(() => {});
    fetch("/api/settings/lead-sources?includeArchived=false").then(r => r.json()).then(setLeadSourceOptions).catch(() => {});
    fetch("/api/settings/procedure-types?includeArchived=false").then(r => r.json()).then(setProcedureTypeOptions).catch(() => {});
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (procedureRef.current && !procedureRef.current.contains(e.target as Node)) setProcedureDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!open) return null;

  const currentPipeline = pipelines.find(p => p.id === selectedPipelineId);
  const stages = currentPipeline?.stages || [];

  function generateTitle(ids: string[]): string {
    const names = ids.map(id => procedureTypeOptions.find(pt => pt.id === id)?.name).filter(Boolean) as string[];
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} + ${names[1]}`;
    return `${names[0]} + ${names[1]} +${names.length - 2}`;
  }

  function toggleProcedure(id: string) {
    setForm(prev => {
      const newIds = prev.selectedProcedureIds.includes(id) ? prev.selectedProcedureIds.filter(pid => pid !== id) : [...prev.selectedProcedureIds, id];
      const newTitle = titleManuallyEdited && newIds.length > 0 ? prev.title : generateTitle(newIds);
      if (newIds.length === 0) setTitleManuallyEdited(false);
      return { ...prev, selectedProcedureIds: newIds, title: newTitle };
    });
  }

  function removeProcedure(id: string) {
    setForm(prev => {
      const newIds = prev.selectedProcedureIds.filter(pid => pid !== id);
      const newTitle = titleManuallyEdited && newIds.length > 0 ? prev.title : generateTitle(newIds);
      if (newIds.length === 0) setTitleManuallyEdited(false);
      return { ...prev, selectedProcedureIds: newIds, title: newTitle };
    });
  }

  const canSubmit = form.selectedProcedureIds.length > 0 && form.stageId && selectedPipelineId;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          procedureTypeIds: form.selectedProcedureIds,
          title: form.title,
          estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
          leadSource: form.leadSource,
          stageId: form.stageId,
          pipelineId: selectedPipelineId,
          notes: form.notes,
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
        setForm({ selectedProcedureIds: [], title: "", estimatedValue: "", leadSource: "", stageId: stages[0]?.id ?? "", notes: "" });
        setTitleManuallyEdited(false);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", fontSize: "14px", border: "1px solid var(--border-default)", borderRadius: "6px", outline: "none", backgroundColor: "#FFFFFF", color: "var(--text-primary)", transition: "border-color 150ms" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" };
  const readOnlyStyle: React.CSSProperties = { ...inputStyle, backgroundColor: "#F3F4F6", color: "var(--text-muted)", cursor: "not-allowed" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", width: "460px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.20)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Add Deal</h2>
          <button data-testid="button-close-add-deal-patient" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="flex" style={{ gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Patient</label>
              <input style={readOnlyStyle} value={`${patient.firstName} ${patient.lastName}`} readOnly data-testid="input-patient-name-locked" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Phone</label>
              <input style={readOnlyStyle} value={patient.phone ? formatPhoneDisplay(patient.phone) : ""} readOnly data-testid="input-patient-phone-locked" />
            </div>
          </div>
          {patient.email && (
            <div>
              <label style={labelStyle}>Email</label>
              <input style={readOnlyStyle} value={patient.email} readOnly data-testid="input-patient-email-locked" />
            </div>
          )}

          <div ref={procedureRef} style={{ position: "relative" }}>
            <label style={labelStyle}>Procedure Interest *</label>
            <div data-testid="input-procedure-chips-patient" onClick={() => setProcedureDropdownOpen(v => !v)} style={{ ...inputStyle, cursor: "pointer", display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "38px", alignItems: "center", padding: "6px 12px" }}>
              {form.selectedProcedureIds.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Select procedures...</span>}
              {form.selectedProcedureIds.map(id => {
                const pt = procedureTypeOptions.find(p => p.id === id);
                return (
                  <span key={id} data-testid={`chip-procedure-patient-${id}`} style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#ECFDF5", color: "#065F46", fontSize: "12px", fontWeight: 500, padding: "2px 8px", borderRadius: "12px", border: "1px solid #A7F3D0", lineHeight: "20px" }}>
                    {pt?.name || id}
                    <button onClick={(e) => { e.stopPropagation(); removeProcedure(id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", color: "#065F46" }}><X size={12} /></button>
                  </span>
                );
              })}
            </div>
            {procedureDropdownOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, backgroundColor: "#FFFFFF", border: "1px solid var(--border-default)", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto", marginTop: "4px" }}>
                {procedureTypeOptions.map(pt => {
                  const isSelected = form.selectedProcedureIds.includes(pt.id);
                  return (
                    <div key={pt.id} onClick={() => toggleProcedure(pt.id)} style={{ padding: "8px 12px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", backgroundColor: isSelected ? "#F0FDF4" : "transparent", color: "var(--text-primary)" }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#F9FAFB"; }} onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}>
                      <div style={{ width: "16px", height: "16px", borderRadius: "3px", border: isSelected ? "none" : "1px solid #D1D5DB", backgroundColor: isSelected ? "#10B981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSelected && <Check size={11} color="#FFFFFF" />}
                      </div>
                      {pt.name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Deal Title</label>
            <input data-testid="input-title-patient" style={inputStyle} value={form.title} placeholder={form.selectedProcedureIds.length === 0 ? "Auto-generated from procedures" : ""} onChange={(e) => { setTitleManuallyEdited(true); setForm({ ...form, title: e.target.value }); }} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }} />
          </div>

          <div className="flex" style={{ gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Estimated Value ($)</label>
              <input data-testid="input-value-patient" type="number" style={inputStyle} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Source</label>
              <div style={{ display: "flex", gap: "4px" }}>
                <select data-testid="select-source-patient" style={{ ...inputStyle, cursor: "pointer", flex: 1 }} value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}>
                  <option value="">Select...</option>
                  {leadSourceOptions.map(ls => <option key={ls.id} value={ls.name}>{ls.name}</option>)}
                </select>
                {patient.referralSource && !form.leadSource && (
                  <button data-testid="button-inherit-source" onClick={() => setForm(f => ({ ...f, leadSource: patient.referralSource! }))} title={`Use patient source: ${patient.referralSource}`} style={{ fontSize: "10px", fontWeight: 600, color: "#10B981", background: "none", border: "1px solid #A7F3D0", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Inherit
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex" style={{ gap: "12px" }}>
            {pipelines.length > 1 && (
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Pipeline</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={selectedPipelineId} onChange={(e) => { setSelectedPipelineId(e.target.value); const p = pipelines.find(pp => pp.id === e.target.value); if (p?.stages?.length) setForm(f => ({ ...f, stageId: p.stages[0].id })); }}>
                  {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Stage</label>
              <select data-testid="select-stage-patient" style={{ ...inputStyle, cursor: "pointer" }} value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea data-testid="input-notes-patient" rows={2} style={{ ...inputStyle, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }} />
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
          <button data-testid="button-submit-deal-patient" disabled={!canSubmit || submitting} onClick={handleSubmit} style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 600, color: "#FFFFFF", backgroundColor: canSubmit && !submitting ? "#10B981" : "#9CA3AF", border: "none", borderRadius: "6px", cursor: canSubmit && !submitting ? "pointer" : "not-allowed", transition: "background-color 150ms" }}>
            {submitting ? "Adding..." : "Add Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "10px",
};

export default function PatientProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("timeline");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [bookingModal, setBookingModal] = useState<{ open: boolean; prefill?: { appointmentId?: string; patientId?: string; patientName?: string; lockPatient?: boolean } }>({ open: false });

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineTotalPages, setTimelineTotalPages] = useState(1);
  const [timelineFilter, setTimelineFilter] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteInternal, setNoteInternal] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const [financial, setFinancial] = useState<FinancialData | null>(null);
  const [financialLoading, setFinancialLoading] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [practiceTags, setPracticeTags] = useState<{ id: string; name: string; color: string; emoji: string | null }[]>([]);
  const tagRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) setTagDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  const savePatientSource = async (value: string | null) => {
    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralSource: value }),
      });
      if (!res.ok) throw new Error();
      setPatient((prev) => (prev ? { ...prev, referralSource: value } : prev));
      setSourceDropdownOpen(false);
      showToast("Primary source updated");
    } catch {
      showToast("Failed to update source");
    }
  };

  const fetchPatient = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${id}`);
      if (!res.ok) throw new Error("Failed to load patient");
      const data = await res.json();
      setPatient(data);
      setTags(data.tags || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTimeline = useCallback(async (page: number, filter: string, append: boolean = false) => {
    setTimelineLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", "20");
      if (filter) p.set("type", filter);
      const res = await fetch(`/api/patients/${id}/timeline?${p.toString()}`);
      if (!res.ok) throw new Error("Failed to load timeline");
      const data: TimelineResponse = await res.json();
      setTimeline(prev => append ? [...prev, ...data.items] : data.items);
      setTimelinePage(data.page);
      setTimelineTotalPages(data.totalPages);
    } catch {
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  const fetchFinancial = useCallback(async () => {
    setFinancialLoading(true);
    try {
      const res = await fetch(`/api/patients/${id}/financial`);
      if (!res.ok) throw new Error("Failed to load financial data");
      const data = await res.json();
      setFinancial(data);
    } catch {
    } finally {
      setFinancialLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchPatient();
  }, [id, fetchPatient]);

  const [leadSources, setLeadSources] = useState<{ id: string; name: string; channelType: string }[]>([]);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/practices/tags").then(r => r.json()).then(setPracticeTags).catch(() => {});
    fetch("/api/settings/lead-sources?includeArchived=false").then(r => r.json()).then(setLeadSources).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) {
        setSourceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (id && activeTab === "timeline") {
      setTimeline([]);
      setTimelinePage(1);
      fetchTimeline(1, timelineFilter);
    }
  }, [id, activeTab, timelineFilter, fetchTimeline]);

  useEffect(() => {
    if (id && activeTab === "financial" && !financial) {
      fetchFinancial();
    }
  }, [id, activeTab, financial, fetchFinancial]);

  async function handleAddNote() {
    if (!noteBody.trim() || noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim(), isInternal: noteInternal }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteBody("");
      setNoteInternal(false);
      setShowNoteForm(false);
      fetchTimeline(1, timelineFilter);
    } catch {
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function handleAddTag(tagName: string) {
    if (tags.includes(tagName)) return;
    const updated = [...tags, tagName];
    setTags(updated);
    setTagDropdownOpen(false);
    try {
      const res = await fetch(`/api/patients/${id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updated }),
      });
      if (!res.ok) throw new Error("Failed to update tags");
    } catch {
      setTags(tags);
    }
  }

  async function handleRemoveTag(tagToRemove: string) {
    const updated = tags.filter(t => t !== tagToRemove);
    setTags(updated);
    try {
      const res = await fetch(`/api/patients/${id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updated }),
      });
      if (!res.ok) throw new Error("Failed to update tags");
    } catch {
      setTags(tags);
    }
  }

  if (error && !loading) {
    return (
      <div
        style={{
          margin: "-28px -32px",
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={24} style={{ color: "#EF4444" }} />
        </div>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Something went wrong
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>{error}</p>
        <Link
          href="/patients"
          data-testid="link-back-to-patients"
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#10B981",
            textDecoration: "none",
          }}
        >
          Back to Patients
        </Link>
      </div>
    );
  }

  const now = new Date();
  const upcomingAppointments = (patient?.appointments || [])
    .filter(a => new Date(a.startTime) > now && a.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 2);

  const openOpps = (patient?.opportunities || []).filter(o => !o.isWon && !o.isLost && !o.isArchived);

  const openQuoteValue = (patient?.opportunities || []).reduce((sum, opp) => {
    return sum + Number(opp.value || opp.estimatedValue || 0);
  }, 0);

  const primaryReferralSource = patient?.referralSource || null;

  return (
    <div
      style={{
        margin: "-28px -32px",
        minHeight: "calc(100% + 56px)",
        display: "flex",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      {/* LEFT SIDEBAR */}
      <div
        data-testid="patient-sidebar"
        style={{
          width: "320px",
          minWidth: "320px",
          backgroundColor: "var(--bg-primary)",
          borderRight: "1px solid var(--border-default)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {loading ? (
          <SidebarSkeleton />
        ) : patient ? (
          <>
            {/* HEADER */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <Link
                href="/patients"
                data-testid="link-back"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  marginBottom: "16px",
                }}
              >
                <ArrowLeft size={14} />
                Back to Patients
              </Link>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  data-testid="avatar-patient"
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "#10B981",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(patient.firstName, patient.lastName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h1
                    data-testid="text-patient-name"
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      margin: 0,
                    }}
                  >
                    {patient.firstName} {patient.lastName}
                  </h1>
                  <div style={{ marginTop: "6px" }}>
                    <span data-testid="badge-status" style={getStatusBadgeStyle(patient.status)}>
                      {patient.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                {tags.map(tag => {
                  const ts = getTagStyle(tag);
                  return (
                    <span
                      key={tag}
                      data-testid={`tag-${tag}`}
                      className="patient-tag-pill"
                      style={{ ...getTagPillStyle(tag), position: "relative", cursor: "default", fontSize: "12px", padding: "3px 10px" }}
                    >
                      {ts.emoji ? `${ts.emoji} ` : ""}{tag}
                      <span
                        data-testid={`button-remove-tag-${tag}`}
                        className="patient-tag-remove"
                        onClick={() => handleRemoveTag(tag)}
                        style={{ cursor: "pointer", marginLeft: "2px", fontSize: "14px", lineHeight: 1, opacity: 0, transition: "opacity 150ms" }}
                      >
                        &times;
                      </span>
                    </span>
                  );
                })}
                <div ref={tagRef} style={{ position: "relative" }}>
                  <button data-testid="button-add-tag" onClick={() => setTagDropdownOpen(!tagDropdownOpen)} style={{ background: "none", border: "1px dashed var(--border-default)", borderRadius: "10px", padding: "3px 10px", fontSize: "11px", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>
                    <Plus size={10} /> Tag
                  </button>
                  {tagDropdownOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-default)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100, minWidth: "180px", maxHeight: "220px", overflowY: "auto", padding: "4px" }}>
                      {practiceTags.filter(pt => !tags.includes(pt.name)).length === 0 ? (
                        <div style={{ padding: "8px 12px", fontSize: "12px", color: "var(--text-muted)" }}>All tags applied</div>
                      ) : (
                        practiceTags.filter(pt => !tags.includes(pt.name)).map(pt => (
                          <button
                            key={pt.id}
                            data-testid={`tag-option-${pt.name}`}
                            onClick={() => handleAddTag(pt.name)}
                            style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 10px", border: "none", background: "none", cursor: "pointer", borderRadius: "6px", textAlign: "left", transition: "background 150ms" }}
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
              <style>{`.patient-tag-pill:hover .patient-tag-remove { opacity: 1 !important; }`}</style>
            </div>

            {/* QUICK ACTIONS */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "8px" }}>
              {[
                { icon: Phone, label: "Call" },
                { icon: MessageSquare, label: "Text" },
                { icon: Mail, label: "Email" },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    data-testid={`button-${action.label.toLowerCase()}`}
                    onClick={() => showToast(`${action.label} feature coming soon`)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 0",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={14} />
                    {action.label}
                  </button>
                );
              })}
            </div>

            {/* CONTACT INFO */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <div style={sectionLabelStyle}>Contact Info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {patient.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Mail size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <a
                      href={`mailto:${patient.email}`}
                      data-testid="link-email"
                      style={{ fontSize: "13px", color: "#10B981", textDecoration: "none" }}
                    >
                      {patient.email}
                    </a>
                  </div>
                )}
                {patient.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Phone size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span data-testid="text-phone" style={{ fontSize: "13px", color: "var(--text-secondary)", ...mono }}>
                      {formatPhoneDisplay(patient.phone)}
                    </span>
                  </div>
                )}
                {patient.dateOfBirth && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Calendar size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span data-testid="text-dob" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      {formatDobWithAge(patient.dateOfBirth)}
                    </span>
                  </div>
                )}
                {(patient.city || patient.state) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span data-testid="text-location" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      {[patient.city, patient.state].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* UPCOMING */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <div style={sectionLabelStyle}>Upcoming</div>
              {upcomingAppointments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {upcomingAppointments.map(appt => {
                    const apptDate = new Date(appt.startTime);
                    const within7 = isWithin7Days(appt.startTime);
                    return (
                      <div
                        key={appt.id}
                        data-testid={`upcoming-appt-${appt.id}`}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          backgroundColor: "var(--bg-secondary)",
                          border: "1px solid var(--border-default)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: within7 ? "#10B981" : "var(--text-secondary)",
                            ...mono,
                            marginBottom: "2px",
                          }}
                        >
                          {apptDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" \u00B7 "}
                          {apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                          {appt.appointmentCategory || appt.title}
                        </div>
                        {appt.provider && (
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                            Dr. {appt.provider.firstName} {appt.provider.lastName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No upcoming appointments</div>
              )}
              <button
                data-testid="button-book-appointment"
                onClick={() => setBookingModal({ open: true, prefill: { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, lockPatient: true } })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  marginTop: "10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#10B981",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Plus size={13} />
                Book Appointment
              </button>
            </div>

            {/* REVENUE */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <div style={sectionLabelStyle}>Revenue</div>
              <div
                data-testid="text-lifetime-value"
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#10B981",
                  ...mono,
                  marginBottom: "6px",
                }}
              >
                {formatCurrency(Number(patient.lifetimeValue || 0))}
              </div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "4px" }}>
                Lifetime Revenue
              </div>
              {openQuoteValue > 0 && (
                <div
                  data-testid="text-open-quote-value"
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#D97706",
                    ...mono,
                    marginTop: "8px",
                  }}
                >
                  {formatCurrency(openQuoteValue)}
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", marginLeft: "6px" }}>
                    Open Quotes
                  </span>
                </div>
              )}
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                {(patient.opportunities || []).length} Procedures
              </div>
            </div>

            {/* OPEN OPPORTUNITIES */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>Open Deals</div>
                <button
                  data-testid="button-add-deal-patient"
                  onClick={() => setAddDealOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#10B981",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F0FDF4"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <Plus size={12} /> Add Deal
                </button>
              </div>
              {openOpps.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {openOpps.map(opp => (
                    <div
                      key={opp.id}
                      data-testid={`card-opportunity-${opp.id}`}
                      onClick={() => setSelectedOpportunityId(opp.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-default)",
                        cursor: "pointer",
                        transition: "background-color 100ms",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {opp.title}
                        </div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: opp.stage.color,
                            backgroundColor: `${opp.stage.color}15`,
                            padding: "1px 8px",
                            borderRadius: "10px",
                            marginTop: "4px",
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: opp.stage.color }} />
                          {opp.stage.name}
                        </span>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", ...mono, flexShrink: 0 }}>
                        {formatCurrency(Number(opp.value || opp.estimatedValue || 0))}
                      </span>
                      <ChevronRight size={14} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>No open deals</div>
              )}
            </div>

            {/* REFERRALS */}
            <div style={{ padding: "16px 20px" }}>
              <div style={sectionLabelStyle}>Referrals</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div ref={sourceDropdownRef} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Primary Source</span>
                  <button
                    data-testid="button-edit-primary-source"
                    onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      borderRadius: "4px",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 500, color: primaryReferralSource ? "var(--text-secondary)" : "var(--text-muted)", fontStyle: primaryReferralSource ? "normal" : "italic" }}>
                      {primaryReferralSource || "Not set"}
                    </span>
                    <Pencil size={11} style={{ color: "var(--text-muted)" }} />
                  </button>
                  {sourceDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        right: 0,
                        marginTop: "4px",
                        backgroundColor: "var(--bg-primary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        zIndex: 100,
                        minWidth: "180px",
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      <div
                        data-testid="patient-source-option-clear"
                        onClick={() => savePatientSource(null)}
                        style={{ padding: "8px 12px", fontSize: "12px", color: "var(--text-muted)", cursor: "pointer", fontStyle: "italic" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        Clear
                      </div>
                      {leadSources.map((ls) => (
                        <div
                          key={ls.id}
                          data-testid={`patient-source-option-${ls.id}`}
                          onClick={() => savePatientSource(ls.name)}
                          style={{
                            padding: "8px 12px",
                            fontSize: "12px",
                            cursor: "pointer",
                            color: ls.name === primaryReferralSource ? "#10B981" : "var(--text-primary)",
                            fontWeight: ls.name === primaryReferralSource ? 600 : 400,
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Referred By</span>
                  {patient.referredByPatient ? (
                    <Link
                      href={`/patients/${patient.referredByPatient.id}`}
                      data-testid="link-referred-by"
                      style={{ fontSize: "12px", fontWeight: 500, color: "#10B981", textDecoration: "none" }}
                    >
                      {patient.referredByPatient.firstName} {patient.referredByPatient.lastName}
                    </Link>
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{"\u2014"}</span>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Has Referred</span>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)" }}>{"\u2014"}</span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* RIGHT CONTENT */}
      <div
        data-testid="patient-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* TAB BAR */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-primary)",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                data-testid={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "14px 18px",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#10B981" : "var(--text-muted)",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #10B981" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 150ms, border-color 150ms",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <ContentSkeleton />
          ) : (
            <>
              {activeTab === "timeline" && (
                <TimelineTab
                  timeline={timeline}
                  timelineLoading={timelineLoading}
                  timelinePage={timelinePage}
                  timelineTotalPages={timelineTotalPages}
                  timelineFilter={timelineFilter}
                  setTimelineFilter={(f) => { setTimelineFilter(f); setTimeline([]); setTimelinePage(1); }}
                  onLoadMore={() => fetchTimeline(timelinePage + 1, timelineFilter, true)}
                  showNoteForm={showNoteForm}
                  setShowNoteForm={setShowNoteForm}
                  noteBody={noteBody}
                  setNoteBody={setNoteBody}
                  noteInternal={noteInternal}
                  setNoteInternal={setNoteInternal}
                  noteSubmitting={noteSubmitting}
                  onAddNote={handleAddNote}
                />
              )}
              {activeTab === "financial" && (
                <FinancialTab financial={financial} loading={financialLoading} patientId={id} onRefresh={() => { setFinancial(null); fetchFinancial(); }} />
              )}
              {activeTab === "appointments" && patient && (
                <AppointmentsTab
                  patientId={patient.id}
                  patientName={`${patient.firstName} ${patient.lastName}`}
                  onOpenBooking={(prefill) => setBookingModal({ open: true, prefill })}
                />
              )}
              {activeTab === "treatment" && <PlaceholderTab icon={ClipboardList} label="Treatment Plans" />}
              {activeTab === "documents" && <PlaceholderTab icon={FileText} label="Documents" />}
              {activeTab === "photos" && <PlaceholderTab icon={Camera} label="Photos" />}
              {activeTab === "communications" && <PlaceholderTab icon={MessageSquare} label="Communications" />}
            </>
          )}
        </div>
      </div>

      <OpportunityPanel
        opportunityId={selectedOpportunityId}
        onClose={() => setSelectedOpportunityId(null)}
      />

      {patient && (
        <AddDealFromPatientModal
          open={addDealOpen}
          onClose={() => setAddDealOpen(false)}
          patient={{
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            phone: patient.phone,
            email: patient.email,
            referralSource: patient.referralSource,
          }}
          onCreated={() => fetchPatient()}
        />
      )}

      <BookingModal
        isOpen={bookingModal.open}
        onClose={() => setBookingModal({ open: false })}
        onSaved={() => { fetchPatient(); }}
        prefill={bookingModal.prefill}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

/* ─── TIMELINE TAB ─── */
function TimelineTab({
  timeline,
  timelineLoading,
  timelinePage,
  timelineTotalPages,
  timelineFilter,
  setTimelineFilter,
  onLoadMore,
  showNoteForm,
  setShowNoteForm,
  noteBody,
  setNoteBody,
  noteInternal,
  setNoteInternal,
  noteSubmitting,
  onAddNote,
}: {
  timeline: TimelineItem[];
  timelineLoading: boolean;
  timelinePage: number;
  timelineTotalPages: number;
  timelineFilter: string;
  setTimelineFilter: (f: string) => void;
  onLoadMore: () => void;
  showNoteForm: boolean;
  setShowNoteForm: (v: boolean) => void;
  noteBody: string;
  setNoteBody: (v: string) => void;
  noteInternal: boolean;
  setNoteInternal: (v: boolean) => void;
  noteSubmitting: boolean;
  onAddNote: () => void;
}) {
  const grouped: { label: string; items: TimelineItem[] }[] = [];
  timeline.forEach(item => {
    const label = getDateGroupLabel(item.date);
    const existing = grouped.find(g => g.label === label);
    if (existing) existing.items.push(item);
    else grouped.push({ label, items: [item] });
  });

  return (
    <div style={{ padding: "20px" }}>
      {/* Filter pills + Add Note button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {FILTER_PILLS.map(pill => {
            const isActive = timelineFilter === pill.value;
            return (
              <button
                key={pill.value}
                data-testid={`filter-${pill.value || "all"}`}
                onClick={() => setTimelineFilter(pill.value)}
                style={{
                  padding: "5px 14px",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#10B981" : "var(--text-muted)",
                  backgroundColor: isActive ? "rgba(16,185,129,0.08)" : "var(--bg-tertiary)",
                  border: isActive ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                  borderRadius: "9999px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
        <button
          data-testid="button-toggle-note-form"
          onClick={() => setShowNoteForm(!showNoteForm)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#10B981",
            backgroundColor: showNoteForm ? "rgba(16,185,129,0.08)" : "transparent",
            border: "1px solid #10B981",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <Plus size={13} />
          Add Note
        </button>
      </div>

      {/* Add Note Form */}
      {showNoteForm && (
        <div
          data-testid="add-note-box"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-default)",
            padding: "16px",
            marginBottom: "20px",
          }}
        >
          <textarea
            data-testid="input-note"
            placeholder="Write a note..."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            style={{
              width: "100%",
              minHeight: "80px",
              fontSize: "14px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              padding: "10px 12px",
              outline: "none",
              resize: "vertical",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", gap: "12px", flexWrap: "wrap" }}>
            <label
              data-testid="label-internal"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer" }}
            >
              <input
                data-testid="checkbox-internal"
                type="checkbox"
                checked={noteInternal}
                onChange={(e) => setNoteInternal(e.target.checked)}
                style={{ accentColor: "#10B981" }}
              />
              Team Only
            </label>
            <button
              data-testid="button-add-note"
              onClick={onAddNote}
              disabled={noteSubmitting || !noteBody.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: "#10B981",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                cursor: noteSubmitting || !noteBody.trim() ? "not-allowed" : "pointer",
                opacity: noteSubmitting || !noteBody.trim() ? 0.6 : 1,
              }}
            >
              {noteSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timelineLoading && timeline.length === 0 ? (
        <ContentSkeleton />
      ) : timeline.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <Activity size={32} style={{ color: "var(--text-subtle)", marginBottom: "12px" }} />
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>No activity yet</p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Vertical timeline line */}
          <div
            style={{
              position: "absolute",
              left: "24px",
              top: "0",
              bottom: "0",
              width: "2px",
              backgroundColor: "var(--border-default)",
            }}
          />

          {grouped.map(group => (
            <div key={group.label}>
              {/* Date group header */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  letterSpacing: "0.5px",
                  paddingLeft: "52px",
                  paddingTop: "12px",
                  paddingBottom: "8px",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                {group.label}
              </div>

              {group.items.map(item => {
                const color = getTimelineColor(item.type);
                const Icon = getTimelineIcon(item.type);
                return (
                  <div
                    key={item.id}
                    data-testid={`timeline-item-${item.id}`}
                    style={{
                      position: "relative",
                      paddingLeft: "52px",
                      paddingBottom: "12px",
                    }}
                  >
                    {/* Dot on the line */}
                    <div
                      style={{
                        position: "absolute",
                        left: "19px",
                        top: "16px",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: color,
                        border: "2px solid var(--bg-secondary)",
                      }}
                    />

                    {/* Card */}
                    <div
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <Icon size={14} style={{ color, flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color,
                            backgroundColor: `${color}15`,
                            padding: "1px 8px",
                            borderRadius: "10px",
                          }}
                        >
                          {item.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      {item.body && (
                        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 6px", lineHeight: 1.5 }}>
                          {item.body}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {item.user && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {item.user}
                          </span>
                        )}
                        <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
                          {timeAgo(item.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {timelinePage < timelineTotalPages && (
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button
            data-testid="button-load-more"
            onClick={onLoadMore}
            disabled={timelineLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 500,
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-secondary)",
              cursor: timelineLoading ? "not-allowed" : "pointer",
            }}
          >
            {timelineLoading && <Loader2 size={14} className="animate-spin" />}
            Load older activity &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── FINANCIAL TAB ─── */
function RecordPaymentModal({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  balanceDue,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(balanceDue > 0 ? balanceDue.toFixed(2) : "");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("CREDIT_CARD");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(balanceDue > 0 ? balanceDue.toFixed(2) : "");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setMethod("CREDIT_CARD");
      setReferenceNumber("");
      setNotes("");
      setError("");
    }
  }, [open, balanceDue]);

  if (!open) return null;

  const methods = [
    { value: "CASH", label: "Cash" },
    { value: "CHECK", label: "Check" },
    { value: "CREDIT_CARD", label: "Credit Card" },
    { value: "CARECREDIT", label: "CareCredit" },
    { value: "CHERRY", label: "Cherry" },
    { value: "PATIENTFI", label: "PatientFi" },
    { value: "WIRE_TRANSFER", label: "Wire Transfer" },
    { value: "OTHER", label: "Other" },
  ];

  const refLabel = method === "CHECK" ? "Check #" : method === "CREDIT_CARD" ? "Last 4 Digits" : method === "WIRE_TRANSFER" ? "Wire Ref" : "Reference #";

  async function handleSubmit() {
    if (!amount || Number(amount) <= 0) { setError("Amount must be greater than zero"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), paymentDate, method, referenceNumber: referenceNumber || undefined, notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to record payment");
        setSubmitting(false);
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Failed to record payment");
    }
    setSubmitting(false);
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", fontSize: "14px", border: "1px solid var(--border-default)", borderRadius: "6px", outline: "none", backgroundColor: "#FFFFFF", color: "var(--text-primary)" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", width: "420px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.20)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Record Payment</h2>
          <button data-testid="button-close-payment-modal" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Invoice: <span style={{ fontWeight: 600, color: "var(--text-primary)", ...mono }}>{invoiceNumber}</span></div>
          {balanceDue > 0 && <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Balance Due: <span style={{ fontWeight: 600, color: "#EF4444", ...mono }}>{formatCurrency(balanceDue)}</span></div>}

          <div>
            <label style={labelStyle}>Amount ($) *</label>
            <input data-testid="input-payment-amount" type="number" step="0.01" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Payment Date *</label>
            <input data-testid="input-payment-date" type="date" style={inputStyle} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Method *</label>
            <select data-testid="select-payment-method" style={{ ...inputStyle, cursor: "pointer" }} value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{refLabel}</label>
            <input data-testid="input-payment-reference" style={inputStyle} value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder={refLabel} />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea data-testid="input-payment-notes" style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <div style={{ fontSize: "12px", color: "#EF4444", fontWeight: 500 }}>{error}</div>}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button data-testid="button-cancel-payment" onClick={onClose} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, borderRadius: "6px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
          <button data-testid="button-submit-payment" disabled={submitting || !amount || Number(amount) <= 0} onClick={handleSubmit} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, borderRadius: "6px", border: "none", backgroundColor: "#10B981", color: "#FFFFFF", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: "4px" }} /> Recording...</> : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FinancialTab({ financial, loading, patientId, onRefresh }: { financial: FinancialData | null; loading: boolean; patientId: string; onRefresh: () => void }) {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ invoiceId: string; invoiceNumber: string; balanceDue: number } | null>(null);

  if (loading || !financial) {
    return <ContentSkeleton />;
  }

  const { summary, quotes, invoices } = financial;

  const kpiCards = [
    { label: "Total Revenue", value: summary.totalPaid, color: "#10B981" },
    { label: "Open Balance", value: summary.outstandingBalance, color: summary.outstandingBalance > 0 ? "#EF4444" : "#10B981" },
    { label: "Open Quotes", value: summary.totalQuoted, color: "#F59E0B" },
    { label: "Credits", value: 0, color: "#6B7280" },
  ];

  const headerCellStyle: React.CSSProperties = {
    padding: "10px 14px",
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
    padding: "12px 14px",
    fontSize: "13px",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-default)",
    whiteSpace: "nowrap",
  };

  function getFinancialStatusStyle(status: string): React.CSSProperties {
    const base: React.CSSProperties = {
      display: "inline-flex",
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: 600,
    };
    switch (status?.toUpperCase()) {
      case "PAID":
      case "ACCEPTED":
        return { ...base, backgroundColor: "#D1FAE5", color: "#065F46" };
      case "CONVERTED":
        return { ...base, backgroundColor: "rgba(139,92,246,0.12)", color: "#8B5CF6" };
      case "SENT":
      case "PENDING":
      case "PARTIALLY_PAID":
        return { ...base, backgroundColor: "rgba(245, 158, 11, 0.1)", color: "#D97706" };
      case "OVERDUE":
      case "EXPIRED":
        return { ...base, backgroundColor: "#FEE2E2", color: "#991B1B" };
      case "DRAFT":
        return { ...base, backgroundColor: "#F3F4F6", color: "#6B7280" };
      case "DECLINED":
      case "VOID":
        return { ...base, backgroundColor: "#FEE2E2", color: "#991B1B" };
      default:
        return { ...base, backgroundColor: "#F3F4F6", color: "#6B7280" };
    }
  }

  function isExpiringSoon(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }

  const actionBtnStyle: React.CSSProperties = {
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 500,
    borderRadius: "4px",
    border: "1px solid var(--border-default)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    textDecoration: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {kpiCards.map(card => (
          <div
            key={card.label}
            data-testid={`card-kpi-${card.label.toLowerCase().replace(/\s/g, "-")}`}
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: "10px",
              border: "1px solid var(--border-default)",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "6px" }}>{card.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: card.color, ...mono }}>
              {formatCurrency(card.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Quotes Section */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Quotes {quotes.length > 0 && `(${quotes.length})`}
          </h3>
          <Link
            href={`/quotes/builder?patientId=${patientId}`}
            data-testid="button-new-quote"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--brand-primary)",
              color: "#FFFFFF",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <Plus size={12} />
            New Quote
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div
            data-testid="empty-quotes"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: "10px",
              border: "1px solid var(--border-default)",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              No quotes yet — create the first quote for this patient.
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-default)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headerCellStyle}>Quote #</th>
                    <th style={headerCellStyle}>Deal</th>
                    <th style={headerCellStyle}>Status</th>
                    <th style={{ ...headerCellStyle, textAlign: "right" }}>Total</th>
                    <th style={headerCellStyle}>Expires</th>
                    <th style={headerCellStyle}>Created</th>
                    <th style={headerCellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q: any) => {
                    const expiring = isExpiringSoon(q.expirationDate);
                    const expired = q.status === "EXPIRED";
                    const isConverted = q.status === "CONVERTED";
                    const isDeclinedOrExpired = q.status === "DECLINED" || q.status === "EXPIRED";
                    return (
                      <tr key={q.id} data-testid={`row-quote-${q.id}`} style={{ opacity: isDeclinedOrExpired ? 0.6 : 1 }}>
                        <td style={{ ...cellStyle, fontWeight: 500, ...mono }}>
                          <Link href={`/quotes/builder?quoteId=${q.id}`} style={{ color: "var(--brand-primary)", textDecoration: "none" }} data-testid={`link-quote-${q.id}`}>
                            {q.quoteNumber || "\u2014"}
                          </Link>
                        </td>
                        <td style={cellStyle}>{q.opportunity?.title || "\u2014"}</td>
                        <td style={cellStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={getFinancialStatusStyle(q.status)}>{q.status}</span>
                            {isConverted && q.invoice && (
                              <Link
                                href={`/invoices/${q.invoice.id}`}
                                data-testid={`link-converted-invoice-${q.id}`}
                                style={{ fontSize: "11px", fontWeight: 600, color: "#10B981", textDecoration: "none" }}
                              >
                                {q.invoice.invoiceNumber || "INV"}
                              </Link>
                            )}
                          </div>
                        </td>
                        <td style={{ ...cellStyle, textAlign: "right", fontWeight: 600, ...mono }}>{formatCurrency(Number(q.total))}</td>
                        <td style={{ ...cellStyle, color: expired || expiring ? "#EF4444" : "var(--text-secondary)", fontWeight: expired || expiring ? 600 : 400 }}>
                          {q.expirationDate ? formatDate(q.expirationDate) : "\u2014"}
                        </td>
                        <td style={cellStyle}>{formatDate(q.createdAt)}</td>
                        <td style={cellStyle}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <Link href={`/quotes/builder?quoteId=${q.id}`} data-testid={`action-view-quote-${q.id}`} style={actionBtnStyle}>
                              View
                            </Link>
                            <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noopener noreferrer" data-testid={`action-pdf-quote-${q.id}`} style={actionBtnStyle}>
                              PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Invoices Section */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" }}>
          Invoices {invoices.length > 0 && `(${invoices.length})`}
        </h3>
        {invoices.length === 0 ? (
          <div
            data-testid="empty-invoices"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: "10px",
              border: "1px solid var(--border-default)",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              No invoices yet.
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-default)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...headerCellStyle, width: "28px", padding: "10px 8px 10px 14px" }}></th>
                    <th style={headerCellStyle}>Invoice #</th>
                    <th style={headerCellStyle}>Deal</th>
                    <th style={headerCellStyle}>Status</th>
                    <th style={{ ...headerCellStyle, textAlign: "right" }}>Total</th>
                    <th style={{ ...headerCellStyle, textAlign: "right" }}>Paid</th>
                    <th style={{ ...headerCellStyle, textAlign: "right" }}>Balance</th>
                    <th style={headerCellStyle}>Created</th>
                    <th style={headerCellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => {
                    const isExpanded = expandedInvoiceId === inv.id;
                    const payments = inv.payments || [];
                    const paidAmt = Number(inv.amountPaid || 0);
                    const totalAmt = Number(inv.total || 0);
                    const balance = Number(inv.balanceDue || 0);
                    const canRecordPayment = inv.status !== "VOID" && inv.status !== "PAID";

                    return (
                      <>
                        <tr key={inv.id} data-testid={`row-invoice-${inv.id}`} style={{ cursor: payments.length > 0 ? "pointer" : "default" }} onClick={() => { if (payments.length > 0) setExpandedInvoiceId(isExpanded ? null : inv.id); }}>
                          <td style={{ ...cellStyle, padding: "12px 8px 12px 14px", width: "28px" }}>
                            {payments.length > 0 && (
                              isExpanded ? <ChevronDown size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                            )}
                          </td>
                          <td style={{ ...cellStyle, fontWeight: 500, ...mono }}>
                            <Link href={`/invoices/${inv.id}`} data-testid={`link-invoice-${inv.id}`} style={{ color: "#10B981", textDecoration: "none", fontWeight: 600 }}>
                              {inv.invoiceNumber || "\u2014"}
                            </Link>
                          </td>
                          <td style={cellStyle}>{inv.opportunity?.title || "\u2014"}</td>
                          <td style={cellStyle}>
                            <span style={getFinancialStatusStyle(inv.status)}>{inv.status === "PARTIALLY_PAID" ? "Partial" : inv.status}</span>
                          </td>
                          <td style={{ ...cellStyle, textAlign: "right", fontWeight: 600, ...mono }}>{formatCurrency(totalAmt)}</td>
                          <td style={{ ...cellStyle, textAlign: "right", fontWeight: 600, color: "#10B981", ...mono }}>
                            {formatCurrency(paidAmt)}
                            <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "11px" }}> of {formatCurrency(totalAmt)}</span>
                          </td>
                          <td style={{ ...cellStyle, textAlign: "right", fontWeight: 600, color: balance > 0 ? "#EF4444" : "#10B981", ...mono }}>
                            {formatCurrency(balance)}
                          </td>
                          <td style={cellStyle}>{formatDate(inv.createdAt)}</td>
                          <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer" data-testid={`action-pdf-invoice-${inv.id}`} style={actionBtnStyle}>
                                <Download size={11} /> PDF
                              </a>
                              {canRecordPayment && (
                                <button
                                  data-testid={`action-record-payment-${inv.id}`}
                                  onClick={() => setPaymentModal({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber || "\u2014", balanceDue: balance })}
                                  style={{ ...actionBtnStyle, backgroundColor: "rgba(16,185,129,0.08)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}
                                >
                                  <CreditCard size={11} /> Pay
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && payments.length > 0 && (
                          <tr key={`${inv.id}-payments`}>
                            <td colSpan={9} style={{ padding: 0, borderBottom: "1px solid var(--border-default)" }}>
                              <div style={{ backgroundColor: "var(--bg-secondary)", padding: "12px 20px 12px 50px" }}>
                                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Payment History</div>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr>
                                      <th style={{ ...headerCellStyle, fontSize: "11px", padding: "6px 10px", backgroundColor: "transparent" }}>Date</th>
                                      <th style={{ ...headerCellStyle, fontSize: "11px", padding: "6px 10px", backgroundColor: "transparent" }}>Method</th>
                                      <th style={{ ...headerCellStyle, fontSize: "11px", padding: "6px 10px", textAlign: "right", backgroundColor: "transparent" }}>Amount</th>
                                      <th style={{ ...headerCellStyle, fontSize: "11px", padding: "6px 10px", backgroundColor: "transparent" }}>Reference</th>
                                      <th style={{ ...headerCellStyle, fontSize: "11px", padding: "6px 10px", backgroundColor: "transparent" }}>Recorded By</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      let runningBalance = totalAmt;
                                      const sortedPayments = [...payments].sort((a: any, b: any) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
                                      return sortedPayments.map((p: any) => {
                                        runningBalance -= Number(p.amount);
                                        return (
                                          <tr key={p.id} data-testid={`row-payment-${p.id}`}>
                                            <td style={{ padding: "8px 10px", fontSize: "12px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-default)" }}>{formatDate(p.paymentDate)}</td>
                                            <td style={{ padding: "8px 10px", fontSize: "12px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-default)" }}>{p.method?.replace(/_/g, " ")}</td>
                                            <td style={{ padding: "8px 10px", fontSize: "12px", fontWeight: 600, color: "#10B981", textAlign: "right", borderBottom: "1px solid var(--border-default)", ...mono }}>{formatCurrency(Number(p.amount))}</td>
                                            <td style={{ padding: "8px 10px", fontSize: "12px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)", ...mono }}>{p.referenceNumber || "\u2014"}</td>
                                            <td style={{ padding: "8px 10px", fontSize: "12px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)" }}>{p.recorder ? `${p.recorder.firstName} ${p.recorder.lastName}` : "\u2014"}</td>
                                          </tr>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </table>
                                {canRecordPayment && (
                                  <button
                                    data-testid={`action-record-payment-inline-${inv.id}`}
                                    onClick={() => setPaymentModal({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber || "\u2014", balanceDue: balance })}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      marginTop: "10px",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "#10B981",
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                    }}
                                  >
                                    <Plus size={13} /> Record Payment
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Account Summary Footer */}
      <div
        data-testid="account-summary"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          border: "1px solid var(--border-default)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "2px" }}>Total Paid</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#10B981", ...mono }}>{formatCurrency(summary.totalPaid)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "2px" }}>Outstanding</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: summary.outstandingBalance > 0 ? "#EF4444" : "var(--text-primary)", ...mono }}>
            {formatCurrency(summary.outstandingBalance)}
          </div>
        </div>
      </div>

      {paymentModal && (
        <RecordPaymentModal
          open={!!paymentModal}
          onClose={() => setPaymentModal(null)}
          invoiceId={paymentModal.invoiceId}
          invoiceNumber={paymentModal.invoiceNumber}
          balanceDue={paymentModal.balanceDue}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}

/* ─── APPOINTMENTS TAB ─── */
interface AppointmentRecord {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  roomName: string | null;
  provider: { id: string; firstName: string; lastName: string } | null;
  configuredType: { id: string; name: string; color: string; durationMins: number; bufferMins: number } | null;
  subcategory: { id: string; name: string } | null;
  opportunity: { id: string; title: string } | null;
}

const NEXT_STATUS_MAP: Record<string, { next: string; label: string; color: string }> = {
  CONFIRMED: { next: "CHECKED_IN", label: "Check In", color: "#10B981" },
  CHECKED_IN: { next: "ROOMED", label: "Room", color: "#3B82F6" },
  ROOMED: { next: "IN_PROGRESS", label: "Start", color: "#8B5CF6" },
  IN_PROGRESS: { next: "ENDED", label: "End", color: "#6B7280" },
  ENDED: { next: "CHECKED_OUT", label: "Check Out", color: "#6B7280" },
};

function getAppointmentStatusStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
  switch (status) {
    case "CONFIRMED":
      return { ...base, backgroundColor: "#DBEAFE", color: "#1E40AF" };
    case "CHECKED_IN":
      return { ...base, backgroundColor: "#D1FAE5", color: "#065F46" };
    case "ROOMED":
      return { ...base, backgroundColor: "rgba(59,130,246,0.1)", color: "#3B82F6" };
    case "IN_PROGRESS":
      return { ...base, backgroundColor: "rgba(139,92,246,0.1)", color: "#8B5CF6" };
    case "ENDED":
      return { ...base, backgroundColor: "#F3F4F6", color: "#6B7280" };
    case "CHECKED_OUT":
      return { ...base, backgroundColor: "#D1FAE5", color: "#065F46" };
    case "CANCELLED":
      return { ...base, backgroundColor: "#FEE2E2", color: "#991B1B" };
    case "NO_SHOW":
      return { ...base, backgroundColor: "#FEF3C7", color: "#92400E" };
    default:
      return { ...base, backgroundColor: "#F3F4F6", color: "#6B7280" };
  }
}

function AppointmentsTab({
  patientId,
  patientName,
  onOpenBooking,
}: {
  patientId: string;
  patientName: string;
  onOpenBooking: (prefill: { appointmentId?: string; patientId?: string; patientName?: string; lockPatient?: boolean }) => void;
}) {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/appointments`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    setUpdatingStatus(appointmentId);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchAppointments();
      }
    } catch { /* ignore */ }
    setUpdatingStatus(null);
  };

  if (loading) return <ContentSkeleton />;

  const now = new Date();
  const upcoming = appointments
    .filter(a => new Date(a.startTime) > now && !["CANCELLED", "CHECKED_OUT"].includes(a.status))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const past = appointments
    .filter(a => new Date(a.startTime) <= now || ["CANCELLED", "CHECKED_OUT"].includes(a.status))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  function renderRow(appt: AppointmentRecord, showStatusActions: boolean) {
    const apptDate = new Date(appt.startTime);
    const endDate = new Date(appt.endTime);
    const nextStatus = NEXT_STATUS_MAP[appt.status];
    const isUpdating = updatingStatus === appt.id;

    return (
      <div
        key={appt.id}
        data-testid={`appointment-row-${appt.id}`}
        onClick={() => onOpenBooking({ appointmentId: appt.id, patientId, patientName, lockPatient: true })}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-default)",
          cursor: "pointer",
          transition: "background-color 100ms",
          opacity: appt.status === "CANCELLED" || appt.status === "NO_SHOW" ? 0.6 : 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div style={{ display: "flex", flexDirection: "column", minWidth: "110px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            {apptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-geist-mono), monospace" }}>
            {apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            {" - "}
            {endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          {appt.configuredType && (
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: appt.configuredType.color,
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {appt.configuredType?.name || appt.title}
            </div>
            {appt.subcategory && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{appt.subcategory.name}</div>
            )}
          </div>
        </div>

        {appt.provider && (
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap", minWidth: "100px" }}>
            Dr. {appt.provider.firstName} {appt.provider.lastName}
          </div>
        )}

        <span style={getAppointmentStatusStyle(appt.status)} data-testid={`status-badge-${appt.id}`}>
          {appt.status.replace(/_/g, " ")}
        </span>

        {appt.opportunity && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }} title={appt.opportunity.title}>
            {appt.opportunity.title}
          </div>
        )}

        {showStatusActions && nextStatus && (
          <button
            data-testid={`button-status-${appt.id}`}
            disabled={isUpdating}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(appt.id, nextStatus.next); }}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: "4px",
              border: "none",
              backgroundColor: nextStatus.color,
              color: "#FFFFFF",
              cursor: isUpdating ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: isUpdating ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            {isUpdating ? "..." : nextStatus.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Appointments ({appointments.length})
        </h3>
        <button
          data-testid="button-book-appointment-tab"
          onClick={() => onOpenBooking({ patientId, patientName, lockPatient: true })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#FFFFFF",
            backgroundColor: "#10B981",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <Plus size={13} />
          Book Appointment
        </button>
      </div>

      {appointments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Calendar size={32} style={{ color: "var(--text-subtle)", marginBottom: "12px" }} />
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>No appointments yet</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", paddingLeft: "4px" }}>
                Upcoming ({upcoming.length})
              </div>
              <div style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-default)", overflow: "hidden" }}>
                {upcoming.map(appt => renderRow(appt, true))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", paddingLeft: "4px" }}>
                Past ({past.length})
              </div>
              <div style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-default)", overflow: "hidden" }}>
                {past.map(appt => renderRow(appt, false))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── PLACEHOLDER TAB ─── */
function PlaceholderTab({ icon: Icon, label }: { icon: typeof Calendar; label: string }) {
  return (
    <div
      data-testid={`placeholder-${label.toLowerCase().replace(/\s/g, "-")}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 20px",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          backgroundColor: "var(--bg-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={28} style={{ color: "var(--text-subtle)" }} />
      </div>
      <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
      <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>Coming Soon</div>
      <span
        style={{
          display: "inline-flex",
          padding: "4px 12px",
          borderRadius: "9999px",
          fontSize: "12px",
          fontWeight: 600,
          backgroundColor: "#D1FAE5",
          color: "#065F46",
        }}
      >
        In Development
      </span>
    </div>
  );
}
