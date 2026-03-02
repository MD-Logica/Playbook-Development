"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Plus, Pencil, Trash2, Check, X, GripVertical,
  ChevronDown, ChevronRight, Clock, AlertTriangle, Trophy, XCircle,
  MoreHorizontal, Archive, Power,
} from "lucide-react";

const STAGE_COLORS = [
  { name: "Gray", hex: "#6B7280" },
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

interface StageData {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string | null;
  rottingThresholdHours: number;
  rottingEnabled: boolean;
  rottingValue: number | null;
  rottingUnit: string | null;
  isWon: boolean;
  isLost: boolean;
  dealCount: number;
}

interface PipelineData {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  order: number;
  dealCount: number;
  stages: StageData[];
}

export default function PipelineSettingsPage() {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [editingPipelineName, setEditingPipelineName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [showNewStageForm, setShowNewStageForm] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageMenuOpen, setStageMenuOpen] = useState<string | null>(null);
  const [confirmDeletePipeline, setConfirmDeletePipeline] = useState<PipelineData | null>(null);
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<StageData | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: pipelines = [], isLoading } = useQuery<PipelineData[]>({
    queryKey: ["/api/settings/pipelines"],
    queryFn: async () => {
      const res = await fetch("/api/settings/pipelines");
      if (!res.ok) throw new Error("Failed to fetch pipelines");
      return res.json();
    },
  });

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) || null;

  const createPipelineMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch("/api/settings/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create pipeline");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pipelines"] });
      setSelectedPipelineId(data.id);
      setShowNewPipelineModal(false);
    },
  });

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; isActive?: boolean; isDefault?: boolean }) => {
      const res = await fetch(`/api/settings/pipelines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update pipeline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pipelines"] });
      setEditingPipelineName(null);
    },
  });

  const deletePipelineMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/pipelines/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete pipeline");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pipelines"] });
      setConfirmDeletePipeline(null);
      if (selectedPipelineId === confirmDeletePipeline?.id) {
        setSelectedPipelineId(null);
      }
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: { pipelineId: string; name: string; color: string; isWon?: boolean; isLost?: boolean }) => {
      const res = await fetch("/api/pipeline/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pipelines"] });
      setShowNewStageForm(false);
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string; rottingEnabled?: boolean; rottingValue?: number | null; rottingUnit?: string | null; isWon?: boolean; isLost?: boolean }) => {
      const res = await fetch(`/api/pipeline/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pipelines"] });
      setEditingStageId(null);
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pipeline/stages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete stage");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pipelines"] });
      setConfirmDeleteStage(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ pipelineId, stageIds }: { pipelineId: string; stageIds: string[] }) => {
      const res = await fetch("/api/pipeline/stages/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, stageIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder stages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pipelines"] });
    },
  });

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || !selectedPipeline) return;
    const regularStages = selectedPipeline.stages.filter((s) => !s.isWon && !s.isLost);
    const wonLostStages = selectedPipeline.stages.filter((s) => s.isWon || s.isLost);
    const newStages = [...regularStages];
    const [moved] = newStages.splice(dragIndex, 1);
    newStages.splice(index, 0, moved);
    const allStageIds = [...newStages, ...wonLostStages].map((s) => s.id);
    reorderMutation.mutate({ pipelineId: selectedPipeline.id, stageIds: allStageIds });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading pipelines...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 data-testid="text-settings-title" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
          Pipeline Settings
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Configure your sales pipelines and stages. Each pipeline represents a distinct workflow for managing deals.
        </p>
      </div>

      <div style={{ display: "flex", gap: "24px" }}>
        {/* Pipeline List - Left Panel */}
        <div style={{ width: "260px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              Pipelines
            </span>
            <button
              data-testid="button-add-pipeline"
              onClick={() => setShowNewPipelineModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--brand-primary)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(16,185,129,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {pipelines.map((p) => (
              <PipelineListItem
                key={p.id}
                pipeline={p}
                isSelected={p.id === selectedPipelineId}
                onSelect={() => setSelectedPipelineId(p.id)}
                isEditingName={editingPipelineName === p.id}
                editNameValue={editNameValue}
                onStartEdit={() => { setEditingPipelineName(p.id); setEditNameValue(p.name); }}
                onEditChange={setEditNameValue}
                onEditSave={() => {
                  if (editNameValue.trim() && editNameValue.trim() !== p.name) {
                    updatePipelineMutation.mutate({ id: p.id, name: editNameValue.trim() });
                  } else {
                    setEditingPipelineName(null);
                  }
                }}
                onEditCancel={() => setEditingPipelineName(null)}
                onToggleActive={() => updatePipelineMutation.mutate({ id: p.id, isActive: !p.isActive })}
                onSetDefault={() => updatePipelineMutation.mutate({ id: p.id, isDefault: true })}
                onDelete={() => setConfirmDeletePipeline(p)}
              />
            ))}
          </div>

          {pipelines.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
              No pipelines yet. Create your first one to get started.
            </div>
          )}
        </div>

        {/* Stage Editor - Right Panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedPipeline ? (
            <PipelineStageEditor
              pipeline={selectedPipeline}
              showNewStageForm={showNewStageForm}
              setShowNewStageForm={setShowNewStageForm}
              editingStageId={editingStageId}
              setEditingStageId={setEditingStageId}
              stageMenuOpen={stageMenuOpen}
              setStageMenuOpen={setStageMenuOpen}
              onCreateStage={(data) => createStageMutation.mutate({ ...data, pipelineId: selectedPipeline.id })}
              onUpdateStage={(data) => updateStageMutation.mutate(data)}
              onDeleteStage={(stage) => setConfirmDeleteStage(stage)}
              isCreating={createStageMutation.isPending}
              isUpdating={updateStageMutation.isPending}
              dragIndex={dragIndex}
              dragOverIndex={dragOverIndex}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
              <div style={{ textAlign: "center" }}>
                <GitBranch size={32} style={{ color: "var(--text-muted)", marginBottom: "12px" }} strokeWidth={1.4} />
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Select a pipeline to configure its stages</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewPipelineModal && (
        <NewPipelineModal
          onClose={() => setShowNewPipelineModal(false)}
          onCreate={(data) => createPipelineMutation.mutate(data)}
          isPending={createPipelineMutation.isPending}
          error={createPipelineMutation.error?.message || null}
        />
      )}

      {confirmDeletePipeline && (
        <ConfirmModal
          title="Delete Pipeline"
          message={`Are you sure you want to delete "${confirmDeletePipeline.name}"? This will also delete all stages. This action cannot be undone.`}
          confirmLabel="Delete"
          isDestructive
          isPending={deletePipelineMutation.isPending}
          error={deletePipelineMutation.error?.message || null}
          onConfirm={() => deletePipelineMutation.mutate(confirmDeletePipeline.id)}
          onCancel={() => { setConfirmDeletePipeline(null); deletePipelineMutation.reset(); }}
        />
      )}

      {confirmDeleteStage && (
        <ConfirmModal
          title="Delete Stage"
          message={confirmDeleteStage.dealCount > 0
            ? `"${confirmDeleteStage.name}" has ${confirmDeleteStage.dealCount} active deal${confirmDeleteStage.dealCount > 1 ? "s" : ""}. You must move or remove them before deleting this stage.`
            : `Are you sure you want to delete "${confirmDeleteStage.name}"? This action cannot be undone.`
          }
          confirmLabel="Delete"
          isDestructive
          isPending={deleteStageMutation.isPending}
          error={deleteStageMutation.error?.message || null}
          disabled={confirmDeleteStage.dealCount > 0}
          onConfirm={() => deleteStageMutation.mutate(confirmDeleteStage.id)}
          onCancel={() => { setConfirmDeleteStage(null); deleteStageMutation.reset(); }}
        />
      )}
    </div>
  );
}

function PipelineListItem({
  pipeline,
  isSelected,
  onSelect,
  isEditingName,
  editNameValue,
  onStartEdit,
  onEditChange,
  onEditSave,
  onEditCancel,
  onToggleActive,
  onSetDefault,
  onDelete,
}: {
  pipeline: PipelineData;
  isSelected: boolean;
  onSelect: () => void;
  isEditingName: boolean;
  editNameValue: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onToggleActive: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      data-testid={`pipeline-item-${pipeline.id}`}
      onClick={() => { if (!isEditingName) onSelect(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "6px",
        cursor: isEditingName ? "default" : "pointer",
        backgroundColor: isSelected ? "rgba(16,185,129,0.08)" : "transparent",
        border: isSelected ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
        transition: "all 120ms ease",
        position: "relative",
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <GitBranch size={15} strokeWidth={1.8} style={{ color: isSelected ? "var(--brand-primary)" : "var(--text-muted)", flexShrink: 0 }} />

      {isEditingName ? (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }} onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            data-testid="input-pipeline-name"
            value={editNameValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onEditSave(); if (e.key === "Escape") onEditCancel(); }}
            style={{
              flex: 1,
              padding: "2px 6px",
              fontSize: "13px",
              border: "1px solid var(--border-default)",
              borderRadius: "4px",
              outline: "none",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />
          <button onClick={onEditSave} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--brand-primary)" }}>
            <Check size={14} />
          </button>
          <button onClick={onEditCancel} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: isSelected ? 600 : 500, color: isSelected ? "var(--brand-primary)" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {pipeline.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {pipeline.stages.length} stage{pipeline.stages.length !== 1 ? "s" : ""} · {pipeline.dealCount} deal{pipeline.dealCount !== 1 ? "s" : ""}
              </span>
              {pipeline.isDefault && (
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--brand-primary)", backgroundColor: "rgba(16,185,129,0.1)", padding: "1px 5px", borderRadius: "3px" }}>
                  DEFAULT
                </span>
              )}
              {!pipeline.isActive && (
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: "3px" }}>
                  INACTIVE
                </span>
              )}
            </div>
          </div>

          <div ref={menuRef} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button
              data-testid={`button-pipeline-menu-${pipeline.id}`}
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: "4px",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 50,
                minWidth: "160px",
                padding: "4px",
              }}>
                <MenuButton icon={Pencil} label="Rename" onClick={() => { setMenuOpen(false); onStartEdit(); }} />
                {!pipeline.isDefault && (
                  <MenuButton icon={Trophy} label="Set as default" onClick={() => { setMenuOpen(false); onSetDefault(); }} />
                )}
                <MenuButton
                  icon={Power}
                  label={pipeline.isActive ? "Deactivate" : "Activate"}
                  onClick={() => { setMenuOpen(false); onToggleActive(); }}
                />
                {!pipeline.isDefault && (
                  <MenuButton icon={Trash2} label="Delete" destructive onClick={() => { setMenuOpen(false); onDelete(); }} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, destructive }: { icon: any; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      data-testid={`menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 10px",
        fontSize: "13px",
        color: destructive ? "#EF4444" : "var(--text-secondary)",
        backgroundColor: "transparent",
        border: "none",
        cursor: "pointer",
        borderRadius: "4px",
        textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = destructive ? "#FEE2E2" : "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <Icon size={14} strokeWidth={1.8} />
      {label}
    </button>
  );
}

function PipelineStageEditor({
  pipeline,
  showNewStageForm,
  setShowNewStageForm,
  editingStageId,
  setEditingStageId,
  stageMenuOpen,
  setStageMenuOpen,
  onCreateStage,
  onUpdateStage,
  onDeleteStage,
  isCreating,
  isUpdating,
  dragIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  pipeline: PipelineData;
  showNewStageForm: boolean;
  setShowNewStageForm: (v: boolean) => void;
  editingStageId: string | null;
  setEditingStageId: (v: string | null) => void;
  stageMenuOpen: string | null;
  setStageMenuOpen: (v: string | null) => void;
  onCreateStage: (data: { name: string; color: string; isWon?: boolean; isLost?: boolean }) => void;
  onUpdateStage: (data: { id: string; name?: string; color?: string; rottingEnabled?: boolean; rottingValue?: number | null; rottingUnit?: string | null }) => void;
  onDeleteStage: (stage: StageData) => void;
  isCreating: boolean;
  isUpdating: boolean;
  dragIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
}) {
  const regularStages = pipeline.stages.filter((s) => !s.isWon && !s.isLost);
  const wonStage = pipeline.stages.find((s) => s.isWon);
  const lostStage = pipeline.stages.find((s) => s.isLost);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>{pipeline.name}</h2>
          {pipeline.description && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{pipeline.description}</p>
          )}
        </div>
        <button
          data-testid="button-add-stage"
          onClick={() => { setShowNewStageForm(true); setEditingStageId(null); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: "var(--brand-primary)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          <Plus size={14} />
          Add Stage
        </button>
      </div>

      <div style={{ backgroundColor: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-default)", overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            Active Stages
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
            ({regularStages.length})
          </span>
        </div>

        {regularStages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            isEditing={editingStageId === stage.id}
            menuOpen={stageMenuOpen === stage.id}
            onStartEdit={() => { setEditingStageId(stage.id); setStageMenuOpen(null); }}
            onCancelEdit={() => setEditingStageId(null)}
            onSave={(data) => onUpdateStage({ id: stage.id, ...data })}
            onToggleMenu={() => setStageMenuOpen(stageMenuOpen === stage.id ? null : stage.id)}
            onCloseMenu={() => setStageMenuOpen(null)}
            onDelete={() => { setStageMenuOpen(null); onDeleteStage(stage); }}
            isUpdating={isUpdating}
            isDraggable
            isDragOver={dragOverIndex === index}
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={() => onDrop(index)}
            onDragEnd={onDragEnd}
          />
        ))}

        {showNewStageForm && (
          <NewStageRow
            onSave={onCreateStage}
            onCancel={() => setShowNewStageForm(false)}
            isPending={isCreating}
          />
        )}

        {(wonStage || lostStage) && (
          <>
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                Closed Stages
              </span>
            </div>
            {wonStage && (
              <StageRow
                stage={wonStage}
                index={-1}
                isEditing={editingStageId === wonStage.id}
                menuOpen={stageMenuOpen === wonStage.id}
                onStartEdit={() => { setEditingStageId(wonStage.id); setStageMenuOpen(null); }}
                onCancelEdit={() => setEditingStageId(null)}
                onSave={(data) => onUpdateStage({ id: wonStage.id, ...data })}
                onToggleMenu={() => setStageMenuOpen(stageMenuOpen === wonStage.id ? null : wonStage.id)}
                onCloseMenu={() => setStageMenuOpen(null)}
                onDelete={() => { setStageMenuOpen(null); onDeleteStage(wonStage); }}
                isUpdating={isUpdating}
              />
            )}
            {lostStage && (
              <StageRow
                stage={lostStage}
                index={-1}
                isEditing={editingStageId === lostStage.id}
                menuOpen={stageMenuOpen === lostStage.id}
                onStartEdit={() => { setEditingStageId(lostStage.id); setStageMenuOpen(null); }}
                onCancelEdit={() => setEditingStageId(null)}
                onSave={(data) => onUpdateStage({ id: lostStage.id, ...data })}
                onToggleMenu={() => setStageMenuOpen(stageMenuOpen === lostStage.id ? null : lostStage.id)}
                onCloseMenu={() => setStageMenuOpen(null)}
                onDelete={() => { setStageMenuOpen(null); onDeleteStage(lostStage); }}
                isUpdating={isUpdating}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StageRow({
  stage,
  index,
  isEditing,
  menuOpen,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggleMenu,
  onCloseMenu,
  onDelete,
  isUpdating,
  isDraggable,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  stage: StageData;
  index: number;
  isEditing: boolean;
  menuOpen: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: { name?: string; color?: string; rottingEnabled?: boolean; rottingValue?: number | null; rottingUnit?: string | null }) => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDraggable?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  const [editName, setEditName] = useState(stage.name);
  const [editColor, setEditColor] = useState(stage.color || "#6B7280");
  const [editRottingEnabled, setEditRottingEnabled] = useState(stage.rottingEnabled);
  const [editRottingValue, setEditRottingValue] = useState<string>(stage.rottingValue?.toString() || "7");
  const [editRottingUnit, setEditRottingUnit] = useState(stage.rottingUnit || "DAYS");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColorPicker]);

  useEffect(() => {
    setEditName(stage.name);
    setEditColor(stage.color || "#6B7280");
    setEditRottingEnabled(stage.rottingEnabled);
    setEditRottingValue(stage.rottingValue?.toString() || "7");
    setEditRottingUnit(stage.rottingUnit || "DAYS");
  }, [stage, isEditing]);

  const handleSave = () => {
    const data: any = {};
    if (editName.trim() !== stage.name) data.name = editName.trim();
    if (editColor !== stage.color) data.color = editColor;
    if (editRottingEnabled !== stage.rottingEnabled) data.rottingEnabled = editRottingEnabled;
    if (editRottingEnabled) {
      const val = parseInt(editRottingValue) || 7;
      if (val !== stage.rottingValue) data.rottingValue = val;
      if (editRottingUnit !== stage.rottingUnit) data.rottingUnit = editRottingUnit;
    } else {
      data.rottingValue = null;
      data.rottingUnit = null;
    }
    if (Object.keys(data).length > 0) {
      onSave(data);
    } else {
      onCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-default)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div ref={colorRef} style={{ position: "relative" }}>
            <button
              data-testid="button-stage-color"
              onClick={() => setShowColorPicker(!showColorPicker)}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                backgroundColor: editColor,
                border: "2px solid rgba(0,0,0,0.1)",
                cursor: "pointer",
              }}
            />
            {showColorPicker && (
              <div style={{
                position: "absolute",
                left: 0,
                top: "100%",
                marginTop: "4px",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
                padding: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 50,
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: "4px",
              }}>
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    data-testid={`color-${c.name.toLowerCase()}`}
                    onClick={() => { setEditColor(c.hex); setShowColorPicker(false); }}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      backgroundColor: c.hex,
                      border: editColor === c.hex ? "2px solid var(--text-primary)" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>

          <input
            data-testid="input-stage-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancelEdit(); }}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: "13px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              outline: "none",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
            placeholder="Stage name"
          />
        </div>

        {!stage.isWon && !stage.isLost && (
          <div style={{ marginBottom: "12px", padding: "10px 12px", backgroundColor: "var(--bg-primary)", borderRadius: "6px", border: "1px solid var(--border-default)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: editRottingEnabled ? "10px" : "0" }}>
              <Clock size={14} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", flex: 1 }}>Deal Rotting</span>
              <ToggleSwitch
                checked={editRottingEnabled}
                onChange={setEditRottingEnabled}
                testId="toggle-rotting"
              />
            </div>

            {editRottingEnabled && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Alert after</span>
                <input
                  data-testid="input-rotting-value"
                  type="number"
                  min="1"
                  value={editRottingValue}
                  onChange={(e) => setEditRottingValue(e.target.value)}
                  style={{
                    width: "60px",
                    padding: "4px 8px",
                    fontSize: "13px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "4px",
                    outline: "none",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    textAlign: "center",
                  }}
                />
                <select
                  data-testid="select-rotting-unit"
                  value={editRottingUnit}
                  onChange={(e) => setEditRottingUnit(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "13px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "4px",
                    outline: "none",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <option value="HOURS">hours</option>
                  <option value="DAYS">days</option>
                  <option value="WEEKS">weeks</option>
                  <option value="MONTHS">months</option>
                </select>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>of inactivity</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            data-testid="button-cancel-edit-stage"
            onClick={onCancelEdit}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
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
            data-testid="button-save-stage"
            onClick={handleSave}
            disabled={!editName.trim() || isUpdating}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              opacity: !editName.trim() || isUpdating ? 0.5 : 1,
            }}
          >
            {isUpdating ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`stage-row-${stage.id}`}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-default)",
        backgroundColor: isDragOver ? "rgba(16,185,129,0.04)" : "transparent",
        borderTop: isDragOver ? "2px solid var(--brand-primary)" : "2px solid transparent",
        transition: "background-color 120ms ease",
        cursor: isDraggable ? "grab" : "default",
      }}
      onMouseEnter={(e) => { if (!isDragOver) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { if (!isDragOver) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {isDraggable && (
        <GripVertical size={14} style={{ color: "var(--text-muted)", flexShrink: 0, cursor: "grab" }} />
      )}

      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "3px",
          backgroundColor: stage.color || "#6B7280",
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
          {stage.name}
        </span>
        {stage.isWon && <Trophy size={13} style={{ color: "#10B981" }} />}
        {stage.isLost && <XCircle size={13} style={{ color: "#EF4444" }} />}
        {stage.rottingEnabled && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", padding: "1px 6px", borderRadius: "3px" }}>
            <Clock size={10} />
            {stage.rottingValue} {stage.rottingUnit?.toLowerCase()}
          </span>
        )}
      </div>

      <span style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>
        {stage.dealCount} deal{stage.dealCount !== 1 ? "s" : ""}
      </span>

      <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          data-testid={`button-stage-menu-${stage.id}`}
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
            color: "var(--text-muted)",
            display: "flex",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: "4px",
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 50,
            minWidth: "140px",
            padding: "4px",
          }}>
            <MenuButton icon={Pencil} label="Edit" onClick={onStartEdit} />
            <MenuButton icon={Trash2} label="Delete" destructive onClick={onDelete} />
          </div>
        )}
      </div>
    </div>
  );
}

function NewStageRow({ onSave, onCancel, isPending }: {
  onSave: (data: { name: string; color: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColorPicker]);

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div ref={colorRef} style={{ position: "relative" }}>
          <button
            data-testid="button-new-stage-color"
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              backgroundColor: color,
              border: "2px solid rgba(0,0,0,0.1)",
              cursor: "pointer",
            }}
          />
          {showColorPicker && (
            <div style={{
              position: "absolute",
              left: 0,
              top: "100%",
              marginTop: "4px",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              padding: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              zIndex: 50,
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "4px",
            }}>
              {STAGE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => { setColor(c.hex); setShowColorPicker(false); }}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "4px",
                    backgroundColor: c.hex,
                    border: color === c.hex ? "2px solid var(--text-primary)" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                  title={c.name}
                />
              ))}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          data-testid="input-new-stage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave({ name: name.trim(), color });
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Stage name"
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: "13px",
            border: "1px solid var(--border-default)",
            borderRadius: "6px",
            outline: "none",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />

        <button
          data-testid="button-save-new-stage"
          onClick={() => { if (name.trim()) onSave({ name: name.trim(), color }); }}
          disabled={!name.trim() || isPending}
          style={{
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: "var(--brand-primary)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            opacity: !name.trim() || isPending ? 0.5 : 1,
          }}
        >
          {isPending ? "Adding..." : "Add"}
        </button>
        <button
          data-testid="button-cancel-new-stage"
          onClick={onCancel}
          style={{
            padding: "6px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button
      data-testid={testId}
      onClick={() => onChange(!checked)}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        backgroundColor: checked ? "var(--brand-primary)" : "var(--border-default)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background-color 150ms ease",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          backgroundColor: "#fff",
          position: "absolute",
          top: "2px",
          left: checked ? "18px" : "2px",
          transition: "left 150ms ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

function NewPipelineModal({ onClose, onCreate, isPending, error }: {
  onClose: () => void;
  onCreate: (data: { name: string; description?: string }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "420px",
          padding: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          Create Pipeline
        </h3>

        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
            Name
          </label>
          <input
            ref={inputRef}
            data-testid="input-new-pipeline-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onCreate({ name: name.trim(), description: description.trim() || undefined }); }}
            placeholder="e.g. Body Contouring"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              outline: "none",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
            Description (optional)
          </label>
          <input
            data-testid="input-new-pipeline-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this pipeline"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              outline: "none",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "6px", backgroundColor: "#FEE2E2", fontSize: "13px", color: "#DC2626" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            data-testid="button-cancel-pipeline"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
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
            data-testid="button-create-pipeline"
            onClick={() => { if (name.trim()) onCreate({ name: name.trim(), description: description.trim() || undefined }); }}
            disabled={!name.trim() || isPending}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              opacity: !name.trim() || isPending ? 0.5 : 1,
            }}
          >
            {isPending ? "Creating..." : "Create Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, isDestructive, isPending, error, disabled, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  isDestructive?: boolean;
  isPending: boolean;
  error: string | null;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
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
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          width: "400px",
          padding: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          {isDestructive && <AlertTriangle size={18} style={{ color: "#EF4444" }} />}
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "16px" }}>
          {message}
        </p>

        {error && (
          <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "6px", backgroundColor: "#FEE2E2", fontSize: "13px", color: "#DC2626" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            data-testid="button-confirm-cancel"
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
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
            disabled={isPending || disabled}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: isDestructive ? "#EF4444" : "var(--brand-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              opacity: isPending || disabled ? 0.5 : 1,
            }}
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
