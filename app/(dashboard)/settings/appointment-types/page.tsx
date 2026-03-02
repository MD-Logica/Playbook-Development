"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pencil, Archive, RotateCcw, Trash2, Plus, X, Check, Clock, Shield } from "lucide-react";

const COLOR_PALETTE = [
  { name: "Slate", hex: "#64748B" },
  { name: "Red", hex: "#EF4444" },
  { name: "Orange", hex: "#F97316" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Green", hex: "#10B981" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Rose", hex: "#F43F5E" },
];

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90];
const BUFFER_PRESETS = [0, 5, 10, 15, 20, 30];

interface SubcategoryData {
  id: string;
  name: string;
  appointmentTypeId: string;
  practiceId: string;
  createdAt: string;
}

interface AppointmentTypeData {
  id: string;
  name: string;
  color: string;
  durationMins: number;
  bufferMins: number;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  subcategories: SubcategoryData[];
  appointmentCount: number;
  upcomingAppointmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AppointmentTypesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AppointmentTypeData | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<AppointmentTypeData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppointmentTypeData | null>(null);
  const [seedChecked, setSeedChecked] = useState(false);

  const { data: types = [], isLoading } = useQuery<AppointmentTypeData[]>({
    queryKey: ["/api/settings/appointment-types", { includeArchived: showArchived }],
    queryFn: async () => {
      const res = await fetch(`/api/settings/appointment-types?includeArchived=${showArchived}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const seedData = [
        { name: "Consultation", color: "#3B82F6", durationMins: 45, bufferMins: 10 },
        { name: "Follow-Up", color: "#10B981", durationMins: 30, bufferMins: 5 },
        { name: "Procedure", color: "#8B5CF6", durationMins: 60, bufferMins: 15 },
        { name: "Treatment", color: "#14B8A6", durationMins: 30, bufferMins: 10 },
        { name: "Pre-Op", color: "#F59E0B", durationMins: 30, bufferMins: 5 },
        { name: "Post-Op", color: "#F97316", durationMins: 20, bufferMins: 5 },
      ];
      for (const item of seedData) {
        await fetch("/api/settings/appointment-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-types"] });
      setSeedChecked(true);
    },
  });

  useEffect(() => {
    if (!isLoading && types.length === 0 && !seedChecked && !showArchived) {
      seedMutation.mutate();
    } else if (!isLoading) {
      setSeedChecked(true);
    }
  }, [isLoading, types.length, seedChecked, showArchived]);

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/appointment-types/${id}/archive`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to archive");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-types"] });
      setConfirmArchive(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/appointment-types/${id}/restore`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to restore");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-types"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/appointment-types/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-types"] });
      setConfirmDelete(null);
    },
  });

  const handleArchiveClick = (t: AppointmentTypeData) => {
    if (t.upcomingAppointmentCount > 0) {
      setConfirmArchive(t);
    } else {
      archiveMutation.mutate(t.id);
    }
  };

  const activeTypes = types.filter((t) => t.status === "ACTIVE");
  const archivedTypes = types.filter((t) => t.status === "ARCHIVED");

  if (isLoading) {
    return (
      <div style={{ maxWidth: "800px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Appointment Types</h1>
        </div>
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", fontSize: "13px" }}>
          Loading appointment types...
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            Appointment Types
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Define the types of appointments your practice offers. These appear when booking and on the calendar.
          </p>
        </div>
        <button
          data-testid="button-add-appointment-type"
          onClick={() => { setEditingType(null); setModalOpen(true); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: "var(--brand-primary)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={14} strokeWidth={2} />
          Add Appointment Type
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <label
          data-testid="toggle-show-archived"
          style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ accentColor: "var(--brand-primary)" }}
          />
          Show Archived
        </label>
      </div>

      {activeTypes.length === 0 && archivedTypes.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "64px 32px",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-default)",
          }}
        >
          <CalendarClock size={32} strokeWidth={1.3} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>No appointment types yet</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>Create your first appointment type to get started.</p>
          <button
            onClick={() => { setEditingType(null); setModalOpen(true); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--brand-primary)",
              backgroundColor: "transparent",
              border: "1px solid var(--brand-primary)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add Appointment Type
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
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Duration</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Buffer</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Subcategories</th>
                <th style={{ ...thStyle, textAlign: "right", paddingRight: "16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTypes.map((t) => (
                <TypeRow
                  key={t.id}
                  type={t}
                  onEdit={() => { setEditingType(t); setModalOpen(true); }}
                  onArchive={() => handleArchiveClick(t)}
                />
              ))}
              {showArchived && archivedTypes.map((t) => (
                <TypeRow
                  key={t.id}
                  type={t}
                  archived
                  onEdit={() => { setEditingType(t); setModalOpen(true); }}
                  onRestore={() => restoreMutation.mutate(t.id)}
                  onDelete={t.appointmentCount === 0 ? () => setConfirmDelete(t) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <AppointmentTypeModal
          editingType={editingType}
          onClose={() => { setModalOpen(false); setEditingType(null); }}
        />
      )}

      {confirmArchive && (
        <ConfirmDialog
          title="Archive Appointment Type"
          message={`This appointment type has ${confirmArchive.upcomingAppointmentCount} upcoming appointment${confirmArchive.upcomingAppointmentCount !== 1 ? "s" : ""}. Archiving it will not affect existing appointments but it will no longer be available for new bookings. Continue?`}
          confirmLabel="Archive"
          onConfirm={() => archiveMutation.mutate(confirmArchive.id)}
          onCancel={() => setConfirmArchive(null)}
          loading={archiveMutation.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Appointment Type"
          message={`Permanently delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-muted)",
  textAlign: "left",
};

function TypeRow({
  type,
  archived,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  type: AppointmentTypeData;
  archived?: boolean;
  onEdit: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}) {
  return (
    <tr
      data-testid={`row-appointment-type-${type.id}`}
      style={{
        borderBottom: "1px solid var(--border-default)",
        opacity: archived ? 0.55 : 1,
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <td style={{ padding: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: type.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{type.name}</span>
        </div>
      </td>
      <td style={{ padding: "12px", textAlign: "center" }}>
        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{type.durationMins} min</span>
      </td>
      <td style={{ padding: "12px", textAlign: "center" }}>
        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          {type.bufferMins > 0 ? `${type.bufferMins} min` : "No buffer"}
        </span>
      </td>
      <td style={{ padding: "12px", textAlign: "center" }}>
        {type.subcategories.length > 0 ? (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {type.subcategories.length} subcategor{type.subcategories.length === 1 ? "y" : "ies"}
          </span>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
        )}
      </td>
      <td style={{ padding: "12px", textAlign: "right", paddingRight: "16px" }}>
        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
          <IconBtn icon={Pencil} title="Edit" onClick={onEdit} testId={`button-edit-${type.id}`} />
          {archived ? (
            <>
              <IconBtn icon={RotateCcw} title="Restore" onClick={onRestore!} testId={`button-restore-${type.id}`} />
              {onDelete && <IconBtn icon={Trash2} title="Delete" onClick={onDelete} color="#EF4444" testId={`button-delete-${type.id}`} />}
            </>
          ) : (
            <IconBtn icon={Archive} title="Archive" onClick={onArchive!} testId={`button-archive-${type.id}`} />
          )}
        </div>
      </td>
    </tr>
  );
}

function IconBtn({
  icon: Icon,
  title,
  onClick,
  color,
  testId,
}: {
  icon: any;
  title: string;
  onClick: () => void;
  color?: string;
  testId?: string;
}) {
  return (
    <button
      data-testid={testId}
      title={title}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "28px",
        height: "28px",
        borderRadius: "4px",
        border: "none",
        background: "none",
        cursor: "pointer",
        color: color || "var(--text-muted)",
        transition: "all 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <Icon size={14} strokeWidth={1.8} />
    </button>
  );
}

function AppointmentTypeModal({
  editingType,
  onClose,
}: {
  editingType: AppointmentTypeData | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!editingType;

  const [name, setName] = useState(editingType?.name || "");
  const [color, setColor] = useState(editingType?.color || "#3B82F6");
  const [durationMins, setDurationMins] = useState(editingType?.durationMins || 30);
  const [customDuration, setCustomDuration] = useState(!DURATION_PRESETS.includes(editingType?.durationMins || 30));
  const [bufferMins, setBufferMins] = useState(editingType?.bufferMins ?? 0);
  const [customBuffer, setCustomBuffer] = useState(!BUFFER_PRESETS.includes(editingType?.bufferMins ?? 0));
  const [description, setDescription] = useState(editingType?.description || "");
  const [subcategories, setSubcategories] = useState<{ id?: string; name: string; isNew?: boolean }[]>(
    editingType?.subcategories.map((s) => ({ id: s.id, name: s.name })) || []
  );
  const [newSubName, setNewSubName] = useState("");
  const [addingNewSub, setAddingNewSub] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const newSubRef = useRef<HTMLInputElement>(null);
  const editSubRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingNewSub && newSubRef.current) newSubRef.current.focus();
  }, [addingNewSub]);

  useEffect(() => {
    if (editingSubId && editSubRef.current) editSubRef.current.focus();
  }, [editingSubId]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/settings/appointment-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-types"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/settings/appointment-types/${editingType!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-types"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSave = async () => {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (name.trim().length > 48) { setError("Name must be 48 characters or less"); return; }
    if (durationMins < 1) { setError("Duration must be at least 1 minute"); return; }

    setSaving(true);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ name, color, durationMins, bufferMins, description });

        const existingSubs = editingType!.subcategories;
        const currentSubIds = subcategories.filter((s) => s.id).map((s) => s.id);

        for (const oldSub of existingSubs) {
          if (!currentSubIds.includes(oldSub.id)) {
            await fetch(`/api/settings/appointment-types/${editingType!.id}/subcategories/${oldSub.id}`, { method: "DELETE" });
          }
        }

        for (const sub of subcategories) {
          if (sub.id) {
            const old = existingSubs.find((s) => s.id === sub.id);
            if (old && old.name !== sub.name) {
              await fetch(`/api/settings/appointment-types/${editingType!.id}/subcategories/${sub.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: sub.name }),
              });
            }
          } else {
            await fetch(`/api/settings/appointment-types/${editingType!.id}/subcategories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: sub.name }),
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-types"] });
        onClose();
      } else {
        await createMutation.mutateAsync({
          name, color, durationMins, bufferMins, description,
          subcategories: subcategories.map((s) => ({ name: s.name })),
        });
      }
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const addSubcategory = () => {
    if (!newSubName.trim()) return;
    const dup = subcategories.find((s) => s.name.toLowerCase() === newSubName.trim().toLowerCase());
    if (dup) { setError("Subcategory name already exists"); return; }
    setSubcategories([...subcategories, { name: newSubName.trim(), isNew: true }]);
    setNewSubName("");
    setAddingNewSub(false);
    setError("");
  };

  const removeSubcategory = (idx: number) => {
    setSubcategories(subcategories.filter((_, i) => i !== idx));
  };

  const startEditSub = (idx: number) => {
    setEditingSubId(String(idx));
    setEditingSubName(subcategories[idx].name);
  };

  const saveEditSub = (idx: number) => {
    if (!editingSubName.trim()) return;
    const dup = subcategories.find((s, i) => i !== idx && s.name.toLowerCase() === editingSubName.trim().toLowerCase());
    if (dup) { setError("Subcategory name already exists"); return; }
    const updated = [...subcategories];
    updated[idx] = { ...updated[idx], name: editingSubName.trim() };
    setSubcategories(updated);
    setEditingSubId(null);
    setError("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "520px",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
            {isEditing ? "Edit Appointment Type" : "Add Appointment Type"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: "8px 12px",
            backgroundColor: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#EF4444",
            marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Name <span style={{ color: "#EF4444" }}>*</span></label>
            <input
              data-testid="input-appointment-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={48}
              placeholder="e.g., Consultation"
              style={inputStyle}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", textAlign: "right" }}>
              {name.length}/48
            </div>
          </div>

          <div>
            <label style={labelStyle}>Color <span style={{ color: "#EF4444" }}>*</span></label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  data-testid={`color-swatch-${c.name.toLowerCase()}`}
                  title={c.name}
                  onClick={() => setColor(c.hex)}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: c.hex,
                    border: color === c.hex ? "2px solid var(--text-primary)" : "2px solid transparent",
                    outline: color === c.hex ? "2px solid var(--bg-primary)" : "none",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Default Duration <span style={{ color: "#EF4444" }}>*</span></label>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: customDuration ? "8px" : "0" }}>
              {DURATION_PRESETS.map((m) => (
                <SegmentBtn
                  key={m}
                  label={`${m} min`}
                  active={!customDuration && durationMins === m}
                  onClick={() => { setCustomDuration(false); setDurationMins(m); }}
                  testId={`duration-${m}`}
                />
              ))}
              <SegmentBtn
                label="Custom"
                active={customDuration}
                onClick={() => setCustomDuration(true)}
                testId="duration-custom"
              />
            </div>
            {customDuration && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  data-testid="input-custom-duration"
                  type="number"
                  min={1}
                  max={480}
                  value={durationMins}
                  onChange={(e) => setDurationMins(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...inputStyle, width: "80px" }}
                />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>minutes</span>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Buffer Time</label>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: customBuffer ? "8px" : "0" }}>
              {BUFFER_PRESETS.map((m) => (
                <SegmentBtn
                  key={m}
                  label={m === 0 ? "None" : `${m} min`}
                  active={!customBuffer && bufferMins === m}
                  onClick={() => { setCustomBuffer(false); setBufferMins(m); }}
                  testId={`buffer-${m}`}
                />
              ))}
              <SegmentBtn
                label="Custom"
                active={customBuffer}
                onClick={() => setCustomBuffer(true)}
                testId="buffer-custom"
              />
            </div>
            {customBuffer && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  data-testid="input-custom-buffer"
                  type="number"
                  min={0}
                  max={120}
                  value={bufferMins}
                  onChange={(e) => setBufferMins(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ ...inputStyle, width: "80px" }}
                />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>minutes</span>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              data-testid="input-appointment-type-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="Internal description (not shown to patients)"
              rows={2}
              style={{ ...inputStyle, resize: "vertical", minHeight: "56px" }}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", textAlign: "right" }}>
              {description.length}/200
            </div>
          </div>

          <div>
            <label style={labelStyle}>Subcategories</label>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", marginTop: "-4px" }}>
              Optional tags for reporting. Staff can select one when booking.
            </p>
            {subcategories.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
                {subcategories.map((sub, idx) => (
                  <div
                    key={sub.id || `new-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 10px",
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: "6px",
                    }}
                  >
                    {editingSubId === String(idx) ? (
                      <>
                        <input
                          ref={editSubRef}
                          value={editingSubName}
                          onChange={(e) => setEditingSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditSub(idx);
                            if (e.key === "Escape") setEditingSubId(null);
                          }}
                          style={{ ...inputStyle, flex: 1, padding: "4px 8px", fontSize: "13px" }}
                        />
                        <button
                          onClick={() => saveEditSub(idx)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-primary)", padding: "2px" }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingSubId(null)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: "13px", color: "var(--text-primary)" }}>{sub.name}</span>
                        <button
                          data-testid={`button-edit-sub-${idx}`}
                          onClick={() => startEditSub(idx)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          data-testid={`button-delete-sub-${idx}`}
                          onClick={() => removeSubcategory(idx)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {addingNewSub ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  ref={newSubRef}
                  data-testid="input-new-subcategory"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSubcategory();
                    if (e.key === "Escape") { setAddingNewSub(false); setNewSubName(""); }
                  }}
                  placeholder="Subcategory name"
                  style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: "13px" }}
                />
                <button
                  onClick={addSubcategory}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-primary)", padding: "2px" }}
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => { setAddingNewSub(false); setNewSubName(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                data-testid="button-add-subcategory"
                onClick={() => setAddingNewSub(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--brand-primary)",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "4px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Plus size={13} /> Add Subcategory
              </button>
            )}
          </div>

          <div
            style={{
              padding: "12px",
              backgroundColor: "var(--bg-secondary)",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Shield size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Provider Restrictions</span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  backgroundColor: "var(--bg-tertiary)",
                  padding: "1px 5px",
                  borderRadius: "3px",
                }}
              >
                Coming Soon
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              Limit this appointment type to specific providers. Available in a future update.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-default)" }}>
          <button
            data-testid="button-cancel"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              backgroundColor: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            data-testid="button-save-appointment-type"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: saving ? "var(--text-muted)" : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SegmentBtn({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 500,
        borderRadius: "5px",
        border: active ? "1px solid var(--brand-primary)" : "1px solid var(--border-default)",
        backgroundColor: active ? "rgba(16, 185, 129, 0.1)" : "var(--bg-primary)",
        color: active ? "var(--brand-primary)" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1001,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "400px",
          padding: "24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>{title}</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            data-testid="button-confirm-cancel"
            onClick={onCancel}
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              backgroundColor: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            data-testid="button-confirm-action"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: destructive ? "#EF4444" : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-secondary)",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "14px",
  color: "var(--text-primary)",
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border-default)",
  borderRadius: "6px",
  outline: "none",
};
