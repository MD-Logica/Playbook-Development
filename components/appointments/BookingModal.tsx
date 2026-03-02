"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Search, Clock, AlertTriangle, Trash2, Ban, UserX, Loader2 } from "lucide-react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  prefill?: {
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
  };
}

interface AppointmentType {
  id: string;
  name: string;
  color: string;
  durationMins: number;
  bufferMins: number;
  subcategories: { id: string; name: string }[];
}

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

interface DealResult {
  id: string;
  title: string;
  stage?: { id: string; name: string };
}

interface ProviderResult {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 19; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 19 && m > 45) break;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    TIME_SLOTS.push(`${hh}:${mm}`);
  }
}

function formatTime12(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function addMinutesToTime(time24: string, mins: number): string {
  const [hStr, mStr] = time24.split(":");
  let totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + mins;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookingModal({ isOpen, onClose, onSaved, prefill }: BookingModalProps) {
  const [isBlock, setIsBlock] = useState(false);
  const [blockTitle, setBlockTitle] = useState("");
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [patientId, setPatientId] = useState(prefill?.patientId || "");
  const [patientName, setPatientName] = useState(prefill?.patientName || "");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [dealId, setDealId] = useState(prefill?.dealId || "");
  const [dealTitle, setDealTitle] = useState(prefill?.dealTitle || "");
  const [deals, setDeals] = useState<DealResult[]>([]);
  const [providerId, setProviderId] = useState(prefill?.providerId || "");
  const [date, setDate] = useState(prefill?.date || todayStr());
  const [startTime, setStartTime] = useState(prefill?.startTime || "09:00");
  const [duration, setDuration] = useState(60);
  const [bufferMins, setBufferMins] = useState(0);
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");

  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [providers, setProviders] = useState<ProviderResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");

  const [conflictWarning, setConflictWarning] = useState<{ message: string; payload: any } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [noShowConfirm, setNoShowConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const patientRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isEditMode = !!prefill?.appointmentId;

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/settings/appointment-types").then(r => r.json()).then(setAppointmentTypes).catch(() => {});
    fetch("/api/providers").then(r => r.json()).then(setProviders).catch(() => {});
    fetch("/api/user/role").then(r => r.json()).then(d => setUserRole(d.role || "")).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setIsBlock(false);
    setBlockTitle("");
    setAppointmentTypeId("");
    setSubcategoryId("");
    setPatientId(prefill?.patientId || "");
    setPatientName(prefill?.patientName || "");
    setPatientSearch("");
    setPatientResults([]);
    setPatientDropdownOpen(false);
    setDealId(prefill?.dealId || "");
    setDealTitle(prefill?.dealTitle || "");
    setDeals([]);
    setProviderId(prefill?.providerId || "");
    setDate(prefill?.date || todayStr());
    setStartTime(prefill?.startTime || "09:00");
    setDuration(60);
    setBufferMins(0);
    setRoom("");
    setNotes("");
    setEditData(null);
    setCancelConfirm(false);
    setCancelReason("");
    setNoShowConfirm(false);
    setDeleteConfirm(false);
    setConflictWarning(null);

    if (prefill?.appointmentId) {
      setLoadingEdit(true);
      fetch(`/api/appointments/${prefill.appointmentId}`)
        .then(r => r.json())
        .then(appt => {
          setEditData(appt);
          setIsBlock(appt.isInternal || false);
          setBlockTitle(appt.isInternal ? appt.title : "");
          setAppointmentTypeId(appt.appointmentTypeId || "");
          setSubcategoryId(appt.subcategoryId || "");
          setPatientId(appt.patientId || "");
          if (appt.patient) {
            setPatientName(`${appt.patient.firstName} ${appt.patient.lastName}`);
          }
          setDealId(appt.opportunityId || "");
          if (appt.opportunity) setDealTitle(appt.opportunity.title || "");
          setProviderId(appt.providerId || "");
          const st = new Date(appt.startTime);
          const et = new Date(appt.endTime);
          setDate(`${st.getFullYear()}-${String(st.getMonth() + 1).padStart(2, "0")}-${String(st.getDate()).padStart(2, "0")}`);
          setStartTime(`${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}`);
          setDuration(Math.round((et.getTime() - st.getTime()) / 60000));
          setBufferMins(appt.bufferMins || 0);
          setRoom(appt.roomName || "");
          setNotes(appt.notes || "");
          if (appt.patientId) {
            fetch(`/api/search?patientId=${appt.patientId}`).then(r => r.json()).then(d => setDeals(d.deals || [])).catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => setLoadingEdit(false));
    }
    if (prefill?.patientId && !prefill?.appointmentId) {
      fetch(`/api/search?patientId=${prefill.patientId}`).then(r => r.json()).then(d => setDeals(d.deals || [])).catch(() => {});
    }
  }, [isOpen, prefill?.appointmentId, prefill?.patientId, prefill?.patientName, prefill?.dealId, prefill?.dealTitle, prefill?.providerId, prefill?.date, prefill?.startTime]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setPatientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const searchPatients = useCallback((q: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q || q.length < 1) {
      setPatientResults([]);
      setPatientDropdownOpen(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setPatientResults(data.patients || []);
        setPatientDropdownOpen(true);
      } catch {
        setPatientResults([]);
      }
    }, 250);
  }, []);

  const selectPatient = (p: PatientResult) => {
    setPatientId(p.id);
    setPatientName(`${p.firstName} ${p.lastName}`);
    setPatientSearch("");
    setPatientDropdownOpen(false);
    setDealId("");
    setDealTitle("");
    fetch(`/api/search?patientId=${p.id}`).then(r => r.json()).then(d => setDeals(d.deals || [])).catch(() => {});
  };

  const clearPatient = () => {
    setPatientId("");
    setPatientName("");
    setDeals([]);
    setDealId("");
    setDealTitle("");
  };

  const onTypeChange = (typeId: string) => {
    setAppointmentTypeId(typeId);
    setSubcategoryId("");
    const t = appointmentTypes.find(at => at.id === typeId);
    if (t) {
      setDuration(t.durationMins);
      setBufferMins(t.bufferMins);
    } else {
      setBufferMins(0);
    }
  };

  const selectedType = appointmentTypes.find(t => t.id === appointmentTypeId);
  const endTimeStr = addMinutesToTime(startTime, duration);

  const buildPayload = () => {
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    return {
      title: isBlock ? (blockTitle || "Block") : (selectedType?.name || "Appointment"),
      isInternal: isBlock,
      appointmentTypeId: appointmentTypeId || null,
      subcategoryId: subcategoryId || null,
      patientId: isBlock ? null : (patientId || null),
      opportunityId: isBlock ? null : (dealId || null),
      providerId,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      bufferMins,
      roomName: room || null,
      notes: notes || null,
    };
  };

  const handleSubmit = async (force = false) => {
    if (!providerId) return;
    if (!isBlock && !appointmentTypeId) return;

    setSubmitting(true);
    setConflictWarning(null);

    const payload = buildPayload();

    try {
      let res: Response;
      if (isEditMode) {
        res = await fetch(`/api/appointments/${prefill!.appointmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, force }),
        });
      } else {
        res = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, force }),
        });
      }

      const data = await res.json();

      if (res.ok) {
        if (data.conflict && !force) {
          setConflictWarning({ message: data.message || "Provider has an overlapping appointment.", payload });
          setSubmitting(false);
          return;
        }
        onSaved?.();
        onClose();
      } else {
        alert(data.error || "Failed to save appointment");
      }
    } catch {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!prefill?.appointmentId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${prefill.appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED", reason: cancelReason || undefined }),
      });
      if (res.ok) {
        onSaved?.();
        onClose();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to cancel");
      }
    } catch {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoShow = async () => {
    if (!prefill?.appointmentId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${prefill.appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NO_SHOW" }),
      });
      if (res.ok) {
        onSaved?.();
        onClose();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to mark no-show");
      }
    } catch {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!prefill?.appointmentId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${prefill.appointmentId}`, { method: "DELETE" });
      if (res.ok) {
        onSaved?.();
        onClose();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete");
      }
    } catch {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isTerminal = editData && ["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(editData.status);
  const canCancel = editData && !["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(editData.status);
  const canNoShow = editData && !["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(editData.status);
  const canDelete = userRole === "ADMIN";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "var(--bg-primary)",
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

  const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#10B981";
  };
  const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--border-default)";
  };

  return (
    <div
      data-testid="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
      }}
    >
      <div
        data-testid="booking-modal"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "12px",
          width: "560px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <h2
            data-testid="text-booking-modal-title"
            style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}
          >
            {isEditMode ? "Edit Appointment" : "New Appointment"}
          </h2>
          <button
            data-testid="button-close-booking"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        {loadingEdit ? (
          <div style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
            <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Loading appointment...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label
                data-testid="toggle-block"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <div
                  onClick={() => setIsBlock(!isBlock)}
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "10px",
                    backgroundColor: isBlock ? "#10B981" : "var(--bg-tertiary)",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background-color 150ms",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: isBlock ? "18px" : "2px",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      backgroundColor: "#FFFFFF",
                      transition: "left 150ms",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </div>
                Internal Block
              </label>
            </div>

            {isBlock && (
              <div>
                <label style={labelStyle}>Block Title</label>
                <input
                  data-testid="input-block-title"
                  style={inputStyle}
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="e.g., Lunch Break, Staff Meeting"
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </div>
            )}

            <div>
              <label style={labelStyle}>Appointment Type {!isBlock && "*"}</label>
              <div style={{ position: "relative" }}>
                <select
                  data-testid="select-appointment-type"
                  style={{ ...inputStyle, cursor: "pointer", paddingLeft: appointmentTypeId && selectedType ? "30px" : "12px" }}
                  value={appointmentTypeId}
                  onChange={(e) => onTypeChange(e.target.value)}
                  onFocus={focusHandler as any}
                  onBlur={blurHandler as any}
                >
                  <option value="">Select type...</option>
                  {appointmentTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {appointmentTypeId && selectedType && (
                  <div
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: selectedType.color,
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </div>

            {selectedType && selectedType.subcategories.length > 0 && (
              <div>
                <label style={labelStyle}>Subcategory</label>
                <select
                  data-testid="select-subcategory"
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  onFocus={focusHandler as any}
                  onBlur={blurHandler as any}
                >
                  <option value="">None</option>
                  {selectedType.subcategories.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!isBlock && (
              <>
                <div ref={patientRef} style={{ position: "relative" }}>
                  <label style={labelStyle}>Patient</label>
                  {patientId ? (
                    <div
                      style={{
                        ...inputStyle,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: prefill?.lockPatient ? "var(--bg-tertiary)" : "var(--bg-primary)",
                      }}
                    >
                      <span data-testid="text-selected-patient" style={{ fontSize: "14px", color: "var(--text-primary)" }}>{patientName}</span>
                      {!prefill?.lockPatient && (
                        <button
                          data-testid="button-clear-patient"
                          onClick={clearPatient}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0" }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                      <input
                        data-testid="input-patient-search"
                        style={{ ...inputStyle, paddingLeft: "30px" }}
                        value={patientSearch}
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          searchPatients(e.target.value);
                        }}
                        placeholder="Search patients..."
                        onFocus={focusHandler}
                        onBlur={blurHandler}
                      />
                    </div>
                  )}
                  {patientDropdownOpen && patientResults.length > 0 && (
                    <div
                      data-testid="patient-search-results"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        backgroundColor: "var(--bg-primary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "6px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        maxHeight: "200px",
                        overflowY: "auto",
                        marginTop: "4px",
                      }}
                    >
                      {patientResults.map(p => (
                        <div
                          key={p.id}
                          data-testid={`patient-result-${p.id}`}
                          onClick={() => selectPatient(p)}
                          style={{
                            padding: "8px 12px",
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            color: "var(--text-primary)",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <span style={{ fontWeight: 500 }}>{p.firstName} {p.lastName}</span>
                          {p.phone && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{p.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Deal (optional)</label>
                  <select
                    data-testid="select-deal"
                    style={{
                      ...inputStyle,
                      cursor: "pointer",
                      backgroundColor: prefill?.lockDeal ? "var(--bg-tertiary)" : "var(--bg-primary)",
                    }}
                    value={dealId}
                    onChange={(e) => {
                      setDealId(e.target.value);
                      const d = deals.find(dd => dd.id === e.target.value);
                      setDealTitle(d?.title || "");
                    }}
                    disabled={!!prefill?.lockDeal}
                    onFocus={focusHandler as any}
                    onBlur={blurHandler as any}
                  >
                    <option value="">No deal</option>
                    {deals.map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label style={labelStyle}>Provider *</label>
              <select
                data-testid="select-provider"
                style={{ ...inputStyle, cursor: "pointer" }}
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                onFocus={focusHandler as any}
                onBlur={blurHandler as any}
              >
                <option value="">Select provider...</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Date *</label>
                <input
                  data-testid="input-date"
                  type="date"
                  style={inputStyle}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Start Time *</label>
                <select
                  data-testid="select-start-time"
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  onFocus={focusHandler as any}
                  onBlur={blurHandler as any}
                >
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{formatTime12(t)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Duration (minutes) *</label>
                <input
                  data-testid="input-duration"
                  type="number"
                  style={inputStyle}
                  value={duration}
                  min={5}
                  step={5}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={11} />
                  Ends at {formatTime12(endTimeStr)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Buffer</label>
                <div
                  data-testid="text-buffer"
                  style={{
                    ...inputStyle,
                    backgroundColor: "var(--bg-tertiary)",
                    color: "var(--text-muted)",
                    cursor: "default",
                  }}
                >
                  {bufferMins > 0 ? `${bufferMins} min` : "None"}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Room</label>
              <input
                data-testid="input-room"
                style={inputStyle}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g., Room 3, Laser Suite"
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </div>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                data-testid="input-notes"
                style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                onFocus={focusHandler as any}
                onBlur={blurHandler as any}
              />
            </div>

            {isEditMode && editData && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                  Status: {editData.status}
                </div>

                {cancelConfirm ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", backgroundColor: "var(--bg-secondary)", borderRadius: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Cancel this appointment?</span>
                    <input
                      data-testid="input-cancel-reason"
                      style={inputStyle}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason (optional)"
                      onFocus={focusHandler}
                      onBlur={blurHandler}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        data-testid="button-confirm-cancel"
                        onClick={handleCancelAppointment}
                        disabled={submitting}
                        style={{
                          flex: 1,
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#FFFFFF",
                          backgroundColor: "#EF4444",
                          border: "none",
                          borderRadius: "6px",
                          cursor: submitting ? "not-allowed" : "pointer",
                          opacity: submitting ? 0.6 : 1,
                        }}
                      >
                        {submitting ? "Cancelling..." : "Yes, Cancel"}
                      </button>
                      <button
                        data-testid="button-dismiss-cancel"
                        onClick={() => setCancelConfirm(false)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          backgroundColor: "var(--bg-tertiary)",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        No, Keep
                      </button>
                    </div>
                  </div>
                ) : noShowConfirm ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", backgroundColor: "var(--bg-secondary)", borderRadius: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Mark as No-Show?</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        data-testid="button-confirm-noshow"
                        onClick={handleNoShow}
                        disabled={submitting}
                        style={{
                          flex: 1,
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#FFFFFF",
                          backgroundColor: "#F59E0B",
                          border: "none",
                          borderRadius: "6px",
                          cursor: submitting ? "not-allowed" : "pointer",
                          opacity: submitting ? 0.6 : 1,
                        }}
                      >
                        {submitting ? "Marking..." : "Yes, No-Show"}
                      </button>
                      <button
                        data-testid="button-dismiss-noshow"
                        onClick={() => setNoShowConfirm(false)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          backgroundColor: "var(--bg-tertiary)",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : deleteConfirm ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", backgroundColor: "var(--bg-secondary)", borderRadius: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#EF4444" }}>Delete this appointment permanently?</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        data-testid="button-confirm-delete"
                        onClick={handleDelete}
                        disabled={submitting}
                        style={{
                          flex: 1,
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#FFFFFF",
                          backgroundColor: "#EF4444",
                          border: "none",
                          borderRadius: "6px",
                          cursor: submitting ? "not-allowed" : "pointer",
                          opacity: submitting ? 0.6 : 1,
                        }}
                      >
                        {submitting ? "Deleting..." : "Yes, Delete"}
                      </button>
                      <button
                        data-testid="button-dismiss-delete"
                        onClick={() => setDeleteConfirm(false)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          backgroundColor: "var(--bg-tertiary)",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {canCancel && (
                      <button
                        data-testid="button-cancel-appointment"
                        onClick={() => setCancelConfirm(true)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#EF4444",
                          backgroundColor: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Ban size={13} /> Cancel
                      </button>
                    )}
                    {canNoShow && (
                      <button
                        data-testid="button-noshow-appointment"
                        onClick={() => setNoShowConfirm(true)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#F59E0B",
                          backgroundColor: "rgba(245,158,11,0.08)",
                          border: "1px solid rgba(245,158,11,0.2)",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <UserX size={13} /> No-Show
                      </button>
                    )}
                    {canDelete && (
                      <button
                        data-testid="button-delete-appointment"
                        onClick={() => setDeleteConfirm(true)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!loadingEdit && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              data-testid="button-cancel-modal"
              onClick={onClose}
              style={{
                padding: "8px 20px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-tertiary)",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              data-testid="button-save-appointment"
              onClick={() => handleSubmit(false)}
              disabled={submitting || (!isBlock && !appointmentTypeId) || !providerId}
              style={{
                padding: "8px 20px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#10B981",
                border: "none",
                borderRadius: "6px",
                cursor: submitting || (!isBlock && !appointmentTypeId) || !providerId ? "not-allowed" : "pointer",
                opacity: submitting || (!isBlock && !appointmentTypeId) || !providerId ? 0.6 : 1,
              }}
            >
              {submitting ? "Saving..." : isEditMode ? "Save Changes" : "Book Appointment"}
            </button>
          </div>
        )}
      </div>

      {conflictWarning && (
        <div
          data-testid="conflict-warning-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setConflictWarning(null); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <div
            data-testid="conflict-warning-dialog"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: "12px",
              padding: "24px",
              width: "400px",
              maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={18} style={{ color: "#F59E0B" }} />
              </div>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Schedule Conflict</h3>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: "1.5" }}>
              {conflictWarning.message}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                data-testid="button-conflict-cancel"
                onClick={() => setConflictWarning(null)}
                style={{
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Go Back
              </button>
              <button
                data-testid="button-conflict-confirm"
                onClick={() => {
                  setConflictWarning(null);
                  handleSubmit(true);
                }}
                style={{
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "#F59E0B",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Book Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
