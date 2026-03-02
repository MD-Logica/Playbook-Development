"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Check, X, Clock, MapPin, User as UserIcon, Calendar, Search, History, PlusCircle, Pencil, ArrowRight, XCircle, UserX as UserXIcon, Trash2, Activity } from "lucide-react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import BookingModal from "@/components/appointments/BookingModal";
import { useRouter } from "next/navigation";

type ViewMode = "day" | "week" | "agenda";

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AppointmentData {
  id: string;
  title: string;
  isInternal: boolean;
  startTime: string;
  endTime: string;
  bufferMins: number;
  status: string;
  notes: string | null;
  roomName: string | null;
  appointmentCategory: string;
  checkedInAt: string | null;
  noShowAt: string | null;
  cancelledAt: string | null;
  opportunityId: string | null;
  patient: { id: string; firstName: string; lastName: string } | null;
  provider: { id: string; firstName: string; lastName: string } | null;
  configuredType: { id: string; name: string; color: string; durationMins: number; bufferMins: number } | null;
  subcategory: { id: string; name: string } | null;
  attendees: { id: string; user: { id: string; firstName: string; lastName: string } }[];
}

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const WORK_START = 8;
const WORK_END = 17.5;
const TIME_COL_WIDTH = 64;

const PROVIDER_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#EF4444", "#6366F1", "#14B8A6"];

