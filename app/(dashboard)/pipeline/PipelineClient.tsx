"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  Check,
  Filter,
  Plus,
  User,
  Sparkles,
  X,
  AlertTriangle,
  CalendarDays,
  Trophy,
  XCircle,
  ChevronRight,
  RotateCcw,
  Star,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import OpportunityPanel from "@/components/pipeline/OpportunityPanel";
import { COUNTRY_CODES, stripNonDigits, formatPhoneAsYouType, formatPhoneDisplay, isValidPhoneLength } from "@/lib/phone";
import { checkEmailTypo } from "@/lib/emailTypo";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function usePortalTarget(id: string) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById(id);
    setTarget(el);
    if (!el) {
      const observer = new MutationObserver(() => {
        const found = document.getElementById(id);
        if (found) { setTarget(found); observer.disconnect(); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [id]);
  return target;
}

interface PipelineInfo {
  id: string;
  name: string;
  totalValue: number;
  velocity: number;
  winRate: number;
  atRisk: number;
}

interface Opportunity {
  id: string;
  patientName: string;
  procedureName: string;
  estimatedValue: number;
  assignedToName: string | null;
  assignedToId?: string | null;
  leadSource: string | null;
  lastActivityAt: string | null;
  createdAt?: string | null;
  daysInStage: number;
  isRotting: boolean;
  rottingDays: number;
  status: string;
  nextAppointment: {
    id: string;
    startTime: string;
    title: string;
  } | null;
  procedureTypeIds?: string[];
  tags?: string[];
  providerId?: string | null;
  providerName?: string | null;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  rottingThresholdHours: number;
  order: number;
  isWon: boolean;
  isLost: boolean;
  opportunities: Opportunity[];
  totalValue: number;
  count: number;
}

interface ClosedOpportunity extends Opportunity {
  closedAt: string | null;
  closedStatus: string | null;
  closedLostReason: string | null;
  lostNote: string | null;
}

interface ClosedColumn {
  opportunities: ClosedOpportunity[];
  count: number;
  totalValue: number;
}

interface BoardData {
  pipeline: PipelineInfo;
  stages: Stage[];
  pipelines: { id: string; name: string }[];
  closedColumns?: {
    won: ClosedColumn;
    lost: ClosedColumn;
  };
}

interface BottomBarData {
  todaysActions: number;
  closingThisWeek: number;
  stalledCount: number;
  stalledLabel: string;
}

interface ActiveFilters {
  myLeads: boolean;
  rottingOnly: boolean;
  highValue: boolean;
  unassigned: boolean;
  lastActivity: string;
  procedures: string[];
  assignedTo: string[];
  createdFrom: string;
  createdTo: string;
  leadSources: string[];
  tags: string[];
  providers: string[];
  valueMin: string;
  valueMax: string;
}

const emptyFilters: ActiveFilters = {
  myLeads: false,
  rottingOnly: false,
  highValue: false,
  unassigned: false,
  lastActivity: "",
  procedures: [],
  assignedTo: [],
  createdFrom: "",
  createdTo: "",
  leadSources: [],
  tags: [],
  providers: [],
  valueMin: "",
  valueMax: "",
};

const mono: React.CSSProperties = { fontFamily: "var(--font-geist-mono)" };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function formatCurrency(val: number) {
  if (val === 0) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatCurrencyAlways(val: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function timeAgoShort(dateStr: string | null) {
  if (!dateStr) return "No activity";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
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

function hasActiveFilters(f: ActiveFilters): boolean {
  return (
    f.myLeads ||
    f.rottingOnly ||
    f.highValue ||
    f.unassigned ||
    f.lastActivity !== "" ||
    f.procedures.length > 0 ||
    f.assignedTo.length > 0 ||
    f.createdFrom !== "" ||
    f.createdTo !== "" ||
    f.leadSources.length > 0 ||
    f.tags.length > 0 ||
    f.providers.length > 0 ||
    f.valueMin !== "" ||
    f.valueMax !== ""
  );
}

function countActiveFilters(f: ActiveFilters): number {
  let c = 0;
  if (f.myLeads) c++;
  if (f.rottingOnly) c++;
  if (f.highValue) c++;
  if (f.unassigned) c++;
  if (f.lastActivity) c++;
  if (f.procedures.length > 0) c++;
  if (f.assignedTo.length > 0) c++;
  if (f.createdFrom || f.createdTo) c++;
  if (f.leadSources.length > 0) c++;
  if (f.tags.length > 0) c++;
  if (f.providers.length > 0) c++;
  if (f.valueMin || f.valueMax) c++;
  return c;
}

function matchesFilters(opp: Opportunity, filters: ActiveFilters, currentUserName?: string): boolean {
  if (filters.myLeads && currentUserName) {
    if (!opp.assignedToName || !opp.assignedToName.toLowerCase().includes(currentUserName.toLowerCase())) return false;
  }
  if (filters.rottingOnly && !opp.isRotting) return false;
  if (filters.highValue && opp.estimatedValue <= 5000) return false;
  if (filters.unassigned && opp.assignedToName) return false;

  if (filters.createdFrom && opp.createdAt) {
    if (new Date(opp.createdAt) < new Date(filters.createdFrom)) return false;
  }
  if (filters.createdTo && opp.createdAt) {
    const toDate = new Date(filters.createdTo);
    toDate.setDate(toDate.getDate() + 1);
    if (new Date(opp.createdAt) > toDate) return false;
  }

  if (filters.lastActivity) {
    const now = Date.now();
    const lastAct = opp.lastActivityAt ? new Date(opp.lastActivityAt).getTime() : 0;
    const diffMs = now - lastAct;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    switch (filters.lastActivity) {
      case "today":
        if (diffDays > 1) return false;
        break;
      case "3days":
        if (diffDays > 3) return false;
        break;
      case "7days":
        if (diffDays > 7) return false;
        break;
      case "30days":
        if (diffDays > 30) return false;
        break;
      case "none":
        if (opp.lastActivityAt) return false;
        break;
    }
  }

  if (filters.procedures.length > 0) {
    const oppProcIds = opp.procedureTypeIds ?? [];
    if (oppProcIds.length === 0 || !filters.procedures.some((id) => oppProcIds.includes(id))) return false;
  }

  if (filters.assignedTo.length > 0) {
    if (!opp.assignedToName || !filters.assignedTo.includes(opp.assignedToName)) return false;
  }

  if (filters.leadSources.length > 0) {
    if (!opp.leadSource || !filters.leadSources.includes(opp.leadSource)) return false;
  }

  if (filters.tags.length > 0) {
    const oppTags = opp.tags ?? [];
    if (oppTags.length === 0 || !filters.tags.some((t) => oppTags.includes(t))) return false;
  }

  if (filters.providers.length > 0) {
    if (!opp.providerName || !filters.providers.includes(opp.providerName)) return false;
  }

  if (filters.valueMin) {
    const min = Number(filters.valueMin);
    if (!isNaN(min) && opp.estimatedValue < min) return false;
  }

  if (filters.valueMax) {
    const max = Number(filters.valueMax);
    if (!isNaN(max) && opp.estimatedValue > max) return false;
  }

  return true;
}

function formatApptDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1) return `${Math.abs(diffDays)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CardIndicator({ opp }: { opp: Opportunity }) {
  if (opp.nextAppointment) {
    const apptDate = new Date(opp.nextAppointment.startTime);
    const isPast = apptDate.getTime() < Date.now();
    const color = isPast ? "#D97706" : "#10B981";
    return (
      <div className="flex items-center" style={{ gap: "4px", flexShrink: 0 }}>
        <CalendarDays size={12} style={{ color }} />
        <span style={{ fontSize: "12px", fontWeight: 600, color, ...mono }}>
          {formatApptDate(opp.nextAppointment.startTime)}
        </span>
      </div>
    );
  }

  if (opp.isRotting && opp.rottingDays > 0) {
    const days = opp.rottingDays >= 30 ? "30+" : `${opp.rottingDays}`;
    let color = "#D97706";
    let weight = 600;
    if (opp.rottingDays >= 14) { color = "#991B1B"; weight = 700; }
    else if (opp.rottingDays >= 7) { color = "#DC2626"; }
    return (
      <span style={{ fontSize: "12px", fontWeight: weight, color, flexShrink: 0, ...mono }}>
        {days}d overdue
      </span>
    );
  }

  return null;
}

function SortableCard({
  opp,
  stageColor,
  cardIndex,
  onCardClick,
}: {
  opp: Opportunity;
  stageColor: string;
  cardIndex: number;
  onCardClick?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opp.id,
    data: { type: "card", opp },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PipelineCard opp={opp} stageColor={stageColor} cardIndex={cardIndex} onCardClick={onCardClick} />
    </div>
  );
}

function PipelineCard({
  opp,
  stageColor,
  cardIndex,
  overlay,
  onCardClick,
}: {
  opp: Opportunity;
  stageColor: string;
  cardIndex: number;
  overlay?: boolean;
  onCardClick?: (id: string) => void;
}) {
  const valDisplay = opp.estimatedValue === 0 ? "\u2014" : formatCurrencyAlways(opp.estimatedValue);
  const hasRedTint = opp.isRotting && opp.rottingDays >= 7;

  return (
    <div
      data-testid={`card-opportunity-${opp.id}`}
      className="pipeline-card"
      onClick={(e) => {
        if (onCardClick) {
          e.stopPropagation();
          onCardClick(opp.id);
        }
      }}
      style={{
        height: "108px",
        minHeight: "108px",
        maxHeight: "108px",
        overflow: "hidden",
        backgroundColor: hasRedTint ? "rgba(239, 68, 68, 0.03)" : "var(--card-bg)",
        border: hasRedTint
          ? "1px solid rgba(239, 68, 68, 0.15)"
          : "1px solid rgba(0,0,0,0.06)",
        borderLeft: `3px solid ${hasRedTint ? "rgba(239, 68, 68, 0.5)" : stageColor}`,
        borderRadius: "8px",
        padding: "10px 12px 10px 11px",
        cursor: overlay ? "grabbing" : "pointer",
        boxShadow: overlay
          ? "0 12px 32px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.1)"
          : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        transition: "box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease",
        animation: overlay ? "none" : `fadeUp 200ms ease-out ${cardIndex * 30}ms both`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: hasRedTint
          ? "rgba(239, 68, 68, 0.03)"
          : "linear-gradient(to bottom, #FFFFFF, #FDFCFB)",
      }}
      onMouseEnter={(e) => {
        if (overlay) return;
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        if (overlay) return;
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >

      <div className="flex items-center justify-between" style={{ gap: "6px" }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
          data-testid={`text-patient-${opp.id}`}
        >
          {opp.patientName}
        </span>
        <CardIndicator opp={opp} />
      </div>

      <div className="flex items-center justify-between" style={{ gap: "6px" }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
        >
          {opp.procedureName}
        </span>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            ...mono,
          }}
          data-testid={`text-value-${opp.id}`}
        >
          {valDisplay}
        </span>
      </div>

      <div className="flex items-center justify-between" style={{ gap: "6px" }}>
        <div className="flex items-center" style={{ gap: "4px", minWidth: 0, flex: 1 }}>
          <User size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {opp.assignedToName ? opp.assignedToName.split(" ")[0] : "Unassigned"}
          </span>
        </div>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--text-subtle)",
            whiteSpace: "nowrap",
            ...mono,
          }}
        >
          {opp.daysInStage === 0 ? "Today" : timeAgoShort(opp.lastActivityAt)}
        </span>
      </div>
    </div>
  );
}

interface DuplicateMatch {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  updatedAt: string | null;
}

function PatientMatchCard({
  match,
  onAddDeal,
  onDismiss,
}: {
  match: DuplicateMatch;
  onAddDeal: () => void;
  onDismiss: () => void;
}) {
  const initials = `${match.firstName?.[0] ?? ""}${match.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      data-testid={`match-card-${match.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        backgroundColor: "#F0FDF4",
        borderRadius: "8px",
        border: "1px solid #A7F3D0",
      }}
    >
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#065F46", flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          {match.firstName} {match.lastName}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
          {match.phone ? formatPhoneDisplay(match.phone) : ""}{match.phone && match.email ? " · " : ""}{match.email || ""}
        </div>
        <span style={{ fontSize: "10px", fontWeight: 500, color: "#059669", backgroundColor: "#ECFDF5", padding: "1px 6px", borderRadius: "4px", marginTop: "2px", display: "inline-block" }}>Existing patient</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
        <button
          data-testid={`button-add-deal-existing-${match.id}`}
          onClick={onAddDeal}
          style={{ fontSize: "11px", fontWeight: 600, color: "#FFFFFF", backgroundColor: "#10B981", border: "none", borderRadius: "5px", padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Add deal to this patient
        </button>
        <button
          data-testid={`button-dismiss-match-${match.id}`}
          onClick={onDismiss}
          style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 0", textAlign: "center" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function QuickAddModal({
  open,
  onClose,
  stages,
  pipelineId,
  prefilledPatient,
}: {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
  pipelineId: string;
  prefilledPatient?: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null } | null;
}) {
  const queryClient = useQueryClient();
  const isExistingPatientMode = !!prefilledPatient;

  const { data: leadSourceOptions = [] } = useQuery<{ id: string; name: string; channelType: string }[]>({
    queryKey: ["/api/settings/lead-sources", { includeArchived: false }],
    queryFn: async () => {
      const res = await fetch("/api/settings/lead-sources?includeArchived=false");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: procedureTypeOptions = [] } = useQuery<{ id: string; name: string; category: string }[]>({
    queryKey: ["/api/settings/procedure-types", { includeArchived: false }],
    queryFn: async () => {
      const res = await fetch("/api/settings/procedure-types?includeArchived=false");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [form, setForm] = useState({
    firstName: prefilledPatient?.firstName ?? "",
    lastName: prefilledPatient?.lastName ?? "",
    phoneDisplay: prefilledPatient?.phone ? formatPhoneDisplay(prefilledPatient.phone) : "",
    phoneDigits: prefilledPatient?.phone ? stripNonDigits(prefilledPatient.phone).slice(-10) : "",
    email: prefilledPatient?.email ?? "",
    countryCode: "US",
    selectedProcedureIds: [] as string[],
    title: "",
    estimatedValue: "",
    leadSource: "",
    stageId: stages[0]?.id ?? "",
    notes: "",
  });
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [procedureDropdownOpen, setProcedureDropdownOpen] = useState(false);
  const procedureRef = useRef<HTMLDivElement>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [dismissedMatchIds, setDismissedMatchIds] = useState<Set<string>>(new Set());
  const [selectedExistingPatient, setSelectedExistingPatient] = useState<DuplicateMatch | null>(prefilledPatient ? { ...prefilledPatient, updatedAt: null } : null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [emailSuggestionDismissed, setEmailSuggestionDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dupCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [extraMatchCount, setExtraMatchCount] = useState(0);

  useEffect(() => {
    if (prefilledPatient) {
      setForm(f => ({
        ...f,
        firstName: prefilledPatient.firstName,
        lastName: prefilledPatient.lastName,
        phoneDisplay: prefilledPatient.phone ? formatPhoneDisplay(prefilledPatient.phone) : "",
        phoneDigits: prefilledPatient.phone ? stripNonDigits(prefilledPatient.phone).slice(-10) : "",
        email: prefilledPatient.email ?? "",
      }));
      setSelectedExistingPatient({ ...prefilledPatient, updatedAt: null });
    }
  }, [prefilledPatient]);

  function generateTitle(ids: string[]): string {
    const names = ids.map((id) => procedureTypeOptions.find((pt) => pt.id === id)?.name).filter(Boolean) as string[];
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} + ${names[1]}`;
    return `${names[0]} + ${names[1]} +${names.length - 2}`;
  }

  useEffect(() => {
    if (open && stages.length > 0 && !form.stageId) {
      setForm((f) => ({ ...f, stageId: stages[0].id }));
    }
  }, [open, stages, form.stageId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (procedureRef.current && !procedureRef.current.contains(e.target as Node)) {
        setProcedureDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function checkDuplicates(phoneDigits?: string, emailVal?: string) {
    if (isExistingPatientMode || selectedExistingPatient) return;
    const params = new URLSearchParams();
    if (phoneDigits && phoneDigits.length >= 10) params.set("phone", phoneDigits);
    if (emailVal && emailVal.includes("@")) params.set("email", emailVal);
    if (!params.toString()) return;
    try {
      const res = await fetch(`/api/patients/duplicates?${params.toString()}`);
      if (!res.ok) return;
      const matches: DuplicateMatch[] = await res.json();
      if (matches.length > 2) {
        setExtraMatchCount(matches.length - 2);
        setDuplicateMatches(matches.slice(0, 2));
      } else {
        setExtraMatchCount(0);
        setDuplicateMatches(matches);
      }
    } catch { /* ignore */ }
  }

  function handlePhoneChange(raw: string) {
    const digits = stripNonDigits(raw).slice(0, 10);
    const display = formatPhoneAsYouType(digits);
    setForm(f => ({ ...f, phoneDigits: digits, phoneDisplay: display }));
    setDuplicateMatches([]);
    setDismissedMatchIds(new Set());
    setSelectedExistingPatient(null);

    if (dupCheckTimerRef.current) clearTimeout(dupCheckTimerRef.current);
    const cc = COUNTRY_CODES.find(c => c.code === form.countryCode);
    if (digits.length === (cc?.digits ?? 10)) {
      dupCheckTimerRef.current = setTimeout(() => checkDuplicates(digits, form.email || undefined), 300);
    }
  }

  function handleEmailBlur() {
    if (form.email && !emailSuggestionDismissed) {
      const suggestion = checkEmailTypo(form.email);
      setEmailSuggestion(suggestion);
    }
    if (form.email && form.email.includes("@") && !selectedExistingPatient && !isExistingPatientMode) {
      checkDuplicates(form.phoneDigits.length >= 10 ? form.phoneDigits : undefined, form.email);
    }
  }

  function handleSelectExistingPatient(match: DuplicateMatch) {
    setSelectedExistingPatient(match);
    setForm(f => ({
      ...f,
      firstName: match.firstName,
      lastName: match.lastName,
      phoneDisplay: match.phone ? formatPhoneDisplay(match.phone) : f.phoneDisplay,
      phoneDigits: match.phone ? stripNonDigits(match.phone).slice(-10) : f.phoneDigits,
      email: match.email || f.email,
    }));
    setDuplicateMatches([]);
  }

  function handleCancelExistingPatient() {
    setSelectedExistingPatient(null);
  }

  if (!open) return null;

  const canSubmit = isExistingPatientMode || selectedExistingPatient
    ? form.selectedProcedureIds.length > 0
    : form.firstName.trim() && form.lastName.trim() && form.phoneDigits.length >= 10 && form.selectedProcedureIds.length > 0;

  function toggleProcedure(id: string) {
    setForm((prev) => {
      const newIds = prev.selectedProcedureIds.includes(id)
        ? prev.selectedProcedureIds.filter((pid) => pid !== id)
        : [...prev.selectedProcedureIds, id];
      const newTitle = titleManuallyEdited && newIds.length > 0 ? prev.title : generateTitle(newIds);
      if (newIds.length === 0) setTitleManuallyEdited(false);
      return { ...prev, selectedProcedureIds: newIds, title: newTitle };
    });
  }

  function removeProcedure(id: string) {
    setForm((prev) => {
      const newIds = prev.selectedProcedureIds.filter((pid) => pid !== id);
      const newTitle = titleManuallyEdited && newIds.length > 0 ? prev.title : generateTitle(newIds);
      if (newIds.length === 0) setTitleManuallyEdited(false);
      return { ...prev, selectedProcedureIds: newIds, title: newTitle };
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const cc = COUNTRY_CODES.find(c => c.code === form.countryCode);
      const payload: Record<string, any> = {
        procedureTypeIds: form.selectedProcedureIds,
        title: form.title,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        leadSource: form.leadSource,
        stageId: form.stageId,
        notes: form.notes,
        pipelineId,
      };

      if (isExistingPatientMode && prefilledPatient) {
        payload.patientId = prefilledPatient.id;
      } else if (selectedExistingPatient) {
        payload.patientId = selectedExistingPatient.id;
      } else {
        payload.firstName = form.firstName;
        payload.lastName = form.lastName;
        payload.phone = form.phoneDigits;
        payload.email = form.email;
        payload.countryDialCode = cc?.dial || "1";
        payload.force = true;
      }

      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSubmitting(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      resetForm();
      onClose();
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  function resetForm() {
    setForm({ firstName: "", lastName: "", phoneDisplay: "", phoneDigits: "", email: "", countryCode: "US", selectedProcedureIds: [], title: "", estimatedValue: "", leadSource: "", stageId: stages[0]?.id ?? "", notes: "" });
    setTitleManuallyEdited(false);
    setDuplicateMatches([]);
    setDismissedMatchIds(new Set());
    setSelectedExistingPatient(null);
    setEmailSuggestion(null);
    setEmailSuggestionDismissed(false);
    setExtraMatchCount(0);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "#FFFFFF",
    color: "var(--text-primary)",
    transition: "border-color 150ms",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: "4px",
  };

  const readOnlyInputStyle: React.CSSProperties = {
    ...inputStyle,
    backgroundColor: "#F3F4F6",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  };

  const patientLocked = isExistingPatientMode || !!selectedExistingPatient;
  const cc = COUNTRY_CODES.find(c => c.code === form.countryCode);
  const visibleMatches = duplicateMatches.filter(m => !dismissedMatchIds.has(m.id));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) { resetForm(); onClose(); } }}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "12px",
          width: "480px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
          animation: "fadeUp 200ms ease-out both",
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-default)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {patientLocked ? "Add Deal" : "Add Deal"}
          </h2>
          <button data-testid="button-close-modal" onClick={() => { resetForm(); onClose(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {patientLocked && !isExistingPatientMode && selectedExistingPatient && (
          <div style={{ margin: "12px 24px 0", padding: "10px 12px", backgroundColor: "#F0FDF4", borderRadius: "8px", border: "1px solid #A7F3D0", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#065F46", flexShrink: 0 }}>
              {`${selectedExistingPatient.firstName?.[0] ?? ""}${selectedExistingPatient.lastName?.[0] ?? ""}`.toUpperCase()}
            </div>
            <div style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              Adding deal for {selectedExistingPatient.firstName} {selectedExistingPatient.lastName}
            </div>
            <button data-testid="button-cancel-existing" onClick={handleCancelExistingPatient} style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
              Change
            </button>
          </div>
        )}

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {!patientLocked && (
            <>
              <div className="flex" style={{ gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>First Name *</label>
                  <input data-testid="input-firstname" style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Last Name *</label>
                  <input data-testid="input-lastname" style={inputStyle} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }} />
                </div>
              </div>
              <div className="flex" style={{ gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Phone *</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select
                      data-testid="select-country-code"
                      value={form.countryCode}
                      onChange={(e) => setForm(f => ({ ...f, countryCode: e.target.value }))}
                      style={{ ...inputStyle, width: "90px", flex: "none", cursor: "pointer", padding: "8px 6px" }}
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} +{c.dial}</option>
                      ))}
                    </select>
                    <input
                      data-testid="input-phone"
                      style={{ ...inputStyle, flex: 1 }}
                      value={form.phoneDisplay}
                      placeholder="(305) 555-1014"
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Email</label>
                  <input
                    data-testid="input-email"
                    style={inputStyle}
                    value={form.email}
                    onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailSuggestion(null); setEmailSuggestionDismissed(false); }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; handleEmailBlur(); }}
                  />
                  {emailSuggestion && !emailSuggestionDismissed && (
                    <div data-testid="email-typo-suggestion" style={{ fontSize: "12px", color: "#D97706", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span>Did you mean <strong>{emailSuggestion}</strong>?</span>
                      <button
                        data-testid="button-accept-email-suggestion"
                        onClick={() => { setForm(f => ({ ...f, email: emailSuggestion! })); setEmailSuggestion(null); }}
                        style={{ fontSize: "11px", fontWeight: 600, color: "#10B981", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}
                      >
                        Yes, use this
                      </button>
                      <button
                        data-testid="button-dismiss-email-suggestion"
                        onClick={() => { setEmailSuggestionDismissed(true); setEmailSuggestion(null); }}
                        style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}
                      >
                        No, keep it
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {visibleMatches.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {visibleMatches.map(m => (
                    <PatientMatchCard
                      key={m.id}
                      match={m}
                      onAddDeal={() => handleSelectExistingPatient(m)}
                      onDismiss={() => setDismissedMatchIds(prev => new Set([...prev, m.id]))}
                    />
                  ))}
                  {extraMatchCount > 0 && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "2px 0" }}>
                      and {extraMatchCount} more matches — search patients
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {patientLocked && isExistingPatientMode && prefilledPatient && (
            <div className="flex" style={{ gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Patient</label>
                <input style={readOnlyInputStyle} value={`${prefilledPatient.firstName} ${prefilledPatient.lastName}`} readOnly />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Phone</label>
                <input style={readOnlyInputStyle} value={prefilledPatient.phone ? formatPhoneDisplay(prefilledPatient.phone) : ""} readOnly />
              </div>
            </div>
          )}

          <div ref={procedureRef} style={{ position: "relative" }}>
            <label style={labelStyle}>Procedure Interest *</label>
            <div
              data-testid="input-procedure-chips"
              onClick={() => setProcedureDropdownOpen((v) => !v)}
              style={{
                ...inputStyle,
                cursor: "pointer",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                minHeight: "38px",
                alignItems: "center",
                padding: "6px 12px",
              }}
            >
              {form.selectedProcedureIds.length === 0 && (
                <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Select procedures...</span>
              )}
              {form.selectedProcedureIds.map((id) => {
                const pt = procedureTypeOptions.find((p) => p.id === id);
                return (
                  <span
                    key={id}
                    data-testid={`chip-procedure-${id}`}
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
                    {pt?.name || id}
                    <button
                      data-testid={`remove-procedure-${id}`}
                      onClick={(e) => { e.stopPropagation(); removeProcedure(id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", color: "#065F46" }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
            {procedureDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid var(--border-default)",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  maxHeight: "200px",
                  overflowY: "auto",
                  marginTop: "4px",
                }}
              >
                {procedureTypeOptions.map((pt) => {
                  const isSelected = form.selectedProcedureIds.includes(pt.id);
                  return (
                    <div
                      key={pt.id}
                      data-testid={`option-procedure-${pt.id}`}
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
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <div style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "3px",
                        border: isSelected ? "none" : "1px solid #D1D5DB",
                        backgroundColor: isSelected ? "#10B981" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
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
            <input
              data-testid="input-title"
              style={inputStyle}
              value={form.title}
              placeholder={form.selectedProcedureIds.length === 0 ? "Auto-generated from procedures" : ""}
              onChange={(e) => {
                setTitleManuallyEdited(true);
                setForm({ ...form, title: e.target.value });
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
            />
          </div>
          <div className="flex" style={{ gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Estimated Value ($)</label>
              <input data-testid="input-value" type="number" style={inputStyle} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Source</label>
              <select data-testid="select-source" style={{ ...inputStyle, cursor: "pointer" }} value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}>
                <option value="">Select...</option>
                {leadSourceOptions.map((ls) => (
                  <option key={ls.id} value={ls.name}>{ls.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Stage</label>
            <select data-testid="select-stage" style={{ ...inputStyle, cursor: "pointer" }} value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea data-testid="input-notes" rows={2} style={{ ...inputStyle, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }} />
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button data-testid="button-cancel-modal" onClick={() => { resetForm(); onClose(); }} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            data-testid="button-submit-lead"
            disabled={!canSubmit || submitting}
            onClick={() => handleSubmit()}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: canSubmit && !submitting ? "#10B981" : "#9CA3AF",
              border: "none",
              borderRadius: "6px",
              cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
              transition: "background-color 150ms",
            }}
          >
            {submitting ? "Adding..." : "Add Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SavedFilterItem {
  id: string;
  name: string;
  filters: ActiveFilters;
  visibility: "PUBLIC" | "PRIVATE";
  isStarred: boolean;
  createdBy: string;
}

function ChecklistFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayOptions = expanded ? options : options.slice(0, 4);

  return (
    <div>
      <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "3px", display: "block" }}>{label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {displayOptions.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <label
              key={opt.id}
              className="flex items-center"
              style={{ gap: "6px", padding: "3px 0", cursor: "pointer", fontSize: "12px", color: "var(--text-primary)" }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  if (checked) onChange(selected.filter((id) => id !== opt.id));
                  else onChange([...selected, opt.id]);
                }}
                style={{ accentColor: "#10B981", width: "14px", height: "14px" }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.name}</span>
            </label>
          );
        })}
        {options.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: "11px", color: "#10B981", background: "none", border: "none", cursor: "pointer", padding: "2px 0", textAlign: "left" }}
          >
            {expanded ? "Show less" : `+${options.length - 4} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterPanel({
  open,
  onClose,
  filters,
  setFilters,
  stages,
  totalCount,
  filteredCount,
  filterBtnRef,
}: {
  open: boolean;
  onClose: () => void;
  filters: ActiveFilters;
  setFilters: (f: ActiveFilters) => void;
  stages: Stage[];
  totalCount: number;
  filteredCount: number;
  filterBtnRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ActiveFilters>(filters);
  const [savingFilter, setSavingFilter] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: "", visibility: "PRIVATE" as "PUBLIC" | "PRIVATE" });
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", visibility: "PRIVATE" as "PUBLIC" | "PRIVATE" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useUser();
  const userId = user?.id;

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        (!filterBtnRef?.current || !filterBtnRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, filterBtnRef]);

  const { data: procedureTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/settings/procedure-types", { includeArchived: false }],
    queryFn: async () => {
      const res = await fetch("/api/settings/procedure-types?includeArchived=false");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: leadSources = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/settings/lead-sources", { includeArchived: false }],
    queryFn: async () => {
      const res = await fetch("/api/settings/lead-sources?includeArchived=false");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: practiceTags = [] } = useQuery<{ id: string; name: string; color: string }[]>({
    queryKey: ["/api/practices/tags"],
    queryFn: async () => {
      const res = await fetch("/api/practices/tags");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: savedFilters = [], refetch: refetchSaved } = useQuery<SavedFilterItem[]>({
    queryKey: ["/api/pipeline/saved-filters"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline/saved-filters");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const allAssignees = useMemo(() => {
    const set = new Set<string>();
    stages.forEach((s) => s.opportunities.forEach((o) => { if (o.assignedToName) set.add(o.assignedToName); }));
    return Array.from(set).sort();
  }, [stages]);

  const allProviders = useMemo(() => {
    const map = new Map<string, string>();
    stages.forEach((s) => s.opportunities.forEach((o) => {
      if (o.providerName && o.providerId) map.set(o.providerName, o.providerName);
    }));
    return Array.from(map.keys()).sort();
  }, [stages]);

  const starredFilters = savedFilters.filter((f) => f.isStarred);

  if (!open) return null;

  const sectionLabel: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    marginBottom: "8px",
  };

  const pillBase: React.CSSProperties = {
    padding: "5px 12px",
    fontSize: "12px",
    fontWeight: 500,
    borderRadius: "16px",
    border: "none",
    cursor: "pointer",
    transition: "all 120ms",
  };

  function pill(active: boolean): React.CSSProperties {
    return {
      ...pillBase,
      backgroundColor: active ? "#10B981" : "var(--bg-tertiary)",
      color: active ? "#FFFFFF" : "var(--text-secondary)",
    };
  }

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: "12px",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "#FFFFFF",
    color: "var(--text-primary)",
  };

  const isFiltered = hasActiveFilters(draft);

  async function handleSaveFilter() {
    if (!saveForm.name.trim()) return;
    try {
      await fetch("/api/pipeline/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveForm.name.trim(), filters: draft, visibility: saveForm.visibility }),
      });
      setSavingFilter(false);
      setSaveForm({ name: "", visibility: "PRIVATE" });
      refetchSaved();
    } catch {}
  }

  async function handleUpdateFilter(id: string) {
    if (!editForm.name.trim()) return;
    try {
      await fetch(`/api/pipeline/saved-filters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editForm.name.trim(), visibility: editForm.visibility }),
      });
      setEditingFilterId(null);
      refetchSaved();
    } catch {}
  }

  async function handleDeleteFilter(id: string) {
    try {
      await fetch(`/api/pipeline/saved-filters/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      refetchSaved();
    } catch {}
  }

  async function handleToggleStar(id: string, current: boolean) {
    try {
      await fetch(`/api/pipeline/saved-filters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: !current }),
      });
      refetchSaved();
    } catch {}
  }

  function applySavedFilter(sf: SavedFilterItem) {
    const f = { ...emptyFilters, ...sf.filters };
    setDraft(f);
    setFilters(f);
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: "4px",
        width: "340px",
        backgroundColor: "#FFFFFF",
        borderRadius: "10px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        border: "1px solid var(--border-default)",
        zIndex: 60,
        animation: "fadeUp 150ms ease-out both",
        maxHeight: "calc(100vh - 140px)",
        overflowY: "auto",
      }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between" style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-default)" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Filters</span>
        <button
          data-testid="button-close-filter-panel"
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--text-muted)", display: "flex", alignItems: "center" }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Quick filter pills */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-default)" }}>
        <p style={sectionLabel}>QUICK FILTERS</p>
        <div className="flex flex-wrap" style={{ gap: "6px" }}>
          <button data-testid="pill-my-leads" style={pill(draft.myLeads)} onClick={() => setDraft({ ...draft, myLeads: !draft.myLeads })}>My Deals</button>
          <button data-testid="pill-rotting" style={pill(draft.rottingOnly)} onClick={() => setDraft({ ...draft, rottingOnly: !draft.rottingOnly })}>Rotting Only</button>
          <button data-testid="pill-high-value" style={pill(draft.highValue)} onClick={() => setDraft({ ...draft, highValue: !draft.highValue })}>High Value</button>
          <button data-testid="pill-unassigned" style={pill(draft.unassigned)} onClick={() => setDraft({ ...draft, unassigned: !draft.unassigned })}>Unassigned</button>
          {starredFilters.map((sf) => (
            <button
              key={sf.id}
              data-testid={`pill-saved-${sf.id}`}
              style={pillBase}
              className="flex items-center"
              onClick={() => applySavedFilter(sf)}
            >
              <Star size={10} style={{ marginRight: "4px", color: "#F59E0B", fill: "#F59E0B" }} />
              {sf.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom filters */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ ...sectionLabel, marginBottom: "0" }}>CUSTOM FILTERS</p>

        {/* 1. Created Date */}
        <div>
          <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "3px", display: "block" }}>Created Date</label>
          <div className="flex" style={{ gap: "6px" }}>
            <input type="date" data-testid="input-filter-created-from" style={{ ...selectStyle, flex: 1 }} value={draft.createdFrom} onChange={(e) => setDraft({ ...draft, createdFrom: e.target.value })} />
            <input type="date" data-testid="input-filter-created-to" style={{ ...selectStyle, flex: 1 }} value={draft.createdTo} onChange={(e) => setDraft({ ...draft, createdTo: e.target.value })} />
          </div>
        </div>

        {/* 2. Last Activity */}
        <div>
          <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "3px", display: "block" }}>Last Activity</label>
          <select data-testid="select-filter-last-activity" style={selectStyle} value={draft.lastActivity} onChange={(e) => setDraft({ ...draft, lastActivity: e.target.value })}>
            <option value="">Any time</option>
            <option value="today">Today</option>
            <option value="3days">Last 3 days</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="none">No activity</option>
          </select>
        </div>

        {/* 3. Procedure (from managed list) */}
        <ChecklistFilter
          label="Procedure"
          options={procedureTypes.map((pt) => ({ id: pt.id, name: pt.name }))}
          selected={draft.procedures}
          onChange={(ids) => setDraft({ ...draft, procedures: ids })}
        />

        {/* 4. Source */}
        <ChecklistFilter
          label="Source"
          options={leadSources.map((ls) => ({ id: ls.name, name: ls.name }))}
          selected={draft.leadSources}
          onChange={(ids) => setDraft({ ...draft, leadSources: ids })}
        />

        {/* 5. Tag */}
        <ChecklistFilter
          label="Tag"
          options={practiceTags.map((t) => ({ id: t.name, name: t.name }))}
          selected={draft.tags}
          onChange={(ids) => setDraft({ ...draft, tags: ids })}
        />

        {/* 6. Assigned To */}
        <ChecklistFilter
          label="Assigned To"
          options={allAssignees.map((a) => ({ id: a, name: a }))}
          selected={draft.assignedTo}
          onChange={(ids) => setDraft({ ...draft, assignedTo: ids })}
        />

        {/* 7. Provider */}
        <ChecklistFilter
          label="Provider"
          options={allProviders.map((p) => ({ id: p, name: p }))}
          selected={draft.providers}
          onChange={(ids) => setDraft({ ...draft, providers: ids })}
        />

        {/* 8. Estimated Value */}
        <div>
          <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "3px", display: "block" }}>Estimated Value</label>
          <div className="flex" style={{ gap: "6px" }}>
            <input
              type="number"
              data-testid="input-filter-value-min"
              placeholder="Min $"
              style={{ ...selectStyle, flex: 1 }}
              value={draft.valueMin}
              onChange={(e) => setDraft({ ...draft, valueMin: e.target.value })}
            />
            <input
              type="number"
              data-testid="input-filter-value-max"
              placeholder="Max $"
              style={{ ...selectStyle, flex: 1 }}
              value={draft.valueMax}
              onChange={(e) => setDraft({ ...draft, valueMax: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Saved Filters section */}
      {savedFilters.length > 0 && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-default)" }}>
          <p style={{ ...sectionLabel, marginBottom: "6px" }}>SAVED FILTERS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {savedFilters.map((sf) => (
              <div key={sf.id}>
                {editingFilterId === sf.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "6px 0" }}>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value.slice(0, 48) })}
                      style={{ ...selectStyle }}
                      placeholder="Filter name"
                      autoFocus
                    />
                    <div className="flex items-center" style={{ gap: "8px" }}>
                      <label className="flex items-center" style={{ gap: "4px", fontSize: "11px", cursor: "pointer", color: "var(--text-secondary)" }}>
                        <input type="radio" name={`edit-vis-${sf.id}`} checked={editForm.visibility === "PRIVATE"} onChange={() => setEditForm({ ...editForm, visibility: "PRIVATE" })} style={{ accentColor: "#10B981" }} />
                        Private
                      </label>
                      <label className="flex items-center" style={{ gap: "4px", fontSize: "11px", cursor: "pointer", color: "var(--text-secondary)" }}>
                        <input type="radio" name={`edit-vis-${sf.id}`} checked={editForm.visibility === "PUBLIC"} onChange={() => setEditForm({ ...editForm, visibility: "PUBLIC" })} style={{ accentColor: "#10B981" }} />
                        Public
                      </label>
                    </div>
                    <div className="flex items-center" style={{ gap: "6px" }}>
                      <button
                        onClick={() => handleUpdateFilter(sf.id)}
                        style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#FFFFFF", backgroundColor: "#10B981", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingFilterId(null)}
                        style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : deleteConfirm === sf.id ? (
                  <div style={{ padding: "6px 0" }}>
                    <p style={{ fontSize: "12px", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Delete &ldquo;{sf.name}&rdquo;? This cannot be undone.
                    </p>
                    <div className="flex items-center" style={{ gap: "6px" }}>
                      <button
                        onClick={() => handleDeleteFilter(sf.id)}
                        style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#FFFFFF", backgroundColor: "#EF4444", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between"
                    style={{ padding: "4px 0", gap: "6px" }}
                  >
                    <button
                      data-testid={`button-apply-saved-${sf.id}`}
                      onClick={() => applySavedFilter(sf)}
                      style={{ fontSize: "12px", color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", textAlign: "left", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: 0 }}
                    >
                      {sf.name}
                    </button>
                    <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-muted)", flexShrink: 0, padding: "1px 5px", borderRadius: "3px", backgroundColor: "var(--bg-tertiary)" }}>
                      {sf.visibility === "PUBLIC" ? "Public" : "Private"}
                    </span>
                    <div className="flex items-center" style={{ gap: "2px", flexShrink: 0 }}>
                      <button
                        data-testid={`button-star-${sf.id}`}
                        onClick={() => handleToggleStar(sf.id, sf.isStarred)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: sf.isStarred ? "#F59E0B" : "var(--text-muted)", display: "flex" }}
                      >
                        <Star size={12} fill={sf.isStarred ? "#F59E0B" : "none"} />
                      </button>
                      {sf.createdBy === userId && (
                        <>
                          <button
                            data-testid={`button-edit-saved-${sf.id}`}
                            onClick={() => { setEditingFilterId(sf.id); setEditForm({ name: sf.name, visibility: sf.visibility }); }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--text-muted)", display: "flex" }}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            data-testid={`button-delete-saved-${sf.id}`}
                            onClick={() => setDeleteConfirm(sf.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--text-muted)", display: "flex" }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Clear All / Save filter / Apply */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          data-testid="button-clear-filters"
          onClick={() => {
            setDraft({ ...emptyFilters });
            setFilters({ ...emptyFilters });
          }}
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          Clear All
        </button>

        <div className="flex items-center" style={{ gap: "10px" }}>
          {isFiltered && !savingFilter && (
            <button
              data-testid="button-save-filter"
              onClick={() => setSavingFilter(true)}
              style={{ fontSize: "11px", color: "#10B981", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Save filter...
            </button>
          )}
          {isFiltered && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", ...mono }}>
              {filteredCount} of {totalCount}
            </span>
          )}
          <button
            data-testid="button-apply-filters"
            onClick={() => {
              setFilters(draft);
              onClose();
            }}
            style={{
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
            Apply Filters
          </button>
        </div>
      </div>

      {/* Inline save form */}
      {savingFilter && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-default)", display: "flex", flexDirection: "column", gap: "6px" }}>
          <input
            type="text"
            data-testid="input-save-filter-name"
            value={saveForm.name}
            onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value.slice(0, 48) })}
            placeholder="Filter name"
            style={{ ...selectStyle }}
            autoFocus
          />
          <div className="flex items-center" style={{ gap: "8px" }}>
            <label className="flex items-center" style={{ gap: "4px", fontSize: "11px", cursor: "pointer", color: "var(--text-secondary)" }}>
              <input type="radio" name="save-vis" checked={saveForm.visibility === "PRIVATE"} onChange={() => setSaveForm({ ...saveForm, visibility: "PRIVATE" })} style={{ accentColor: "#10B981" }} />
              Private
            </label>
            <label className="flex items-center" style={{ gap: "4px", fontSize: "11px", cursor: "pointer", color: "var(--text-secondary)" }}>
              <input type="radio" name="save-vis" checked={saveForm.visibility === "PUBLIC"} onChange={() => setSaveForm({ ...saveForm, visibility: "PUBLIC" })} style={{ accentColor: "#10B981" }} />
              Public
            </label>
          </div>
          <div className="flex items-center" style={{ gap: "6px" }}>
            <button
              data-testid="button-confirm-save-filter"
              onClick={handleSaveFilter}
              disabled={!saveForm.name.trim()}
              style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#FFFFFF", backgroundColor: saveForm.name.trim() ? "#10B981" : "#9CA3AF", border: "none", borderRadius: "4px", cursor: saveForm.name.trim() ? "pointer" : "default" }}
            >
              Save
            </button>
            <button
              onClick={() => { setSavingFilter(false); setSaveForm({ name: "", visibility: "PRIVATE" }); }}
              style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PipelineClient() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const initialPid = searchParams.get("pid");
  const [pipelineId, setPipelineId] = useState<string | null>(initialPid);
  const [titleDropdownOpen, setTitleDropdownOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get("addDeal") === "true") {
      setAddModalOpen(true);
      window.history.replaceState({}, "", "/pipeline" + (initialPid ? `?pid=${initialPid}` : ""));
    }
  }, [searchParams, initialPid]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActiveFilters>({ ...emptyFilters });
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [wonCollapsed, setWonCollapsed] = useState(true);
  const [lostCollapsed, setLostCollapsed] = useState(true);
  const titleDropdownRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLDivElement>(null);
  const currentUserName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const boardUrl = pipelineId
    ? `/api/pipeline/board?pipelineId=${pipelineId}`
    : "/api/pipeline/board";

  const bottomUrl = pipelineId
    ? `/api/pipeline/bottom-bar?pipelineId=${pipelineId}`
    : "/api/pipeline/bottom-bar";

  const board = useQuery<BoardData>({
    queryKey: ["pipeline", "board", pipelineId],
    queryFn: () => fetchJson(boardUrl),
  });

  const bottom = useQuery<BottomBarData>({
    queryKey: ["pipeline", "bottom-bar", pipelineId],
    queryFn: () => fetchJson(bottomUrl),
  });

  const moveCardMutation = useMutation({
    mutationFn: async ({ oppId, stageId }: { oppId: string; stageId: string }) => {
      const res = await fetch(`/api/opportunities/${oppId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      if (!res.ok) throw new Error("Failed to move card");
      return res.json();
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (titleDropdownRef.current && !titleDropdownRef.current.contains(e.target as Node)) {
        setTitleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pipeline = board.data?.pipeline;
  const stages = board.data?.stages ?? [];
  const pipelines = board.data?.pipelines ?? [];
  const closedColumns = board.data?.closedColumns;
  const bottomData = bottom.data;

  const isFiltered = hasActiveFilters(filters);
  const filterCount = countActiveFilters(filters);

  const filteredStages = useMemo(() => {
    if (!isFiltered) return stages;
    return stages.map((s) => {
      const filtered = s.opportunities.filter((o) => matchesFilters(o, filters, currentUserName));
      return {
        ...s,
        opportunities: filtered,
        count: filtered.length,
        totalValue: filtered.reduce((a, o) => a + o.estimatedValue, 0),
        _originalCount: s.count,
      };
    });
  }, [stages, filters, isFiltered, currentUserName]);

  const totalOppCount = stages.reduce((a, s) => a + s.count, 0);
  const filteredOppCount = filteredStages.reduce((a, s) => a + s.count, 0);

  const findStageForOpp = useCallback(
    (oppId: string) => stages.find((s) => s.opportunities.some((o) => o.id === oppId)),
    [stages]
  );

  const activeOpp = activeId
    ? stages.flatMap((s) => s.opportunities).find((o) => o.id === activeId) ?? null
    : null;

  const activeStageColor = activeOpp ? (findStageForOpp(activeOpp.id)?.color ?? "#10B981") : "#10B981";

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const oppId = active.id as string;
    const sourceStage = findStageForOpp(oppId);
    if (!sourceStage) return;

    let targetStageId: string;
    const overStage = stages.find((s) => s.id === over.id);
    if (overStage) {
      targetStageId = overStage.id;
    } else {
      const overOppStage = findStageForOpp(over.id as string);
      if (!overOppStage) return;
      targetStageId = overOppStage.id;
    }

    if (sourceStage.id === targetStageId) return;

    queryClient.setQueryData<BoardData>(["pipeline", "board", pipelineId], (old) => {
      if (!old) return old;
      const opp = old.stages.flatMap((s) => s.opportunities).find((o) => o.id === oppId);
      if (!opp) return old;
      return {
        ...old,
        stages: old.stages.map((s) => {
          if (s.id === sourceStage.id) {
            const opps = s.opportunities.filter((o) => o.id !== oppId);
            return { ...s, opportunities: opps, count: opps.length, totalValue: opps.reduce((a, o) => a + o.estimatedValue, 0) };
          }
          if (s.id === targetStageId) {
            const opps = [opp, ...s.opportunities];
            return { ...s, opportunities: opps, count: opps.length, totalValue: opps.reduce((a, o) => a + o.estimatedValue, 0) };
          }
          return s;
        }),
      };
    });

    moveCardMutation.mutate({ oppId, stageId: targetStageId });
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const oppId = active.id as string;
    const sourceStage = findStageForOpp(oppId);
    if (!sourceStage) return;

    let targetStageId: string;
    const overStage = stages.find((s) => s.id === over.id);
    if (overStage) {
      targetStageId = overStage.id;
    } else {
      const overOppStage = findStageForOpp(over.id as string);
      if (!overOppStage) return;
      targetStageId = overOppStage.id;
    }

    if (sourceStage.id === targetStageId) return;

    queryClient.setQueryData<BoardData>(["pipeline", "board", pipelineId], (old) => {
      if (!old) return old;
      const opp = old.stages.flatMap((s) => s.opportunities).find((o) => o.id === oppId);
      if (!opp) return old;
      return {
        ...old,
        stages: old.stages.map((s) => {
          if (s.id === sourceStage.id) {
            const opps = s.opportunities.filter((o) => o.id !== oppId);
            return { ...s, opportunities: opps, count: opps.length, totalValue: opps.reduce((a, o) => a + o.estimatedValue, 0) };
          }
          if (s.id === targetStageId) {
            if (s.opportunities.some((o) => o.id === oppId)) return s;
            const opps = [opp, ...s.opportunities];
            return { ...s, opportunities: opps, count: opps.length, totalValue: opps.reduce((a, o) => a + o.estimatedValue, 0) };
          }
          return s;
        }),
      };
    });
  }

  const leftSlot = usePortalTarget("topbar-left-slot");
  const rightSlot = usePortalTarget("topbar-right-slot");

  const pipelineTitlePortal = leftSlot
    ? createPortal(
        <div ref={titleDropdownRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            data-testid="button-pipeline-switcher"
            className="flex items-center"
            style={{
              gap: "5px",
              padding: "0",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 150ms",
            }}
            onClick={() => setTitleDropdownOpen(!titleDropdownOpen)}
          >
            {board.isLoading ? (
              <Skeleton w="160px" h="18px" />
            ) : (
              <>
                {pipeline?.name ?? "Pipeline"}
                <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
              </>
            )}
          </button>

          {titleDropdownOpen && pipelines.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: "4px",
                zIndex: 50,
                minWidth: "220px",
              }}
            >
              {pipelines.map((p) => {
                const isActive = p.id === pipeline?.id;
                return (
                  <button
                    key={p.id}
                    data-testid={`button-pipeline-option-${p.id}`}
                    className="flex items-center"
                    style={{
                      gap: "8px",
                      width: "100%",
                      height: "36px",
                      padding: "0 10px",
                      fontSize: "13px",
                      fontWeight: isActive ? 600 : 400,
                      color: "var(--text-primary)",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "background-color 120ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    onClick={() => {
                      setPipelineId(p.id);
                      setTitleDropdownOpen(false);
                    }}
                  >
                    {isActive ? (
                      <Check size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: "14px", flexShrink: 0 }} />
                    )}
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        leftSlot
      )
    : null;

  const actionsPortal = rightSlot
    ? createPortal(
        <>
          {isFiltered && (
            <span style={{ fontSize: "11px", fontWeight: 500, color: "#10B981", marginRight: "4px" }}>
              Filtered
            </span>
          )}
          <div ref={filterBtnRef} style={{ position: "relative" }}>
            <button
              data-testid="button-filter"
              className="flex items-center"
              style={{
                gap: "4px",
                padding: "5px 10px",
                fontSize: "13px",
                fontWeight: 500,
                color: isFiltered ? "#10B981" : "var(--text-secondary)",
                backgroundColor: isFiltered ? "rgba(16,185,129,0.08)" : "transparent",
                border: isFiltered ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-default)",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 150ms",
              }}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter size={14} />
              Filter{filterCount > 0 ? ` (${filterCount})` : ""}
            </button>
            <FilterPanel
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              filters={filters}
              setFilters={setFilters}
              stages={stages}
              totalCount={totalOppCount}
              filteredCount={filteredOppCount}
              filterBtnRef={filterBtnRef}
            />
          </div>
          <button
            data-testid="button-add-lead"
            className="flex items-center"
            style={{
              gap: "4px",
              padding: "5px 12px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: "#10B981",
              border: "1px solid #10B981",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background-color 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#059669";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#10B981";
            }}
            onClick={() => setAddModalOpen(true)}
          >
            <Plus size={14} />
            Add Deal
          </button>
        </>,
        rightSlot
      )
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 52px)",
        margin: "-28px -32px",
        overflow: "hidden",
      }}
    >
      {pipelineTitlePortal}
      {actionsPortal}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            flex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            padding: "20px 24px",
            backgroundColor: "#E8EBF0",
          }}
        >
          {board.isLoading ? (
            <div className="flex" style={{ gap: "16px", height: "100%" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    width: "280px",
                    flexShrink: 0,
                    animation: `fadeUp 280ms ease-out ${i * 60}ms both`,
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      borderRadius: "8px 8px 0 0",
                      height: "40px",
                      padding: "0 14px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Skeleton w="100px" h="12px" />
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--column-bg)",
                      padding: "8px",
                      minHeight: "200px",
                    }}
                  >
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        style={{
                          backgroundColor: "var(--card-bg)",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          marginBottom: "8px",
                          height: "108px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                      >
                        <Skeleton w="120px" h="14px" />
                        <div style={{ marginTop: "8px" }}>
                          <Skeleton w="80px" h="12px" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex" style={{ gap: "16px", height: "100%" }}>
              {filteredStages.map((stage, colIdx) => (
                <DroppableColumn
                  key={stage.id}
                  stage={stage}
                  colIdx={colIdx}
                  isFiltered={isFiltered}
                  originalCount={(stages.find((s) => s.id === stage.id)?.count) ?? stage.count}
                  onCardClick={(id) => setSelectedOppId(id)}
                />
              ))}

              <div style={{ width: "1px", backgroundColor: "rgba(0,0,0,0.1)", flexShrink: 0, margin: "0 4px" }} />

              <ClosedColumnComponent
                type="won"
                collapsed={wonCollapsed}
                onToggle={() => setWonCollapsed(!wonCollapsed)}
                opportunities={closedColumns?.won.opportunities ?? []}
                count={closedColumns?.won.count ?? 0}
                totalValue={closedColumns?.won.totalValue ?? 0}
                onCardClick={(id) => setSelectedOppId(id)}
                onReopen={async (id) => {
                  try {
                    const res = await fetch(`/api/opportunities/${id}/reopen`, { method: "PATCH" });
                    if (res.ok) queryClient.invalidateQueries({ queryKey: ["pipeline"] });
                  } catch {}
                }}
                colIdx={filteredStages.length}
              />

              <ClosedColumnComponent
                type="lost"
                collapsed={lostCollapsed}
                onToggle={() => setLostCollapsed(!lostCollapsed)}
                opportunities={closedColumns?.lost.opportunities ?? []}
                count={closedColumns?.lost.count ?? 0}
                totalValue={closedColumns?.lost.totalValue ?? 0}
                onCardClick={(id) => setSelectedOppId(id)}
                onReopen={async (id) => {
                  try {
                    const res = await fetch(`/api/opportunities/${id}/reopen`, { method: "PATCH" });
                    if (res.ok) queryClient.invalidateQueries({ queryKey: ["pipeline"] });
                  } catch {}
                }}
                colIdx={filteredStages.length + 1}
              />
            </div>
          )}
        </div>

        <DragOverlay>
          {activeOpp ? (
            <div style={{ width: "280px" }}>
              <PipelineCard opp={activeOpp} stageColor={activeStageColor} cardIndex={0} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <QuickAddModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        stages={stages}
        pipelineId={pipeline?.id ?? ""}
      />

      <OpportunityPanel
        opportunityId={selectedOppId}
        onClose={() => setSelectedOppId(null)}
        onStatusChange={() => queryClient.invalidateQueries({ queryKey: ["pipeline"] })}
      />

      {/* Bottom Action Bar */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: "2px solid #10B981",
          height: "44px",
          padding: "0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <BottomMetric
          label="TODAY'S ACTIONS"
          value={
            bottom.isLoading
              ? undefined
              : bottomData
                ? `${bottomData.todaysActions} calls due`
                : "0 calls due"
          }
        />
        <BottomDivider />
        <BottomMetric
          label="CLOSING THIS WEEK"
          value={
            bottom.isLoading
              ? undefined
              : formatCurrencyAlways(bottomData?.closingThisWeek ?? 0)
          }
          valueColor="#10B981"
        />
        <BottomDivider />
        <BottomMetric
          label="STALLED"
          value={
            bottom.isLoading
              ? undefined
              : bottomData?.stalledLabel ?? "Pipeline healthy"
          }
          valueColor={
            bottomData && bottomData.stalledCount > 0
              ? "#EF4444"
              : "#10B981"
          }
        />
        <BottomDivider />
        <div className="flex flex-col items-center justify-center" style={{ flex: 1, gap: "3px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
            }}
          >
            AI SUGGESTIONS
          </span>
          <div className="flex items-center" style={{ gap: "4px" }}>
            <Sparkles size={11} style={{ color: "var(--text-subtle)" }} />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text-subtle)",
                ...mono,
              }}
            >
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  stage,
  colIdx,
  isFiltered,
  originalCount,
  onCardClick,
}: {
  stage: Stage & { _originalCount?: number };
  colIdx: number;
  isFiltered: boolean;
  originalCount: number;
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef } = useSortable({
    id: stage.id,
    data: { type: "column" },
  });
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = laneRef.current;
    if (!el) return;
    function check() {
      if (el) setHasOverflow(el.scrollHeight > el.clientHeight);
    }
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage.opportunities.length]);

  const isExpiringQuote = stage.name === "Expiring Quote";
  const isNewInquiry = stage.name === "New Inquiry";
  const hasCards = stage.count > 0;

  const headerBg = isExpiringQuote
    ? "rgba(239, 68, 68, 0.08)"
    : isNewInquiry
      ? "rgba(59, 130, 246, 0.08)"
      : hexToRgba(stage.color, 0.08);

  const headerBorder = isExpiringQuote
    ? "2px solid #EF4444"
    : `2px solid ${stage.color}`;

  const laneBg = isExpiringQuote
    ? "rgba(239, 68, 68, 0.04)"
    : isNewInquiry
      ? "rgba(59, 130, 246, 0.04)"
      : "var(--column-bg)";

  const countPillBg = isExpiringQuote
    ? "#FEE2E2"
    : hexToRgba(stage.color, 0.15);

  const countPillColor = isExpiringQuote
    ? "#991B1B"
    : stage.color;

  return (
    <div
      data-testid={`column-stage-${stage.id}`}
      style={{
        width: "280px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        animation: `fadeUp 280ms ease-out ${colIdx * 60}ms both`,
      }}
    >
      <div
        style={{
          backgroundColor: headerBg,
          borderRadius: "8px 8px 0 0",
          height: "40px",
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: headerBorder,
        }}
      >
        <div className="flex items-center" style={{ gap: "8px" }}>
          {isNewInquiry && hasCards && (
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#3B82F6",
                flexShrink: 0,
                animation: "pulsingDot 2s ease-in-out infinite",
              }}
            />
          )}
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-primary)",
            }}
          >
            {stage.name}
          </span>
          <span
            className="flex items-center justify-center"
            style={{
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "9px",
              backgroundColor: countPillBg,
              fontSize: "11px",
              fontWeight: 600,
              color: countPillColor,
              ...mono,
            }}
          >
            {isFiltered ? `${stage.count} of ${originalCount}` : stage.count}
          </span>
        </div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", ...mono }}>
          {formatCurrencyAlways(stage.totalValue)}
        </span>
      </div>

      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          ref={(node) => {
            laneRef.current = node;
            setNodeRef(node);
          }}
          className="column-lane"
          style={{
            flex: 1,
            backgroundColor: laneBg,
            padding: "8px 8px 8px 8px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minHeight: "100px",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <SortableContext items={stage.opportunities.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            {stage.opportunities.map((opp, cardIdx) => (
              <SortableCard key={opp.id} opp={opp} stageColor={stage.color} cardIndex={cardIdx} onCardClick={onCardClick} />
            ))}
          </SortableContext>
        </div>
        {hasOverflow && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "40px",
              background: `linear-gradient(to bottom, transparent, ${isExpiringQuote ? "rgba(239, 68, 68, 0.04)" : isNewInquiry ? "rgba(59, 130, 246, 0.04)" : "var(--column-bg)"})`,
              pointerEvents: "none",
              borderRadius: "0 0 8px 8px",
            }}
          />
        )}
      </div>
    </div>
  );
}

function ClosedColumnComponent({
  type,
  collapsed,
  onToggle,
  opportunities,
  count,
  totalValue,
  onCardClick,
  onReopen,
  colIdx,
}: {
  type: "won" | "lost";
  collapsed: boolean;
  onToggle: () => void;
  opportunities: ClosedOpportunity[];
  count: number;
  totalValue: number;
  onCardClick: (id: string) => void;
  onReopen: (id: string) => void;
  colIdx: number;
}) {
  const laneRef = useRef<HTMLDivElement | null>(null);
  const isWon = type === "won";
  const color = isWon ? "#10B981" : "#EF4444";
  const bgLight = isWon ? "#D1FAE5" : "#FEE2E2";
  const textDark = isWon ? "#065F46" : "#991B1B";
  const Icon = isWon ? Trophy : XCircle;
  const label = isWon ? "Won" : "Lost";

  if (collapsed) {
    return (
      <div
        data-testid={`column-closed-${type}-collapsed`}
        style={{
          width: "44px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          animation: `fadeUp 280ms ease-out ${colIdx * 60}ms both`,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div
          style={{
            backgroundColor: bgLight,
            borderRadius: "8px 8px 0 0",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: `2px solid ${color}`,
          }}
        >
          <ChevronRight size={14} style={{ color: textDark }} />
        </div>
        <div
          style={{
            flex: 1,
            backgroundColor: `${color}05`,
            borderRadius: "0 0 8px 8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: "12px",
            gap: "8px",
          }}
        >
          <Icon size={14} style={{ color: textDark }} />
          <span style={{
            writingMode: "vertical-lr",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: textDark,
          }}>
            {label}
          </span>
          <span
            style={{
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "9px",
              backgroundColor: bgLight,
              fontSize: "11px",
              fontWeight: 600,
              color: textDark,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...mono,
            }}
          >
            {count}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`column-closed-${type}`}
      style={{
        width: "280px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        animation: `fadeUp 280ms ease-out ${colIdx * 60}ms both`,
      }}
    >
      <div
        style={{
          backgroundColor: bgLight,
          borderRadius: "8px 8px 0 0",
          height: "40px",
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `2px solid ${color}`,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div className="flex items-center" style={{ gap: "8px" }}>
          <Icon size={13} style={{ color: textDark }} />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: textDark,
            }}
          >
            {label}
          </span>
          <span
            className="flex items-center justify-center"
            style={{
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "9px",
              backgroundColor: `${color}25`,
              fontSize: "11px",
              fontWeight: 600,
              color: textDark,
              ...mono,
            }}
          >
            {count}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: textDark, ...mono }}>
            {formatCurrencyAlways(totalValue)}
          </span>
          <ChevronDown size={12} style={{ color: textDark, transform: "rotate(-90deg)" }} />
        </div>
      </div>

      <div
        ref={laneRef}
        style={{
          flex: 1,
          backgroundColor: `${color}05`,
          padding: "8px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          minHeight: "100px",
          borderRadius: "0 0 8px 8px",
        }}
      >
        {opportunities.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            gap: "6px",
          }}>
            <Icon size={20} style={{ color: `${color}40` }} />
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", textAlign: "center" }}>
              No {label.toLowerCase()} deals yet
            </span>
          </div>
        ) : (
          opportunities.map((opp, cardIdx) => (
            <ClosedCard
              key={opp.id}
              opp={opp}
              type={type}
              cardIndex={cardIdx}
              onCardClick={onCardClick}
              onReopen={onReopen}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ClosedCard({
  opp,
  type,
  cardIndex,
  onCardClick,
  onReopen,
}: {
  opp: ClosedOpportunity;
  type: "won" | "lost";
  cardIndex: number;
  onCardClick: (id: string) => void;
  onReopen: (id: string) => void;
}) {
  const isWon = type === "won";
  const color = isWon ? "#10B981" : "#EF4444";
  const valDisplay = opp.estimatedValue === 0 ? "\u2014" : formatCurrencyAlways(opp.estimatedValue);
  const closedDate = opp.closedAt ? new Date(opp.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <div
      data-testid={`card-closed-${opp.id}`}
      className="pipeline-card"
      onClick={() => onCardClick(opp.id)}
      style={{
        height: "90px",
        minHeight: "90px",
        maxHeight: "90px",
        overflow: "hidden",
        backgroundColor: "var(--card-bg)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderLeft: `3px solid ${color}`,
        borderRadius: "8px",
        padding: "10px 12px 10px 11px",
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        transition: "box-shadow 180ms ease, transform 180ms ease",
        animation: `fadeUp 200ms ease-out ${cardIndex * 30}ms both`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(to bottom, #FFFFFF, #FDFCFB)",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)";
        e.currentTarget.style.transform = "translateY(-1px)";
        const btn = e.currentTarget.querySelector("[data-reopen]") as HTMLElement;
        if (btn) btn.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";
        e.currentTarget.style.transform = "translateY(0)";
        const btn = e.currentTarget.querySelector("[data-reopen]") as HTMLElement;
        if (btn) btn.style.opacity = "0";
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: "6px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
          {opp.patientName}
        </span>
        <button
          data-reopen
          data-testid={`button-reopen-${opp.id}`}
          onClick={(e) => { e.stopPropagation(); onReopen(opp.id); }}
          title="Reopen"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "10px",
            fontWeight: 500,
            color: "#10B981",
            background: "none",
            border: "1px solid #10B981",
            borderRadius: "4px",
            padding: "1px 6px",
            cursor: "pointer",
            opacity: 0,
            transition: "opacity 150ms",
            flexShrink: 0,
          }}
        >
          <RotateCcw size={9} /> Reopen
        </button>
      </div>

      <div className="flex items-center justify-between" style={{ gap: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
          {opp.procedureName}
        </span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", ...mono }}>
          {valDisplay}
        </span>
      </div>

      <div className="flex items-center justify-between" style={{ gap: "6px" }}>
        <div className="flex items-center" style={{ gap: "4px", minWidth: 0, flex: 1 }}>
          <User size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {opp.assignedToName ? opp.assignedToName.split(" ")[0] : "Unassigned"}
          </span>
        </div>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-subtle)", whiteSpace: "nowrap", ...mono }}>
          {closedDate}
        </span>
      </div>
    </div>
  );
}

function BottomMetric({
  label,
  value,
  valueColor,
}: {
  label: string;
  value?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ flex: 1, gap: "3px" }}>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      {value === undefined ? (
        <Skeleton w="80px" h="14px" />
      ) : (
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: valueColor ?? "var(--text-primary)",
            ...mono,
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function BottomDivider() {
  return (
    <div
      style={{
        width: "1px",
        height: "20px",
        backgroundColor: "var(--border-default)",
      }}
    />
  );
}
