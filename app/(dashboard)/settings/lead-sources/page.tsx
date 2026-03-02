"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, Archive, RotateCcw, Trash2, Plus, X, ArrowDownAZ } from "lucide-react";

const CHANNEL_TYPES = [
  { value: "PAID", label: "Paid", color: "#F59E0B", bg: "#FEF3C7" },
  { value: "ORGANIC", label: "Organic", color: "#059669", bg: "#D1FAE5" },
  { value: "RELATIONSHIP", label: "Relationship", color: "#3B82F6", bg: "#DBEAFE" },
] as const;

function getChannelStyle(channelType: string) {
  return CHANNEL_TYPES.find((c) => c.value === channelType) || CHANNEL_TYPES[0];
}

interface LeadSourceData {
  id: string;
  name: string;
  channelType: "PAID" | "ORGANIC" | "RELATIONSHIP";
  status: "ACTIVE" | "ARCHIVED";
  sortOrder: number;
  inUseCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function LeadSourcesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSourceData | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<LeadSourceData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadSourceData | null>(null);
  const [sorted, setSorted] = useState(false);

  const { data: sources = [], isLoading } = useQuery<LeadSourceData[]>({
    queryKey: ["/api/settings/lead-sources", { includeArchived: showArchived }],
    queryFn: async () => {
      const res = await fetch(`/api/settings/lead-sources?includeArchived=${showArchived}`);
      if (!res.ok) throw new Error("Failed to fetch lead sources");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/lead-sources/${id}/archive`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to archive lead source");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/lead-sources"] });
      setConfirmArchive(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/lead-sources/${id}/restore`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to restore lead source");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/lead-sources"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/lead-sources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete lead source");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/lead-sources"] });
      setConfirmDelete(null);
    },
  });

  const handleArchiveClick = (source: LeadSourceData) => {
    if (source.inUseCount > 0) {
      setConfirmArchive(source);
    } else {
      archiveMutation.mutate(source.id);
    }
  };

  const activeSources = sources.filter((s) => s.status === "ACTIVE");
  const archivedSources = sources.filter((s) => s.status === "ARCHIVED");

  const displayActive = sorted
    ? [...activeSources].sort((a, b) => a.name.localeCompare(b.name))
    : activeSources;

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading lead sources...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 data-testid="text-settings-title" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            Lead Sources
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Define the channels your practice uses to acquire leads. Used for marketing attribution and ROI reporting.
          </p>
        </div>
        <button
          data-testid="button-add-lead-source"
          onClick={() => { setEditingSource(null); setModalOpen(true); }}
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
          Add Lead Source
        </button>
      </div>

      {sources.length === 0 && !showArchived ? (
        <EmptyState onAdd={() => { setEditingSource(null); setModalOpen(true); }} />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <button
              data-testid="button-sort-az"
              onClick={() => setSorted(!sorted)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 500,
                color: sorted ? "var(--brand-primary)" : "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <ArrowDownAZ size={14} strokeWidth={1.8} />
              Sort A-Z
            </button>
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
                  <th style={{ ...thStyle, paddingLeft: "16px" }}>Source</th>
                  <th style={thStyle}>Channel</th>
                  {showArchived && <th style={thStyle}>Status</th>}
                  <th style={thStyle}>In Use</th>
                  <th style={{ ...thStyle, textAlign: "right", paddingRight: "16px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayActive.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    showStatus={showArchived}
                    onEdit={() => { setEditingSource(source); setModalOpen(true); }}
                    onArchive={() => handleArchiveClick(source)}
                  />
                ))}
                {showArchived && archivedSources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    showStatus={true}
                    onRestore={() => restoreMutation.mutate(source.id)}
                    onDelete={() => setConfirmDelete(source)}
                    isArchived
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOpen && (
        <SourceModal
          source={editingSource}
          onClose={() => { setModalOpen(false); setEditingSource(null); }}
          onSaved={() => {
            setModalOpen(false);
            setEditingSource(null);
            queryClient.invalidateQueries({ queryKey: ["/api/settings/lead-sources"] });
          }}
        />
      )}

      {confirmArchive && (
        <ConfirmDialog
          title={`Archive "${confirmArchive.name}"?`}
          body="It will no longer appear in lead source pickers, but existing records will retain it and it will remain available in reports."
          confirmLabel="Archive Source"
          onConfirm={() => archiveMutation.mutate(confirmArchive.id)}
          onCancel={() => setConfirmArchive(null)}
          loading={archiveMutation.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}" permanently?`}
          body="This action cannot be undone. The lead source will be permanently removed."
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

function SourceRow({
  source,
  showStatus,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  isArchived,
}: {
  source: LeadSourceData;
  showStatus: boolean;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
}) {
  const channel = getChannelStyle(source.channelType);
  return (
    <tr
      data-testid={`row-lead-source-${source.id}`}
      style={{
        borderBottom: "1px solid var(--border-default)",
        opacity: isArchived ? 0.55 : 1,
      }}
    >
      <td style={{ padding: "12px 12px 12px 16px" }}>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
          {source.name}
        </span>
      </td>
      <td style={{ padding: "12px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: "10px",
            backgroundColor: channel.bg,
            color: channel.color,
          }}
        >
          {channel.label}
        </span>
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
        {source.inUseCount > 0 ? `${source.inUseCount} record${source.inUseCount !== 1 ? "s" : ""}` : "\u2014"}
      </td>
      <td style={{ padding: "12px 16px 12px 12px", textAlign: "right" }}>
        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
          {isArchived ? (
            <>
              <ActionButton testId={`button-restore-source-${source.id}`} icon={RotateCcw} title="Restore" onClick={onRestore} />
              <ActionButton testId={`button-delete-source-${source.id}`} icon={Trash2} title="Delete Permanently" onClick={onDelete} destructive />
            </>
          ) : (
            <>
              <ActionButton testId={`button-edit-source-${source.id}`} icon={Pencil} title="Edit" onClick={onEdit} />
              <ActionButton testId={`button-archive-source-${source.id}`} icon={Archive} title="Archive" onClick={onArchive} />
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
          <Megaphone size={22} style={{ color: "var(--text-muted)" }} strokeWidth={1.6} />
        </div>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
          No lead sources yet
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", maxWidth: "300px" }}>
          Add your first lead source to start tracking where your patients come from.
        </p>
        <button
          data-testid="button-add-lead-source-empty"
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
          Add Lead Source
        </button>
      </div>
    </div>
  );
}

function SourceModal({
  source,
  onClose,
  onSaved,
}: {
  source: LeadSourceData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(source?.name || "");
  const [channelType, setChannelType] = useState<string>(source?.channelType || "ORGANIC");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = !!source;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Source name is required");
      return;
    }
    if (trimmed.length > 48) {
      setError("Source name must be 48 characters or less");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEdit ? `/api/settings/lead-sources/${source.id}` : "/api/settings/lead-sources";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, channelType }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save lead source");
        setSaving(false);
        return;
      }

      onSaved();
    } catch {
      setError("Failed to save lead source");
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
        data-testid="modal-lead-source-form"
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
            {isEdit ? "Edit Lead Source" : "Add Lead Source"}
          </h3>
          <button
            data-testid="button-close-source-modal"
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
              Source Name
            </label>
            <input
              data-testid="input-source-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              maxLength={48}
              placeholder="e.g. Google Ads, Word of Mouth"
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
              <p data-testid="text-source-error" style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px" }}>{error}</p>
            )}
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              {name.length}/48
            </p>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "8px" }}>
              Channel Type
            </label>
            <div style={{ display: "flex", gap: "0", borderRadius: "6px", border: "1px solid var(--border-default)", overflow: "hidden" }}>
              {CHANNEL_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  data-testid={`button-channel-${ct.value.toLowerCase()}`}
                  onClick={() => setChannelType(ct.value)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    fontSize: "12px",
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: channelType === ct.value ? ct.bg : "var(--bg-secondary)",
                    color: channelType === ct.value ? ct.color : "var(--text-secondary)",
                    borderRight: ct.value !== "RELATIONSHIP" ? "1px solid var(--border-default)" : "none",
                    transition: "all 100ms ease",
                  }}
                >
                  {ct.label}
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
            data-testid="button-cancel-source"
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
            data-testid="button-save-source"
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
    >
      <div
        data-testid="modal-confirm-dialog"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "360px",
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
              backgroundColor: loading ? "var(--text-muted)" : destructive ? "#EF4444" : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