function getProviderColor(index: number) {
  return PROVIDER_COLORS[index % PROVIDER_COLORS.length];
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatWeekLabel(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { day: "numeric", year: "numeric" })}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function isToday(date: Date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getApptColor(appt: AppointmentData): string {
  if (appt.configuredType?.color) return appt.configuredType.color;
  return "#6B7280";
}

function getTimePosition(time: Date): number {
  const hours = time.getHours() + time.getMinutes() / 60;
  return (hours - START_HOUR) * HOUR_HEIGHT;
}

function getApptDurationPx(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours * HOUR_HEIGHT;
}

function formatDateYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime12(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function colorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgb(${Math.max(0, rgb.r - amount)}, ${Math.max(0, rgb.g - amount)}, ${Math.max(0, rgb.b - amount)})`;
}

function relativeTime(dateStr: string): string {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const STATUS_NEXT: Record<string, { label: string; next: string; color: string }> = {
  CONFIRMED: { label: "Check In", next: "CHECKED_IN", color: "#10B981" },
  CHECKED_IN: { label: "Room", next: "ROOMED", color: "#3B82F6" },
  ROOMED: { label: "Start", next: "IN_PROGRESS", color: "#8B5CF6" },
  IN_PROGRESS: { label: "End", next: "ENDED", color: "#6B7280" },
  ENDED: { label: "Check Out", next: "CHECKED_OUT", color: "#6B7280" },
};

interface BookingModalPrefill {
  appointmentId?: string;
  date?: string;
  startTime?: string;
  patientId?: string;
  patientName?: string;
  dealId?: string;
  dealTitle?: string;
  providerId?: string;
  lockPatient?: boolean;
  lockDeal?: boolean;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedProviders, setSelectedProviders] = useState<string[] | null>(null);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [bookingModal, setBookingModal] = useState<{ open: boolean; prefill?: BookingModalPrefill }>({ open: false });
  const [popover, setPopover] = useState<{ appt: AppointmentData; x: number; y: number } | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ appointmentId: string } | null>(null);
  const [rescheduleConfirm, setRescheduleConfirm] = useState<{
    appointmentId: string;
    patientName: string;
    typeName: string;
    fromTime: Date;
    toTime: Date;
    newProviderId?: string;
    durationMins: number;
  } | null>(null);
  const [activeAppt, setActiveAppt] = useState<AppointmentData | null>(null);
  const queryClient = useQueryClient();
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setProviderPickerOpen(false);
      }
    }
    if (providerPickerOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [providerPickerOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (popover && !target.closest("[data-popover]") && !target.closest("[data-appointment-block]")) {
        setPopover(null);
      }
    }
    if (popover) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popover]);

  const openNewAppointment = useCallback(() => {
    setPopover(null);
    setBookingModal({ open: true, prefill: { date: formatDateYMD(currentDate) } });
  }, [currentDate]);

  const openEditAppointment = useCallback((appointmentId: string) => {
    setPopover(null);
    setBookingModal({ open: true, prefill: { appointmentId } });
  }, []);

  const openPopover = useCallback((appt: AppointmentData, event: ReactMouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const screenMid = window.innerWidth / 2;
    const x = rect.left < screenMid ? rect.right + 8 : rect.left - 336;
    const y = Math.min(rect.top, window.innerHeight - 420);
    setPopover({ appt, x: Math.max(8, x), y: Math.max(8, y) });
  }, []);

  const openTimeSlot = useCallback((date: Date, startTime: string, providerId?: string) => {
    setPopover(null);
    setBookingModal({
      open: true,
      prefill: {
        date: formatDateYMD(date),
        startTime,
        ...(providerId ? { providerId } : {}),
      },
    });
  }, []);

  const handleBookingSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/appointments/agenda"] });
  }, [queryClient]);

  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: string, reason?: string) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...(reason ? { reason } : {}) }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/appointments/agenda"] });
        if (popover && popover.appt.id === appointmentId) {
          setPopover(null);
        }
      }
    } catch {}
  }, [queryClient, popover]);

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const allSelected = selectedProviders === null;
  const effectiveProviderParam = allSelected ? "all" : selectedProviders.length === 1 ? selectedProviders[0] : "all";

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);

  const dateRange = useMemo(() => {
    if (view === "day") {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [view, currentDate, weekStart]);

  const { data: appointments = [], isLoading } = useQuery<AppointmentData[]>({
    queryKey: ["/api/appointments", dateRange, effectiveProviderParam],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (effectiveProviderParam !== "all") params.set("providerId", effectiveProviderParam);
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const filteredAppointments = useMemo(() => {
    if (allSelected) return appointments;
    if (selectedProviders.length === 0) return [];
    return appointments.filter(a =>
      (a.provider && selectedProviders.includes(a.provider.id)) ||
      (a.attendees && a.attendees.some(att => selectedProviders.includes(att.user.id)))
    );
  }, [appointments, selectedProviders, allSelected]);

  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCurrentDate(d);
  };

  const navigate = (direction: number) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === "day") d.setDate(d.getDate() + direction);
      else d.setDate(d.getDate() + direction * 7);
      return d;
    });
  };

  const switchToDayView = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const toggleProvider = (id: string) => {
    setSelectedProviders(prev => {
      if (prev === null) {
        const next = providers.filter(p => p.id !== id).map(p => p.id);
        return next.length === 0 ? [] : next;
      }
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      }
      const next = [...prev, id];
      if (next.length === providers.length) return null;
      return next;
    });
  };

  const filteredProviderList = providers.filter(p =>
    providerSearch === "" || `${p.firstName} ${p.lastName}`.toLowerCase().includes(providerSearch.toLowerCase())
  );

  const getApptsCountForDay = (day: Date) => {
    return filteredAppointments.filter(a => {
      const s = new Date(a.startTime);
      return s.getFullYear() === day.getFullYear() && s.getMonth() === day.getMonth() && s.getDate() === day.getDate() && a.status !== "CANCELLED";
    }).length;
  };

  const getProviderApptCount = (providerId: string) => {
    return appointments.filter(a => a.provider?.id === providerId && a.status !== "CANCELLED").length;
  };

  const sp = selectedProviders || [];
  const displayProviders = allSelected ? providers : providers.filter(p => sp.includes(p.id));
  const providerLabel = allSelected
    ? "All Providers"
    : sp.length === 1
      ? (() => { const p = providers.find(pr => pr.id === sp[0]); return p ? `${p.firstName} ${p.lastName}` : "1 Provider"; })()
      : sp.length === 2
        ? providers.filter(p => sp.includes(p.id)).map(p => p.firstName).join(", ")
        : sp.length === 0
          ? "No Providers"
          : `${sp.length} Providers`;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const appt = filteredAppointments.find(a => a.id === event.active.id);
    setActiveAppt(appt || null);
  }, [filteredAppointments]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const draggedAppt = activeAppt;
    setActiveAppt(null);
    if (!event.over || !draggedAppt) return;

    const overId = String(event.over.id);
    if (!overId.startsWith("slot-")) return;

    const parts = overId.split("-");
    const isoDate = parts[1];
    const hour = parseInt(parts[2]);
    const minute = parseInt(parts[3]);
    const newProviderId = parts[4] === "same" ? draggedAppt.provider?.id : parts[4];

    const originalStart = new Date(draggedAppt.startTime);
    const originalEnd = new Date(draggedAppt.endTime);
    const durationMins = Math.round((originalEnd.getTime() - originalStart.getTime()) / 60000);

    const newStart = new Date(isoDate + "T00:00:00");
    newStart.setHours(hour, minute, 0, 0);

    if (
      newStart.getTime() === originalStart.getTime() &&
      newProviderId === draggedAppt.provider?.id
    ) return;

    const patientName = draggedAppt.patient
      ? `${draggedAppt.patient.firstName} ${draggedAppt.patient.lastName}`
      : draggedAppt.title;
    const typeName = draggedAppt.configuredType?.name || draggedAppt.appointmentCategory;

    setRescheduleConfirm({
      appointmentId: draggedAppt.id,
      patientName,
      typeName,
      fromTime: originalStart,
      toTime: newStart,
      newProviderId,
      durationMins,
    });
  }, [activeAppt]);

  return (
    <div data-testid="page-appointments" style={{ display: "flex", flexDirection: "column", height: "100%", margin: "-28px -32px", overflow: "hidden", backgroundColor: "#f4f6f8" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h1 data-testid="text-page-title" style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Calendar
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button data-testid="button-nav-prev" onClick={() => navigate(-1)} style={navBtnStyle}>
              <ChevronLeft size={16} />
            </button>
            <button data-testid="button-today" onClick={goToday} style={{ ...navBtnStyle, padding: "4px 12px", fontSize: "12px", fontWeight: 600 }}>
              Today
            </button>
            <button data-testid="button-nav-next" onClick={() => navigate(1)} style={navBtnStyle}>
              <ChevronRight size={16} />
            </button>
          </div>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b" }}>
            {view === "day" ? formatDateLabel(currentDate) : view === "week" ? formatWeekLabel(weekStart) : "Upcoming"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div ref={pickerRef} style={{ position: "relative" }}>
            <button
              data-testid="button-provider-filter"
              onClick={() => setProviderPickerOpen(!providerPickerOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "5px 12px 5px 4px", fontSize: "12px", fontWeight: 500,
                color: "#64748b", backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0", borderRadius: "8px",
                cursor: "pointer", height: "34px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                {(allSelected ? providers.slice(0, 3) : providers.filter(p => sp.includes(p.id)).slice(0, 3)).map((p, i) => (
                  <div key={p.id} style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    backgroundColor: getProviderColor(providers.indexOf(p)),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "9px", fontWeight: 700, color: "#fff",
                    marginLeft: i > 0 ? "-8px" : "0",
                    border: "2px solid #fff", position: "relative", zIndex: 3 - i,
                  }}>
                    {getInitials(p.firstName, p.lastName)}
                  </div>
                ))}
              </div>
              <span>{providerLabel}</span>
            </button>
            {providerPickerOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: "4px",
                backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                width: "280px", zIndex: 50, overflow: "hidden",
              }}>
                <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <Search size={13} color="#94a3b8" />
                    <input
                      data-testid="input-provider-search"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder="Search providers..."
                      style={{ border: "none", outline: "none", background: "none", fontSize: "12px", color: "#1e293b", width: "100%", fontFamily: "inherit" }}
                    />
                  </div>
                </div>
                <div style={{ padding: "4px 8px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9" }}>
                  <button data-testid="button-select-all-providers" onClick={() => setSelectedProviders(null)}
                    style={{ fontSize: "11px", fontWeight: 600, color: allSelected ? "#10b981" : "#64748b", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                    Select All
                  </button>
                  <button data-testid="button-clear-providers" onClick={() => setSelectedProviders([])}
                    style={{ fontSize: "11px", fontWeight: 600, color: !allSelected && sp.length === 0 ? "#94a3b8" : "#64748b", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                    Clear All
                  </button>
                </div>
                <div style={{ maxHeight: "240px", overflowY: "auto", padding: "4px 0" }}>
                  {filteredProviderList.map((p) => {
                    const isSelected = allSelected || sp.includes(p.id);
                    const provColor = getProviderColor(providers.indexOf(p));
                    return (
                      <button key={p.id} data-testid={`provider-option-${p.id}`} onClick={() => toggleProvider(p.id)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px", fontSize: "13px", border: "none", background: "none", cursor: "pointer", textAlign: "left", color: "#1e293b" }}>
                        <div style={{
                          width: "16px", height: "16px", borderRadius: "4px",
                          border: isSelected ? "none" : "1.5px solid #cbd5e1",
                          backgroundColor: isSelected ? "#10b981" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                        </div>
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "50%", backgroundColor: provColor,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "10px", fontWeight: 700, color: "#fff", flexShrink: 0,
                        }}>
                          {getInitials(p.firstName, p.lastName)}
                        </div>
                        <span style={{ flex: 1, fontWeight: 500 }}>{p.firstName} {p.lastName}</span>
                        <span style={{ fontSize: "11px", color: "#94a3b8", backgroundColor: "#f1f5f9", padding: "1px 6px", borderRadius: "8px", fontWeight: 500 }}>
                          {getProviderApptCount(p.id)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {(["day", "week", "agenda"] as ViewMode[]).map((v) => (
              <button key={v} data-testid={`view-${v}`} onClick={() => setView(v)}
                style={{
                  padding: "6px 14px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer",
                  backgroundColor: view === v ? "#1e293b" : "#ffffff",
                  color: view === v ? "#fff" : "#64748b",
                  transition: "all 120ms ease",
                  borderRight: v !== "agenda" ? "1px solid #e2e8f0" : "none",
                  textTransform: "capitalize",
                }}>
                {v}
              </button>
            ))}
          </div>

          <button data-testid="button-new-appointment" onClick={openNewAppointment}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 14px", fontSize: "12px", fontWeight: 600,
              color: "#fff", backgroundColor: "#10b981", border: "none", borderRadius: "8px",
              cursor: "pointer", boxShadow: "0 1px 3px rgba(16,185,129,0.3)",
            }}>
            <Plus size={14} strokeWidth={2.5} /> New Appointment
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "12px 16px 12px 16px" }}>
        <div style={{ height: "100%", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {view === "day" && (
              <DayView
                date={currentDate}
                appointments={filteredAppointments}
                providers={displayProviders}
                allProviders={providers}
                selectedProviders={selectedProviders || []}
                isLoading={isLoading}
                onTimeSlotClick={openTimeSlot}
                onAppointmentClick={openPopover}
                onStatusChange={handleStatusChange}
              />
            )}
            {view === "week" && (
              <WeekView
                weekStart={weekStart}
                appointments={filteredAppointments}
                onDayClick={switchToDayView}
                isLoading={isLoading}
                onTimeSlotClick={openTimeSlot}
                onAppointmentClick={openPopover}
                onStatusChange={handleStatusChange}
                getApptsCountForDay={getApptsCountForDay}
              />
            )}
            {view === "agenda" && (
              <AgendaView
                selectedProvider={effectiveProviderParam}
                selectedProviders={selectedProviders || []}
                onAppointmentClick={openPopover}
                onStatusChange={handleStatusChange}
              />
            )}
            <DragOverlay>
              {activeAppt && (
                <div style={{
                  width: "160px",
                  backgroundColor: colorWithAlpha(getApptColor(activeAppt), 0.9),
                  borderLeft: `3px solid ${getApptColor(activeAppt)}`,
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#1e293b",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  opacity: 0.9,
                  cursor: "grabbing",
                }}>
                  {activeAppt.patient
                    ? `${activeAppt.patient.firstName} ${activeAppt.patient.lastName}`
                    : activeAppt.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {popover && (
        <AppointmentPopover
          appt={popover.appt}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
          onEdit={() => openEditAppointment(popover.appt.id)}
          onStatusChange={handleStatusChange}
          onViewPatient={() => {
            if (popover.appt.patient) {
              router.push(`/patients/${popover.appt.patient.id}`);
              setPopover(null);
            }
          }}
          onViewHistory={(id) => {
            setPopover(null);
            setHistoryDrawer({ appointmentId: id });
          }}
          providers={providers}
        />
      )}

      <BookingModal
        isOpen={bookingModal.open}
        onClose={() => setBookingModal({ open: false })}
        onSaved={handleBookingSaved}
        prefill={bookingModal.prefill}
      />

      {rescheduleConfirm && (
        <RescheduleConfirmModal
          confirm={rescheduleConfirm}
          onCancel={() => setRescheduleConfirm(null)}
          onConfirm={async () => {
            const { appointmentId, toTime, durationMins, newProviderId } = rescheduleConfirm;
            const newEnd = new Date(toTime.getTime() + durationMins * 60000);
            await fetch(`/api/appointments/${appointmentId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startTime: toTime.toISOString(),
                endTime: newEnd.toISOString(),
                ...(newProviderId ? { providerId: newProviderId } : {}),
              }),
            });
            setRescheduleConfirm(null);
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            queryClient.invalidateQueries({ queryKey: ["/api/appointments/agenda"] });
          }}
        />
      )}

      {historyDrawer && (
        <HistoryDrawer
          appointmentId={historyDrawer.appointmentId}
          onClose={() => setHistoryDrawer(null)}
        />
      )}

      <style>{`
        @keyframes pulseGreen { 0%, 100% { border-left-color: #10B981; } 50% { border-left-color: #6EE7B7; } }
        @keyframes popoverIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes statusPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

function DroppableSlot({ id, style, children }: { id: string; style: React.CSSProperties; children?: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{
      ...style,
      backgroundColor: isOver ? "rgba(16,185,129,0.08)" : style.backgroundColor,
      transition: "background-color 100ms",
    }}>
      {isOver && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
          fontSize: "10px", fontWeight: 600, color: "#10b981",
        }}>
          Drop to move
        </div>
      )}
      {children}
    </div>
  );
}

function TimeColumn() {
  return (
    <div style={{ width: `${TIME_COL_WIDTH}px`, flexShrink: 0, position: "relative", backgroundColor: "#fff" }}>
      {Array.from({ length: TOTAL_HOURS }, (_, i) => {
        const hour = START_HOUR + i;
        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? "AM" : "PM";
        return (
          <div key={hour} style={{ height: `${HOUR_HEIGHT}px`, position: "relative", borderBottom: "1px solid #e2e8f0" }}>
            {i > 0 && (
              <div style={{ position: "absolute", top: "-8px", right: "8px", textAlign: "right" }}>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "#94a3b8", lineHeight: 1 }}>{h12}</span>
                <span style={{ fontSize: "9px", fontWeight: 500, color: "#94a3b8", marginLeft: "1px" }}>{ampm}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CurrentTimeLine({ showLabel }: { showLabel?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  const top = getTimePosition(now);
  if (top < 0 || top > TOTAL_HOURS * HOUR_HEIGHT) return null;

  return (
    <>
      {showLabel && (
        <div style={{
          position: "absolute", top: `${top - 10}px`, left: "-62px",
          backgroundColor: "#10b981", color: "#fff",
          fontSize: "11px", fontWeight: 700, padding: "2px 8px",
          borderRadius: "12px", zIndex: 25, whiteSpace: "nowrap",
        }}>
          {formatTime12(now)}
        </div>
      )}
      <div style={{
        position: "absolute", top: `${top}px`, left: showLabel ? "-6px" : "0", right: "0",
        height: "2px", backgroundColor: "#ef4444", zIndex: 20,
      }} />
      {showLabel && (
        <div style={{
          position: "absolute", top: `${top - 4}px`, left: "-6px",
          width: "8px", height: "8px", borderRadius: "50%",
          backgroundColor: "#ef4444", zIndex: 21,
        }} />
      )}
    </>
  );
}

function HourGridDroppable({ isWeekend: weekend, isToday: todayCol, onSlotClick, dateStr, providerId }: {
  isWeekend?: boolean; isToday?: boolean;
  onSlotClick?: (hour: number, half: boolean) => void;
  dateStr: string; providerId: string;
}) {
  return (
    <>
      {Array.from({ length: TOTAL_HOURS }, (_, i) => {
        const hour = START_HOUR + i;
        const isOutside = hour < WORK_START || hour >= WORK_END;
        const bg = todayCol ? "rgba(16,185,129,0.03)" : weekend ? "#fafbfc" : isOutside ? "#fafbfc" : "transparent";
        return (
          <div key={hour} style={{ height: `${HOUR_HEIGHT}px`, borderBottom: "1px solid #e2e8f0", position: "relative" }}>
            <DroppableSlot
              id={`slot-${dateStr}-${hour}-0-${providerId}`}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: "25%", backgroundColor: bg, cursor: onSlotClick ? "pointer" : "default" }}
            >
              <div style={{ position: "absolute", inset: 0 }} onClick={() => onSlotClick?.(hour, false)} />
            </DroppableSlot>
            <DroppableSlot
              id={`slot-${dateStr}-${hour}-15-${providerId}`}
              style={{ position: "absolute", top: "25%", left: 0, right: 0, height: "25%", backgroundColor: bg, cursor: onSlotClick ? "pointer" : "default" }}
            >
              <div style={{ position: "absolute", inset: 0 }} onClick={() => onSlotClick?.(hour, false)} />
            </DroppableSlot>
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", borderTop: "1px dashed #f0f2f5", zIndex: 1, pointerEvents: "none" }} />
            <DroppableSlot
              id={`slot-${dateStr}-${hour}-30-${providerId}`}
              style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "25%", backgroundColor: bg, cursor: onSlotClick ? "pointer" : "default" }}
            >
              <div style={{ position: "absolute", inset: 0 }} onClick={() => onSlotClick?.(hour, true)} />
            </DroppableSlot>
            <DroppableSlot
              id={`slot-${dateStr}-${hour}-45-${providerId}`}
              style={{ position: "absolute", top: "75%", left: 0, right: 0, height: "25%", backgroundColor: bg, cursor: onSlotClick ? "pointer" : "default" }}
            >
              <div style={{ position: "absolute", inset: 0 }} onClick={() => onSlotClick?.(hour, true)} />
            </DroppableSlot>
          </div>
        );
      })}
    </>
  );
}

function AppointmentBlock({
  appt,
  onClick,
  onStatusChange,
  draggable,
  isAttendeeView,
}: {
  appt: AppointmentData;
  onClick?: (appt: AppointmentData, event: ReactMouseEvent) => void;
  onStatusChange?: (id: string, status: string) => void;
  draggable?: boolean;
  isAttendeeView?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const start = new Date(appt.startTime);
  const end = new Date(appt.endTime);
  const top = getTimePosition(start);
  const height = Math.max(getApptDurationPx(start, end), 22);
  const color = getApptColor(appt);
  const isCancelled = appt.status === "CANCELLED";
  const isNoShow = appt.status === "NO_SHOW";
  const isCheckedIn = appt.status === "CHECKED_IN";
  const isRoomed = appt.status === "ROOMED";
  const isInProgress = appt.status === "IN_PROGRESS";
  const isEnded = appt.status === "ENDED";
  const isCheckedOut = appt.status === "CHECKED_OUT";
  const isShort = height < 40;
  const isVeryShort = height < 28;
  const isInternal = appt.isInternal;

  const patientName = appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : appt.title;
  const typeName = appt.configuredType?.name || appt.appointmentCategory;

  const nextStatus = STATUS_NEXT[appt.status];
  const statusDotColor = isCheckedIn ? "#10b981" : isRoomed ? "#3b82f6" : isNoShow ? "#ef4444" : null;

  const canDrag = draggable && !isInternal;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appt.id,
    disabled: !canDrag,
  });

  if (isCancelled) return null;

  const baseOpacity = isAttendeeView ? 0.85 : isEnded ? 0.7 : isCheckedOut ? 0.65 : isNoShow ? 0.5 : 1;

  return (
    <>
      <div
        ref={canDrag ? setNodeRef : undefined}
        data-appointment-block="true"
        data-testid={`appointment-block-${appt.id}`}
        onClick={(e) => onClick?.(appt, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
        style={{
          position: "absolute",
          top: `${top}px`,
          left: "3px",
          right: "5px",
          height: `${height}px`,
          borderRadius: "6px",
          overflow: "hidden",
          cursor: canDrag ? (isDragging ? "grabbing" : "grab") : "pointer",
          transition: isDragging ? "none" : "all 0.15s ease",
          opacity: isDragging ? 0.4 : baseOpacity,
          zIndex: hovered ? 15 : 10,
          transform: isDragging ? CSS.Translate.toString(transform) : hovered ? "translateY(-1px)" : "none",
          boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.08)",
          ...(isInternal
            ? { backgroundColor: "#f1f5f9", borderLeft: "3px solid #94a3b8" }
            : {
                backgroundColor: colorWithAlpha(color, 0.12),
                borderLeft: `3px solid ${color}`,
                ...(isInProgress ? { animation: "pulseGreen 2s ease-in-out infinite" } : {}),
              }),
        }}
      >
        <div style={{ padding: isVeryShort ? "1px 6px" : isShort ? "3px 8px" : "5px 8px", position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
          {isAttendeeView && (
            <div style={{ position: "absolute", top: "3px", left: "3px" }}>
              <UserIcon size={10} color="#94a3b8" />
            </div>
          )}
          {statusDotColor && (
            <div style={{
              position: "absolute", top: "5px", right: "5px", width: "8px", height: "8px", borderRadius: "50%",
              backgroundColor: statusDotColor,
              ...(isInProgress ? { animation: "statusPulse 2s ease-in-out infinite" } : {}),
            }} />
          )}
          {isCheckedOut && (
            <div style={{ position: "absolute", top: "4px", right: "5px" }}>
              <Check size={11} strokeWidth={3} color="#94a3b8" />
            </div>
          )}
          {isNoShow && (
            <span style={{ position: "absolute", top: "4px", right: "5px", fontSize: "9px", fontWeight: 800, color: "#ef4444" }}>NS</span>
          )}

          {isVeryShort ? (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "100%" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: isInternal ? "#64748b" : "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {patientName}
              </span>
            </div>
          ) : isShort ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {!isInternal && appt.patient && (
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%", backgroundColor: color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "8px", fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>
                  {getInitials(appt.patient.firstName, appt.patient.lastName)}
                </div>
              )}
              <span style={{ fontSize: "12px", fontWeight: 600, color: isInternal ? "#64748b" : "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {patientName}
              </span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {!isInternal && appt.patient && (
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%", backgroundColor: color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "9px", fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>
                    {getInitials(appt.patient.firstName, appt.patient.lastName)}
                  </div>
                )}
                <span style={{ fontSize: "13px", fontWeight: 600, color: isInternal ? "#64748b" : "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                  {patientName}
                </span>
              </div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: isInternal ? "#94a3b8" : darkenColor(color, 30), marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {typeName}
              </div>
              {appt.attendees && appt.attendees.length > 0 && (
                <div style={{ display: "flex", marginTop: "3px" }}>
                  {appt.attendees.slice(0, 3).map((att, i) => (
                    <div key={att.id} style={{
                      width: "16px", height: "16px", borderRadius: "50%",
                      backgroundColor: getProviderColor(i + 1),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "7px", fontWeight: 700, color: "#fff",
                      border: "1px solid #fff",
                      marginLeft: i > 0 ? "-4px" : "0",
                      zIndex: appt.attendees.length - i,
                      position: "relative",
                    }}>
                      {att.user.firstName[0]}{att.user.lastName[0]}
                    </div>
                  ))}
                  {appt.attendees.length > 3 && (
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "50%",
                      backgroundColor: "#94a3b8",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "7px", fontWeight: 700, color: "#fff",
                      border: "1px solid #fff", marginLeft: "-4px", position: "relative",
                    }}>
                      +{appt.attendees.length - 3}
                    </div>
                  )}
                </div>
              )}
              {height > 55 && (
                <div style={{ fontSize: "11px", fontWeight: 400, color: "#94a3b8", marginTop: "1px" }}>
                  {formatTime12(start)} – {formatTime12(end)}
                </div>
              )}
            </>
          )}

          {hovered && nextStatus && onStatusChange && height > 30 && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              display: "flex", justifyContent: "center", padding: "3px 4px",
              backgroundColor: "rgba(255,255,255,0.92)", borderTop: "1px solid rgba(0,0,0,0.06)",
            }}>
              <button
                data-testid={`button-status-${appt.id}`}
                onClick={(e) => { e.stopPropagation(); onStatusChange(appt.id, nextStatus.next); }}
                style={{
                  fontSize: "10px", fontWeight: 700, color: "#fff",
                  backgroundColor: nextStatus.color, border: "none", borderRadius: "4px",
                  padding: "2px 10px", cursor: "pointer", lineHeight: "16px",
                }}
              >
                {nextStatus.label}
              </button>
            </div>
          )}
        </div>
      </div>
      {appt.bufferMins > 0 && !isCancelled && (
        <div style={{
          position: "absolute", top: `${top + height}px`, left: "3px", right: "5px",
          height: `${(appt.bufferMins / 60) * HOUR_HEIGHT}px`, borderRadius: "4px",
          background: "repeating-linear-gradient(45deg, #f8fafc, #f8fafc 4px, #f1f5f9 4px, #f1f5f9 8px)",
          zIndex: 9, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {appt.bufferMins >= 10 && (
            <span style={{ fontSize: "10px", color: "#cbd5e1", fontWeight: 500 }}>Buffer</span>
          )}
        </div>
      )}
    </>
  );
}

function AppointmentPopover({
  appt, x, y, onClose, onEdit, onStatusChange, onViewPatient, onViewHistory, providers,
}: {
  appt: AppointmentData; x: number; y: number;
  onClose: () => void; onEdit: () => void;
  onStatusChange: (id: string, status: string, reason?: string) => void;
  onViewPatient: () => void;
  onViewHistory: (id: string) => void;
  providers: Provider[];
}) {
  const [confirmingStatus, setConfirmingStatus] = useState<"CANCELLED" | "NO_SHOW" | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const color = getApptColor(appt);
  const start = new Date(appt.startTime);
  const end = new Date(appt.endTime);
  const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
  const patientName = appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : appt.title;
  const typeName = appt.configuredType?.name || appt.appointmentCategory;
  const nextStatus = STATUS_NEXT[appt.status];

  const statusActions: { label: string; status: string; color: string; variant: "primary" | "secondary" | "danger" }[] = [];
  if (nextStatus) {
    statusActions.push({ label: nextStatus.label, status: nextStatus.next, color: nextStatus.color, variant: "primary" });
  }
  if (!["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(appt.status)) {
    statusActions.push({ label: "No Show", status: "NO_SHOW", color: "#ef4444", variant: "danger" });
    statusActions.push({ label: "Cancel", status: "CANCELLED", color: "#94a3b8", variant: "secondary" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={onClose}>
      <div
        data-popover="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", left: `${x}px`, top: `${y}px`, width: "320px",
          backgroundColor: "#ffffff", borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden", animation: "popoverIn 80ms ease-out", zIndex: 101,
        }}
      >
        <div style={{ height: "4px", backgroundColor: color }} />
        <div style={{ padding: "14px 16px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", flex: 1, marginRight: "8px" }}>{patientName}</div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#94a3b8" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", backgroundColor: colorWithAlpha(color, 0.12), color: color }}>
              {typeName}
            </span>
            <StatusBadge status={appt.status} />
          </div>

          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "7px" }}>
            <PopoverRow icon={<Calendar size={14} color="#64748b" />} value={start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} />
            <PopoverRow icon={<Clock size={14} color="#64748b" />} value={`${formatTime12(start)} – ${formatTime12(end)} (${durationMins} min)`} />
            {appt.provider && (
              <PopoverRow icon={<UserIcon size={14} color="#64748b" />} value={`${appt.provider.firstName} ${appt.provider.lastName}`} />
            )}
            {appt.roomName && (
              <PopoverRow icon={<MapPin size={14} color="#64748b" />} value={appt.roomName} />
            )}
            {appt.subcategory && (
              <PopoverRow icon={<span style={{ width: "14px", display: "inline-flex", justifyContent: "center", fontSize: "12px" }}>›</span>} value={`${typeName} › ${appt.subcategory.name}`} />
            )}
          </div>

          {statusActions.length > 0 && (
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "12px", paddingTop: "10px" }}>
              {confirmingStatus === "CANCELLED" ? (
                <div style={{ background: "var(--bg-secondary, #f8fafc)", borderRadius: "8px", padding: "12px", marginTop: "8px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>Cancel this appointment?</div>
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason (optional)"
                    style={{
                      width: "100%", padding: "6px 10px", fontSize: "12px",
                      border: "1px solid #e2e8f0", borderRadius: "6px",
                      outline: "none", marginBottom: "8px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => {
                        onStatusChange(appt.id, "CANCELLED", cancelReason || undefined);
                        setConfirmingStatus(null);
                        setCancelReason("");
                      }}
                      style={{
                        flex: 1, fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px",
                        border: "none", backgroundColor: "#ef4444", color: "#fff", cursor: "pointer",
                      }}>
                      Yes, Cancel
                    </button>
                    <button
                      onClick={() => { setConfirmingStatus(null); setCancelReason(""); }}
                      style={{
                        flex: 1, fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px",
                        border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#64748b", cursor: "pointer",
                      }}>
                      Go Back
                    </button>
                  </div>
                </div>
              ) : confirmingStatus === "NO_SHOW" ? (
                <div style={{ background: "var(--bg-secondary, #f8fafc)", borderRadius: "8px", padding: "12px", marginTop: "8px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>Mark as no-show?</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => {
                        onStatusChange(appt.id, "NO_SHOW");
                        setConfirmingStatus(null);
                      }}
                      style={{
                        flex: 1, fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px",
                        border: "none", backgroundColor: "#f59e0b", color: "#fff", cursor: "pointer",
                      }}>
                      Yes, No-Show
                    </button>
                    <button
                      onClick={() => setConfirmingStatus(null)}
                      style={{
                        flex: 1, fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px",
                        border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#64748b", cursor: "pointer",
                      }}>
                      Go Back
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Status Actions</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {statusActions.map((action) => (
                      <button
                        key={action.status}
                        data-testid={`popover-status-${action.status}`}
                        onClick={() => {
                          if (action.status === "CANCELLED") {
                            setConfirmingStatus("CANCELLED");
                          } else if (action.status === "NO_SHOW") {
                            setConfirmingStatus("NO_SHOW");
                          } else {
                            onStatusChange(appt.id, action.status);
                          }
                        }}
                        style={{
                          fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px",
                          border: action.variant === "primary" ? "none" : `1px solid ${action.variant === "danger" ? "#fecaca" : "#e2e8f0"}`,
                          backgroundColor: action.variant === "primary" ? action.color : action.variant === "danger" ? "#fef2f2" : "#f8fafc",
                          color: action.variant === "primary" ? "#fff" : action.variant === "danger" ? "#ef4444" : "#64748b",
                          cursor: "pointer",
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "12px", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                data-testid="popover-view-history"
                onClick={() => { onClose(); onViewHistory(appt.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  fontSize: "12px", fontWeight: 500, color: "#94a3b8",
                  background: "none", border: "none", cursor: "pointer",
                }}
              >
                <History size={13} /> History
              </button>
              <button data-testid="popover-edit" onClick={onEdit}
                style={{
                  fontSize: "12px", fontWeight: 600, padding: "6px 14px", borderRadius: "6px",
                  border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#1e293b", cursor: "pointer",
                }}>
                Edit
              </button>
            </div>
            {appt.patient && (
              <button data-testid="popover-view-patient" onClick={onViewPatient}
                style={{ fontSize: "12px", fontWeight: 500, color: "#10b981", background: "none", border: "none", cursor: "pointer" }}>
                View Patient →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PopoverRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {icon}
      <span style={{ fontSize: "13px", color: "#1e293b" }}>{value}</span>
    </div>
  );
}

function DayView({
  date, appointments, providers, allProviders, selectedProviders, isLoading,
  onTimeSlotClick, onAppointmentClick, onStatusChange,
}: {
  date: Date; appointments: AppointmentData[];
  providers: Provider[]; allProviders: Provider[];
  selectedProviders: string[]; isLoading: boolean;
  onTimeSlotClick?: (date: Date, startTime: string, providerId?: string) => void;
  onAppointmentClick?: (appt: AppointmentData, event: ReactMouseEvent) => void;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = isToday(date);
  const weekend = isWeekend(date);
  const dateStr = formatDateYMD(date);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = (WORK_START - START_HOUR - 0.5) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [date]);

  const showMultiCol = providers.length > 1;
  const visibleProviders = showMultiCol ? providers.slice(0, 6) : [null];

  const filteredAppts = appointments.filter(a => a.status !== "CANCELLED");
  const isEmpty = filteredAppts.length === 0 && !isLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {showMultiCol && (
        <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", backgroundColor: "#fff", flexShrink: 0 }}>
          <div style={{ width: `${TIME_COL_WIDTH}px`, flexShrink: 0 }} />
          {visibleProviders.map((p, i) => {
            if (!p) return null;
            const provIdx = allProviders.findIndex(pr => pr.id === p.id);
            const provColor = getProviderColor(provIdx);
            const count = filteredAppts.filter(a => a.provider?.id === p.id).length;
            return (
              <div key={p.id} style={{
                flex: 1, minWidth: "160px", padding: "10px 12px", textAlign: "center",
                borderLeft: i > 0 ? "1px solid #e8ecf0" : "none",
                height: "72px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%", backgroundColor: provColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: 700, color: "#fff",
                }}>
                  {getInitials(p.firstName, p.lastName)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>{p.firstName} {p.lastName}</span>
                  <span style={{ fontSize: "10px", fontWeight: 500, color: "#64748b", backgroundColor: "#f1f5f9", padding: "1px 5px", borderRadius: "8px" }}>{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: showMultiCol ? "auto" : "hidden", position: "relative" }}>
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.6)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>Loading...</span>
          </div>
        )}
        <div style={{ display: "flex", minWidth: showMultiCol ? `${TIME_COL_WIDTH + visibleProviders.filter(Boolean).length * 160}px` : "auto", position: "relative" }}>
          <TimeColumn />
          {visibleProviders.map((provider, colIdx) => {
            const colAppts = provider
              ? filteredAppts.filter(
                  (a) => a.provider?.id === provider.id ||
                         a.attendees?.some(att => att.user.id === provider.id)
                )
              : filteredAppts;
            const handleSlotClick = (hour: number, half: boolean) => {
              const mins = half ? 30 : 0;
              const timeStr = `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
              onTimeSlotClick?.(date, timeStr, provider?.id);
            };
            return (
              <div key={provider?.id || "single"} style={{
                flex: 1, minWidth: showMultiCol ? "160px" : "auto",
                position: "relative",
                borderLeft: colIdx > 0 || showMultiCol ? "1px solid #e8ecf0" : "none",
              }}>
                <HourGridDroppable isWeekend={weekend} isToday={today} onSlotClick={handleSlotClick} dateStr={dateStr} providerId={provider?.id || "same"} />
                {today && <CurrentTimeLine showLabel={colIdx === 0} />}
                {colAppts.map((appt) => (
                  <AppointmentBlock
                    key={appt.id}
                    appt={appt}
                    onClick={onAppointmentClick}
                    onStatusChange={onStatusChange}
                    draggable={true}
                    isAttendeeView={provider ? appt.provider?.id !== provider.id : false}
                  />
                ))}
              </div>
            );
          })}
        </div>
        {isEmpty && !showMultiCol && (
          <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)", color: "#cbd5e1", fontSize: "13px", fontWeight: 500 }}>
            No appointments
          </div>
        )}
      </div>
    </div>
  );
}

