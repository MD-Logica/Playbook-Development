"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare, Pencil, Trash2, Plus, GripVertical,
  CheckCircle, DollarSign, FileText, Clipboard, Shield,
  Heart, UserCheck, CalendarCheck, Camera, Pill, Stethoscope,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ICON_MAP: Record<string, any> = {
  "check-circle": CheckCircle,
  "dollar-sign": DollarSign,
  "file-text": FileText,
  "clipboard": Clipboard,
  "shield": Shield,
  "heart": Heart,
  "user-check": UserCheck,
  "calendar-check": CalendarCheck,
  "camera": Camera,
  "pill": Pill,
  "stethoscope": Stethoscope,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const INTEGRATION_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  STRIPE: { label: "Stripe", bg: "#f0fdf4", color: "#16a34a" },
  DOCUSIGN: { label: "DocuSign", bg: "#eff6ff", color: "#2563eb" },
  PANDADOC: { label: "PandaDoc", bg: "#faf5ff", color: "#7c3aed" },
  MANUAL: { label: "Manual", bg: "#f1f5f9", color: "#64748b" },
};

interface IndicatorData {
  id: string;
  label: string;
  icon: string;
  integrationType: string;
  isEnabled: boolean;
  sortOrder: number;
}

export default function ReadinessIndicatorsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<IndicatorData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IndicatorData | null>(null);

  const { data: indicators = [], isLoading } = useQuery<IndicatorData[]>({
    queryKey: ["/api/settings/readiness-indicators"],
    queryFn: async () => {
      const res = await fetch("/api/settings/readiness-indicators");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await fetch(`/api/settings/readiness-indicators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/readiness-indicators"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/settings/readiness-indicators/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/readiness-indicators"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/readiness-indicators/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/readiness-indicators"] });
      setConfirmDelete(null);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = indicators.findIndex((i) => i.id === active.id);
      const newIndex = indicators.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(indicators, oldIndex, newIndex);
      reorderMutation.mutate(reordered.map((i) => i.id));
    },
    [indicators, reorderMutation]
  );

  if (isLoading) {
    return (
      <div style={{ maxWidth: "800px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Readiness Indicators</h1>
        </div>
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", fontSize: "13px" }}>
          Loading indicators...
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            Readiness Indicators
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Configure which indicators are tracked per appointment. Connect integrations as they become available.
          </p>
        </div>
        <button
          data-testid="button-add-indicator"
          onClick={() => { setEditingIndicator(null); setModalOpen(true); }}
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
          Add Indicator
        </button>
      </div>

      {indicators.length === 0 ? (
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
          <CheckSquare size={32} strokeWidth={1.3} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>No indicators yet</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>Indicators will be seeded automatically.</p>
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={indicators.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {indicators.map((ind, idx) => (
                <SortableRow
                  key={ind.id}
                  indicator={ind}
                  isLast={idx === indicators.length - 1}
                  onEdit={() => { setEditingIndicator(ind); setModalOpen(true); }}
                  onDelete={() => setConfirmDelete(ind)}
                  onToggle={(enabled) => toggleMutation.mutate({ id: ind.id, isEnabled: enabled })}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {modalOpen && (
        <IndicatorModal
          editing={editingIndicator}
          onClose={() => { setModalOpen(false); setEditingIndicator(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Indicator"
          message={`Permanently delete "${confirmDelete.label}"? This cannot be undone.`}
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

function SortableRow({
  indicator,
  isLast,
  onEdit,
  onDelete,
  onToggle,
}: {
  indicator: IndicatorData;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: indicator.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : "auto" as any,
  };

  const IconComponent = ICON_MAP[indicator.icon] || CheckCircle;
  const badge = INTEGRATION_BADGES[indicator.integrationType] || INTEGRATION_BADGES.MANUAL;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--border-default)",
        backgroundColor: isDragging ? "var(--bg-secondary)" : "transparent",
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
      onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", color: "var(--text-muted)", marginRight: "8px", display: "flex", alignItems: "center" }}
        data-testid={`drag-handle-${indicator.id}`}
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </div>

      <div style={{ marginRight: "10px", color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
        <IconComponent size={16} strokeWidth={1.8} />
      </div>

      <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>
        {indicator.label}
      </span>

      <span
        style={{
          fontSize: "11px",
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: "4px",
          backgroundColor: badge.bg,
          color: badge.color,
          marginRight: "12px",
        }}
      >
        {badge.label}
      </span>

      <label
        style={{ position: "relative", display: "inline-block", width: "36px", height: "20px", marginRight: "12px", cursor: "pointer" }}
        data-testid={`toggle-${indicator.id}`}
      >
        <input
          type="checkbox"
          checked={indicator.isEnabled}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "10px",
            backgroundColor: indicator.isEnabled ? "var(--brand-primary)" : "#cbd5e1",
            transition: "background-color 200ms ease",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: indicator.isEnabled ? "18px" : "2px",
            top: "2px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: "#fff",
            transition: "left 200ms ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: "4px" }}>
        <IconBtn icon={Pencil} title="Edit" onClick={onEdit} testId={`button-edit-${indicator.id}`} />
        <IconBtn icon={Trash2} title="Delete" onClick={onDelete} color="#EF4444" testId={`button-delete-${indicator.id}`} />
      </div>
    </div>
  );
}

function IndicatorModal({ editing, onClose }: { editing: IndicatorData | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [label, setLabel] = useState(editing?.label || "");
  const [icon, setIcon] = useState(editing?.icon || "check-circle");
  const [integrationType, setIntegrationType] = useState(editing?.integrationType || "MANUAL");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEditing
        ? `/api/settings/readiness-indicators/${editing.id}`
        : "/api/settings/readiness-indicators";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/readiness-indicators"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSave = () => {
    if (!label.trim()) { setError("Label is required"); return; }
    setError("");
    mutation.mutate({ label: label.trim(), icon, integrationType });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", width: "480px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          {isEditing ? "Edit Indicator" : "Add Readiness Indicator"}
        </h3>

        {error && (
          <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", color: "#ef4444", fontSize: "12px", borderRadius: "6px", marginBottom: "12px" }}>{error}</div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Label</label>
          <input
            data-testid="input-indicator-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Photo Consent"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Icon</label>
          <div style={{ position: "relative" }}>
            <select
              data-testid="select-indicator-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              style={{
                ...inputStyle,
                appearance: "none",
                paddingLeft: "32px",
                cursor: "pointer",
              }}
            >
              {ICON_OPTIONS.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            <div style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
              {(() => { const IC = ICON_MAP[icon] || CheckCircle; return <IC size={14} strokeWidth={1.8} />; })()}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Integration Type</label>
          <select
            data-testid="select-integration-type"
            value={integrationType}
            onChange={(e) => setIntegrationType(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="MANUAL">Manual</option>
            <option value="STRIPE">Stripe</option>
            <option value="DOCUSIGN">DocuSign</option>
            <option value="PANDADOC">PandaDoc</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-default)" }}>
          <button data-testid="button-modal-cancel" onClick={onClose} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
          <button data-testid="button-modal-save" onClick={handleSave} disabled={mutation.isPending} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "#fff", backgroundColor: mutation.isPending ? "var(--text-muted)" : "var(--brand-primary)", border: "none", borderRadius: "6px", cursor: mutation.isPending ? "default" : "pointer", opacity: mutation.isPending ? 0.7 : 1 }}>{mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, title, onClick, color, testId }: { icon: any; title: string; onClick: () => void; color?: string; testId?: string }) {
  return (
    <button
      data-testid={testId}
      title={title}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "28px", height: "28px", borderRadius: "4px",
        border: "none", background: "none", cursor: "pointer",
        color: color || "var(--text-muted)", transition: "all 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <Icon size={14} strokeWidth={1.8} />
    </button>
  );
}

function ConfirmDialog({ title, message, confirmLabel, destructive, onConfirm, onCancel, loading }: {
  title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ backgroundColor: "var(--bg-primary)", borderRadius: "10px", width: "400px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>{title}</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button data-testid="button-confirm-cancel" onClick={onCancel} style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border-default)", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
          <button data-testid="button-confirm-action" onClick={onConfirm} disabled={loading} style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 500, color: "#fff", backgroundColor: destructive ? "#EF4444" : "var(--brand-primary)", border: "none", borderRadius: "6px", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}>{loading ? "..." : confirmLabel}</button>
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
