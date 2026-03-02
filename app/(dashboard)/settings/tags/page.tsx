"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Pencil, Archive, RotateCcw, Trash2, Plus, Check, X } from "lucide-react";

const TAG_PALETTE = [
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

interface TagData {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  status: "ACTIVE" | "ARCHIVED";
  sortOrder: number;
  inUseCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<TagData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TagData | null>(null);

  const { data: tags = [], isLoading } = useQuery<TagData[]>({
    queryKey: ["/api/settings/tags", { includeArchived: showArchived }],
    queryFn: async () => {
      const res = await fetch(`/api/settings/tags?includeArchived=${showArchived}`);
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/tags/${id}/archive`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to archive tag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tags"] });
      setConfirmArchive(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/tags/${id}/restore`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to restore tag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tags"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/tags/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete tag");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tags"] });
      setConfirmDelete(null);
    },
  });

  const handleArchiveClick = (tag: TagData) => {
    if (tag.inUseCount > 0) {
      setConfirmArchive(tag);
    } else {
      archiveMutation.mutate(tag.id);
    }
  };

  const activeTags = tags.filter((t) => t.status === "ACTIVE");
  const archivedTags = tags.filter((t) => t.status === "ARCHIVED");

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading tags...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 data-testid="text-settings-title" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            Tags
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Create and manage tags applied to patient records. Tags are used for segmentation and reporting.
          </p>
        </div>
        <button
          data-testid="button-add-tag"
          onClick={() => { setEditingTag(null); setModalOpen(true); }}
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
            flexShrink: 0,
          }}
        >
          <Plus size={14} strokeWidth={2} />
          Add Tag
        </button>
      </div>

      {tags.length === 0 && !showArchived ? (
        <EmptyState onAdd={() => { setEditingTag(null); setModalOpen(true); }} />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <label
              data-testid="toggle-show-archived"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-secondary)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <button
                data-testid="button-toggle-archived"
                onClick={() => setShowArchived(!showArchived)}
                style={{
                  width: "32px",
                  height: "18px",
                  borderRadius: "9px",
                  backgroundColor: showArchived ? "var(--brand-primary)" : "var(--border-default)",
                  position: "relative",
                  transition: "background-color 150ms ease",
                  cursor: "pointer",
                  display: "inline-block",
                  border: "none",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: showArchived ? "16px" : "2px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    transition: "left 150ms ease",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  }}
                />
              </button>
              Show Archived
            </label>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: "8px",
              border: "1px solid var(--border-default)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <th style={{ ...thStyle, paddingLeft: "16px" }}>Tag</th>
                  {showArchived && <th style={thStyle}>Status</th>}
                  <th style={thStyle}>In Use</th>
                  <th style={{ ...thStyle, textAlign: "right", paddingRight: "16px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeTags.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    showStatus={showArchived}
                    onEdit={() => { setEditingTag(tag); setModalOpen(true); }}
                    onArchive={() => handleArchiveClick(tag)}
                  />
                ))}
                {showArchived && archivedTags.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    showStatus={true}
                    onRestore={() => restoreMutation.mutate(tag.id)}
                    onDelete={() => setConfirmDelete(tag)}
                    isArchived
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOpen && (
        <TagModal
          tag={editingTag}
          onClose={() => { setModalOpen(false); setEditingTag(null); }}
          onSaved={() => {
            setModalOpen(false);
            setEditingTag(null);
            queryClient.invalidateQueries({ queryKey: ["/api/settings/tags"] });
          }}
        />
      )}

      {confirmArchive && (
        <ConfirmDialog
          title={`Archive "${confirmArchive.name}"?`}
          body="It will no longer appear in tag pickers, but existing patient records will retain it and it will remain available in reports."
          confirmLabel="Archive Tag"
          onConfirm={() => archiveMutation.mutate(confirmArchive.id)}
          onCancel={() => setConfirmArchive(null)}
          loading={archiveMutation.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}" permanently?`}
          body="This action cannot be undone. The tag will be permanently removed."
          confirmLabel="Delete Permanently"
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
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-muted)",
};

function TagRow({
  tag,
  showStatus,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  isArchived,
}: {
  tag: TagData;
  showStatus: boolean;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
}) {
  return (
    <tr
      data-testid={`row-tag-${tag.id}`}
      style={{
        borderBottom: "1px solid var(--border-default)",
        opacity: isArchived ? 0.55 : 1,
      }}
    >
      <td style={{ padding: "12px 12px 12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: tag.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
            {tag.emoji && <span style={{ marginRight: "4px" }}>{tag.emoji}</span>}
            {tag.name}
          </span>
        </div>
      </td>
      {showStatus && (
        <td style={{ padding: "12px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: "10px",
              backgroundColor: isArchived ? "var(--bg-tertiary)" : "#D1FAE5",
              color: isArchived ? "var(--text-muted)" : "#065F46",
            }}
          >
            {isArchived ? "Archived" : "Active"}
          </span>
        </td>
      )}
      <td style={{ padding: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
        {tag.inUseCount > 0 ? `${tag.inUseCount} patient${tag.inUseCount !== 1 ? "s" : ""}` : "—"}
      </td>
      <td style={{ padding: "12px 16px 12px 12px", textAlign: "right" }}>
        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
          {isArchived ? (
            <>
              <ActionButton
                testId={`button-restore-tag-${tag.id}`}
                icon={RotateCcw}
                title="Restore"
                onClick={onRestore}
              />
              <ActionButton
                testId={`button-delete-tag-${tag.id}`}
                icon={Trash2}
                title="Delete Permanently"
                onClick={onDelete}
                destructive
              />
            </>
          ) : (
            <>
              <ActionButton
                testId={`button-edit-tag-${tag.id}`}
                icon={Pencil}
                title="Edit"
                onClick={onEdit}
              />
              <ActionButton
                testId={`button-archive-tag-${tag.id}`}
                icon={Archive}
                title="Archive"
                onClick={onArchive}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function ActionButton({
  testId,
  icon: Icon,
  title,
  onClick,
  destructive,
}: {
  testId: string;
  icon: any;
  title: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      data-testid={testId}
      title={title}
      onClick={onClick}
      style={{
        width: "28px",
        height: "28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "4px",
        border: "none",
        backgroundColor: "transparent",
        color: destructive ? "#EF4444" : "var(--text-muted)",
        cursor: "pointer",
        transition: "all 100ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = destructive ? "#FEE2E2" : "var(--bg-tertiary)";
        e.currentTarget.style.color = destructive ? "#DC2626" : "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = destructive ? "#EF4444" : "var(--text-muted)";
      }}
    >
      <Icon size={14} strokeWidth={1.8} />
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "300px",
        backgroundColor: "var(--bg-primary)",
        borderRadius: "8px",
        border: "1px solid var(--border-default)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "var(--bg-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Tag size={22} style={{ color: "var(--text-muted)" }} strokeWidth={1.6} />
        </div>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
          No tags yet
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", maxWidth: "280px" }}>
          Create your first tag to start organizing patient records.
        </p>
        <button
          data-testid="button-add-tag-empty"
          onClick={onAdd}
          style={{
            display: "inline-flex",
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
          }}
        >
          <Plus size={14} strokeWidth={2} />
          Add Tag
        </button>
      </div>
    </div>
  );
}

function TagModal({
  tag,
  onClose,
  onSaved,
}: {
  tag: TagData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(tag?.name || "");
  const [color, setColor] = useState(tag?.color || TAG_PALETTE[0].hex);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = !!tag;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Tag name is required");
      return;
    }
    if (trimmed.length > 32) {
      setError("Tag name must be 32 characters or less");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEdit ? `/api/settings/tags/${tag.id}` : "/api/settings/tags";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save tag");
        setSaving(false);
        return;
      }

      onSaved();
    } catch {
      setError("Failed to save tag");
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="modal-tag-form"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "380px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
            {isEdit ? "Edit Tag" : "Add Tag"}
          </h3>
          <button
            data-testid="button-close-tag-modal"
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Tag Name
            </label>
            <input
              data-testid="input-tag-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              maxLength={32}
              placeholder="e.g. VIP, Surgical Candidate"
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                borderRadius: "6px",
                border: error ? "1px solid #EF4444" : "1px solid var(--border-default)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.borderColor = "var(--brand-primary)";
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.borderColor = "var(--border-default)";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
            {error && (
              <p data-testid="text-tag-error" style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px" }}>{error}</p>
            )}
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              {name.length}/32
            </p>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "8px" }}>
              Color
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {TAG_PALETTE.map((c) => (
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
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "border-color 100ms ease",
                    outline: "none",
                  }}
                >
                  {color === c.hex && <Check size={14} strokeWidth={2.5} style={{ color: "#fff" }} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            data-testid="button-cancel-tag"
            onClick={onClose}
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
            data-testid="button-save-tag"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: saving ? "var(--text-muted)" : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  body: string;
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
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 110,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        data-testid="modal-confirm-dialog"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "380px",
          padding: "24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
          {title}
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>
          {body}
        </p>
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
              backgroundColor: loading
                ? "var(--text-muted)"
                : destructive
                  ? "#EF4444"
                  : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