function WeekView({
  weekStart, appointments, onDayClick, isLoading, onTimeSlotClick, onAppointmentClick, onStatusChange, getApptsCountForDay,
}: {
  weekStart: Date; appointments: AppointmentData[];
  onDayClick: (date: Date) => void; isLoading: boolean;
  onTimeSlotClick?: (date: Date, startTime: string, providerId?: string) => void;
  onAppointmentClick?: (appt: AppointmentData, event: ReactMouseEvent) => void;
  onStatusChange?: (id: string, status: string) => void;
  getApptsCountForDay: (day: Date) => number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = (WORK_START - START_HOUR - 0.5) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [weekStart]);

  const filteredAppts = appointments.filter(a => a.status !== "CANCELLED");

  const getApptsForDay = (day: Date) => {
    return filteredAppts.filter((a) => {
      const s = new Date(a.startTime);
      return s.getFullYear() === day.getFullYear() && s.getMonth() === day.getMonth() && s.getDate() === day.getDate();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {isLoading && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.6)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>Loading...</span>
        </div>
      )}
      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", backgroundColor: "#fff", flexShrink: 0 }}>
        <div style={{ width: `${TIME_COL_WIDTH}px`, flexShrink: 0 }} />
        {days.map((day) => {
          const dayIsToday = isToday(day);
          const weekend = isWeekend(day);
          const count = getApptsCountForDay(day);
          return (
            <button key={day.toISOString()} data-testid={`week-day-header-${day.getDay()}`} onClick={() => onDayClick(day)}
              style={{
                flex: 1, padding: "8px 4px 6px", textAlign: "center", cursor: "pointer",
                background: dayIsToday ? "rgba(16,185,129,0.04)" : "transparent",
                border: "none", borderLeft: "1px solid #e8ecf0",
                height: "72px", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "2px",
              }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </div>
              <div style={{
                fontSize: "24px", fontWeight: 700, color: dayIsToday ? "#fff" : "#1e293b", lineHeight: 1.2,
                ...(dayIsToday ? {
                  display: "inline-flex", width: "34px", height: "34px", borderRadius: "50%",
                  backgroundColor: "#10b981", alignItems: "center", justifyContent: "center", fontSize: "18px",
                } : {}),
              }}>
                {day.getDate()}
              </div>
              {count > 0 && (
                <span style={{ fontSize: "10px", fontWeight: 500, color: "#64748b", backgroundColor: "#f1f5f9", padding: "0 6px", borderRadius: "8px", lineHeight: "16px" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", position: "relative" }}>
          <TimeColumn />
          {days.map((day) => {
            const dayAppts = getApptsForDay(day);
            const weekend = isWeekend(day);
            const dayIsToday = isToday(day);
            const dayStr = formatDateYMD(day);
            const handleSlotClick = (hour: number, half: boolean) => {
              const mins = half ? 30 : 0;
              const timeStr = `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
              onTimeSlotClick?.(day, timeStr);
            };
            return (
              <div key={day.toISOString()} style={{ flex: 1, position: "relative", borderLeft: "1px solid #e8ecf0", minWidth: 0 }}>
                <HourGridDroppable isWeekend={weekend} isToday={dayIsToday} onSlotClick={handleSlotClick} dateStr={dayStr} providerId="same" />
                {dayIsToday && <CurrentTimeLine showLabel={false} />}
                {dayAppts.map((appt) => (
                  <AppointmentBlock key={appt.id} appt={appt} onClick={onAppointmentClick} onStatusChange={onStatusChange} draggable={true} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgendaView({
  selectedProvider, selectedProviders, onAppointmentClick, onStatusChange,
}: {
  selectedProvider: string; selectedProviders: string[];
  onAppointmentClick?: (appt: AppointmentData, event: ReactMouseEvent) => void;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const [days, setDays] = useState(30);
  const { data: agendaItems = [], isLoading } = useQuery<AppointmentData[]>({
    queryKey: ["/api/appointments/agenda", selectedProvider, days],
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days) });
      if (selectedProvider !== "all") params.set("providerId", selectedProvider);
      const res = await fetch(`/api/appointments/agenda?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const filteredItems = useMemo(() => {
    if (selectedProviders.length === 0) return agendaItems;
    return agendaItems.filter(a =>
      (a.provider && selectedProviders.includes(a.provider.id)) ||
      (a.attendees && a.attendees.some(att => selectedProviders.includes(att.user.id)))
    );
  }, [agendaItems, selectedProviders]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentData[]>();
    filteredItems.forEach(a => {
      const d = new Date(a.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries());
  }, [filteredItems]);

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
      {grouped.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#cbd5e1", fontSize: "13px" }}>No upcoming appointments</div>
      )}
      {grouped.map(([dateKey, items]) => {
        const dateObj = new Date(dateKey + "T12:00:00");
        const dayLabel = isToday(dateObj) ? "Today" : dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        return (
          <div key={dateKey} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "6px", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>{dayLabel}</div>
            {items.map((appt) => {
              const start = new Date(appt.startTime);
              const end = new Date(appt.endTime);
              const color = getApptColor(appt);
              const patientName = appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : appt.title;
              const typeName = appt.configuredType?.name || appt.appointmentCategory;
              const nextStatus = STATUS_NEXT[appt.status];
              return (
                <div key={appt.id} data-testid={`agenda-item-${appt.id}`} onClick={(e) => onAppointmentClick?.(appt, e)}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 16px", borderRadius: "8px",
                    backgroundColor: "#ffffff", border: "1px solid #f1f5f9",
                    borderLeft: `3px solid ${color}`, marginBottom: "6px",
                    transition: "background-color 120ms ease", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
                >
                  <div style={{ width: "110px", flexShrink: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      {formatTime12(start)} – {formatTime12(end)}
                    </div>
                  </div>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>{patientName}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                      {typeName}
                      {appt.subcategory && ` · ${appt.subcategory.name}`}
                    </div>
                  </div>
                  {appt.provider && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <div style={{
                        width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#e2e8f0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "8px", fontWeight: 700, color: "#64748b",
                      }}>
                        {getInitials(appt.provider.firstName, appt.provider.lastName)}
                      </div>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>{appt.provider.firstName}</span>
                    </div>
                  )}
                  <StatusBadge status={appt.status} />
                  {nextStatus && onStatusChange && (
                    <button data-testid={`button-agenda-status-${appt.id}`}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(appt.id, nextStatus.next); }}
                      style={{
                        fontSize: "10px", fontWeight: 700, color: "#fff",
                        backgroundColor: nextStatus.color, border: "none", borderRadius: "4px",
                        padding: "3px 10px", cursor: "pointer", flexShrink: 0,
                      }}>
                      {nextStatus.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ textAlign: "center", padding: "12px" }}>
        <button data-testid="button-load-more" onClick={() => setDays((d) => d + 30)}
          style={{
            padding: "8px 20px", fontSize: "12px", fontWeight: 600,
            color: "#10b981", backgroundColor: "transparent",
            border: "1px solid #d1fae5", borderRadius: "8px", cursor: "pointer",
          }}>
          Load More
        </button>
      </div>
    </div>
  );
}

function RescheduleConfirmModal({ confirm, onCancel, onConfirm }: {
  confirm: { appointmentId: string; patientName: string; typeName: string; fromTime: Date; toTime: Date; durationMins: number };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", width: "400px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>Reschedule Appointment?</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "16px" }}>
          {confirm.patientName} · {confirm.typeName}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>
            From: {confirm.fromTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(confirm.fromTime)}
          </div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
            → To: {confirm.toTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(confirm.toTime)}
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel}
            style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#64748b", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", backgroundColor: "#10B981", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            Confirm Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryDrawer({ appointmentId, onClose }: { appointmentId: string; onClose: () => void }) {
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/appointments", appointmentId, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/history`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const ACTION_ICONS: Record<string, { Icon: any; color: string }> = {
    appointment_created: { Icon: PlusCircle, color: "#10B981" },
    appointment_updated: { Icon: Pencil, color: "#3B82F6" },
    appointment_rescheduled: { Icon: Clock, color: "#F59E0B" },
    appointment_status_changed: { Icon: ArrowRight, color: "#8B5CF6" },
    appointment_cancelled: { Icon: XCircle, color: "#EF4444" },
    appointment_no_show: { Icon: UserXIcon, color: "#F59E0B" },
    appointment_deleted: { Icon: Trash2, color: "#EF4444" },
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 200 }} onClick={onClose} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: "360px",
        backgroundColor: "#ffffff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        zIndex: 201, display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", margin: 0 }}>Appointment History</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {isLoading && (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "13px" }}>Loading...</div>
          )}
          {!isLoading && activities.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "#cbd5e1", fontSize: "13px" }}>No history yet</div>
          )}
          {activities.map((activity: any) => {
            const metadata = activity.metadata || {};
            const action = metadata.action || "";
            const iconEntry = ACTION_ICONS[action] || { Icon: Activity, color: "#94A3B8" };
            const IconComp = iconEntry.Icon;
            return (
              <div key={activity.id} style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  backgroundColor: colorWithAlpha(iconEntry.color, 0.12),
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <IconComp size={14} color={iconEntry.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", color: "#1e293b", marginBottom: "2px" }}>{activity.body}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }} title={new Date(activity.createdAt).toISOString()}>
                    {relativeTime(activity.createdAt)}
                    {activity.user && ` · ${activity.user.firstName}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    CONFIRMED: { bg: "rgba(16,185,129,0.1)", color: "#10B981", label: "Confirmed" },
    PENDING: { bg: "rgba(245,158,11,0.1)", color: "#F59E0B", label: "Pending" },
    CHECKED_IN: { bg: "rgba(59,130,246,0.1)", color: "#3B82F6", label: "Checked In" },
    ROOMED: { bg: "rgba(99,102,241,0.1)", color: "#6366F1", label: "Roomed" },
    IN_PROGRESS: { bg: "rgba(139,92,246,0.1)", color: "#8B5CF6", label: "In Progress" },
    COMPLETED: { bg: "rgba(107,114,128,0.1)", color: "#6B7280", label: "Completed" },
    ENDED: { bg: "rgba(107,114,128,0.1)", color: "#6B7280", label: "Ended" },
    CHECKED_OUT: { bg: "rgba(107,114,128,0.1)", color: "#6B7280", label: "Checked Out" },
    NO_SHOW: { bg: "rgba(239,68,68,0.1)", color: "#EF4444", label: "No Show" },
    CANCELLED: { bg: "rgba(107,114,128,0.1)", color: "#9CA3AF", label: "Cancelled" },
    HOLD: { bg: "rgba(245,158,11,0.1)", color: "#F59E0B", label: "Hold" },
  };
  const s = styles[status] || styles.CONFIRMED;
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
      backgroundColor: s.bg, color: s.color, whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

const navBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: "6px",
  backgroundColor: "#ffffff", cursor: "pointer", color: "#64748b",
  fontSize: "13px", fontWeight: 500,
};
