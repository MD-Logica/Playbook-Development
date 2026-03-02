"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Pencil, Trash2, Plus, X, Check } from "lucide-react";

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

interface StatusData {
  id: string;
  label: string;
  color: string;
  isSystem: boolean;
  isTerminal: boolean;
  sortOrder: number;
}

export default function AppointmentStatusesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#6B7280");
  const [editTerminal, setEditTerminal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StatusData | null>(null);

  const { data: statuses = [], isLoading } = useQuery<StatusData[]>({
    queryKey: ["/api/settings/appointment-statuses"],
    queryFn: async () => {
      const res = await fetch("/api/settings/appointment-statuses");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/settings/appointment-statuses/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-statuses"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/appointment-statuses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-statuses"] });
      setConfirmDelete(null);
    },
  });

  const startEdit = (s: StatusData) => {
    setEditingId(s.id);
    setEditLabel(s.label);
    setEditColor(s.color);
    setEditTerminal(s.isTerminal);
  };

  const saveEdit = (s: StatusData) => {
    const data: any = { color: editColor };
    if (!s.isSystem) {
      data.label = editLabel;
      data.isTerminal = editTerminal;
    }
    updateMutation.mutate({ id: s.id, data });
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: "800px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Appointment Statuses</h1>
        </div>
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", fontSize: "13px" }}>
          Loading statuses...
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            Appointment Statuses
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Customize the status workflow for your appointments. System statuses cannot be deleted.
          </p>
        </div>
        <button
          data-testid="button-add-status"
          onClick={() => setModalOpen(true)}
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
          Add Status
        </button>
      </div>

      {statuses.length === 0 ? (
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
          <Activity size={32} strokeWidth={1.3} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>No statuses yet</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>Statuses will be seeded automatically.</p>
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
          {statuses.map((s, idx) => (
            <div key={s.id}>
              {editingId === s.id ? (
                <div
                  data-testid={`row-status-edit-${s.id}`}
                  style={{
                    padding: "12px 16px",
                    borderBottom: idx < statuses.length - 1 ? "1px solid var(--border-default)" : "none",
                    backgroundColor: "var(--bg-secondary)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c.hex}
                          data-testid={`color-${c.name.toLowerCase()}`}
                          onClick={() => setEditColor(c.hex)}
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            backgroundColor: c.hex,
                            border: editColor === c.hex ? "2px solid var(--text-primary)" : "2px solid transparent",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      data-testid="input-edit-label"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      disabled={s.isSystem}
                      style={{
                        flex: 1,
                        padding: "7px 10px",
                        fontSize: "13px",
                        color: s.isSystem ? "var(--text-muted)" : "var(--text-primary)",
                        backgroundColor: s.isSystem ? "var(--bg-tertiary)" : "var(--bg-primary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "6px",
                        outline: "none",
                        cursor: s.isSystem ? "not-allowed" : "text",
                      }}
                    />
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: s.isSystem ? "var(--text-muted)" : "var(--text-secondary)",
                        cursor: s.isSystem ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editTerminal}
                        onChange={(e) => setEditTerminal(e.target.checked)}
                        disabled={s.isSystem}
                        style={{ accentColor: "var(--brand-primary)" }}
                      />
                      Terminal
                    </label>
                    <button
                      data-testid="button-save-edit"
                      onClick={() => saveEdit(s)}
                      disabled={updateMutation.isPending}
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
                        color: "var(--brand-primary)",
                      }}
                    >
                      <Check size={16} strokeWidth={2} />
                    </button>
                    <button
                      data-testid="button-cancel-edit"
                      onClick={() => setEditingId(null)}
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
                        color: "var(--text-muted)",
                      }}
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  data-testid={`row-status-${s.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: idx < statuses.length - 1 ? "1px solid var(--border-default)" : "none",
                    transition: "background-color 120ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: s.color,
                      flexShrink: 0,
                      marginRight: "10px",
                    }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>
                    {s.label}
                  </span>
                  {s.isSystem && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                        marginRight: "8px",
                      }}
                    >
                      System
                    </span>
                  )}
                  {s.isTerminal && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        backgroundColor: "#fef2f2",
                        color: "#ef4444",
                        marginRight: "8px",
                      }}
                    >
                      Terminal
                    </span>
                  )}
                  <div style={{ display: "flex", gap: "4px" }}>
                    <IconBtn icon={Pencil} title="Edit" onClick={() => startEdit(s)} testId={`button-edit-${s.id}`} />
                    {!s.isSystem && (
                      <IconBtn icon={Trash2} title="Delete" onClick={() => setConfirmDelete(s)} color="#EF4444" testId={`button-delete-${s.id}`} />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <AddStatusModal
          onClose={() => setModalOpen(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Status"
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

function AddStatusModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [isTerminal, setIsTerminal] = useState(false);
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/settings/appointment-statuses", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/settings/appointment-statuses"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSave = () => {
    if (!label.trim()) { setError("Label is required"); return; }
    setError("");
    createMutation.mutate({ label: label.trim(), color, isTerminal });
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
        zIndex: 1001,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "440px",
          padding: "24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          Add Custom Status
        </h3>

        {error && (
          <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", color: "#ef4444", fontSize: "12px", borderRadius: "6px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Label</label>
          <input
            data-testid="input-new-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Ready for Checkout"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.hex}
                onClick={() => setColor(c.hex)}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: c.hex,
                  border: color === c.hex ? "2px solid var(--text-primary)" : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isTerminal}
              onChange={(e) => setIsTerminal(e.target.checked)}
              style={{ accentColor: "var(--brand-primary)" }}
            />
            Terminal — marks appointment as completed/ended
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-default)" }}>
          <button
            data-testid="button-modal-cancel"
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
            data-testid="button-modal-save"
            onClick={handleSave}
            disabled={createMutation.isPending}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: createMutation.isPending ? "var(--text-muted)" : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: createMutation.isPending ? "default" : "pointer",
              opacity: createMutation.isPending ? 0.7 : 1,
            }}
          >
            {createMutation.isPending ? "Saving..." : "Create"}
          </button>
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
