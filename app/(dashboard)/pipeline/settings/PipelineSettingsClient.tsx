"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  GripVertical,
  Trash2,
  Check,
  X,
  Plus,
  Sparkles,
  Settings2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

interface PipelineOption {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string | null;
  rottingThresholdHours: number;
  isWon: boolean;
  isLost: boolean;
  opportunityCount: number;
}

interface AutomationRule {
  id: string;
  pipelineId: string;
  name: string;
  triggerType: string;
  triggerStageId: string | null;
  actionType: string;
  actionValue: string | null;
  isActive: boolean;
}

const PRESET_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#6366F1", "#F97316", "#EF4444", "#059669", "#2563EB", "#7C3AED", "#6B7280", "#EC4899"];
const TRIGGER_TYPES = ["STAGE_ENTER", "STAGE_EXIT", "ROTTING_THRESHOLD", "TIME_IN_STAGE"];
const ACTION_TYPES = ["SEND_NOTIFICATION", "ASSIGN_USER", "MOVE_STAGE", "CREATE_TASK"];

function formatEnumLabel(val: string) {
  return val
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function ColorPicker({
  currentColor,
  onSelect,
  onClose,
}: {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 50,
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: 8,
        display: "flex",
        gap: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        marginTop: 4,
      }}
    >
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          data-testid={`color-swatch-${c}`}
          onClick={() => onSelect(c)}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: c,
            border: c === currentColor ? "2px solid #111827" : "2px solid transparent",
            cursor: "pointer",
            outline: "none",
          }}
        />
      ))}
    </div>
  );
}

function InlineEdit({
  value,
  onSave,
  type = "text",
  testId,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: "text" | "number";
  testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editing) {
    return (
      <span
        data-testid={testId}
        onClick={() => setEditing(true)}
        style={{
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 4,
          minWidth: type === "number" ? 60 : 100,
          display: "inline-block",
        }}
        className="hover-elevate"
      >
        {value}
      </span>
    );
  }

  function handleSave() {
    if (draft !== value) {
      onSave(draft);
    }
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        ref={inputRef}
        data-testid={`${testId}-input`}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
        onBlur={handleSave}
        style={{
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid #10B981",
          outline: "none",
          fontSize: 14,
          width: type === "number" ? 70 : 140,
        }}
      />
      <button
        data-testid={`${testId}-save`}
        onMouseDown={(e) => {
          e.preventDefault();
          handleSave();
        }}
        style={{ color: "#10B981", cursor: "pointer", background: "none", border: "none", padding: 2 }}
      >
        <Check size={16} />
      </button>
      <button
        data-testid={`${testId}-cancel`}
        onMouseDown={(e) => {
          e.preventDefault();
          handleCancel();
        }}
        style={{ color: "#6B7280", cursor: "pointer", background: "none", border: "none", padding: 2 }}
      >
        <X size={16} />
      </button>
    </span>
  );
}

export default function PipelineSettingsClient() {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [colorPickerStageId, setColorPickerStageId] = useState<string | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleTrigger, setNewRuleTrigger] = useState("STAGE_ENTER");
  const [newRuleAction, setNewRuleAction] = useState("SEND_NOTIFICATION");
  const [newRuleActionValue, setNewRuleActionValue] = useState("");

  const { data: boardData } = useQuery({
    queryKey: ["pipeline-board-for-settings"],
    queryFn: () =>
      fetchJson<{ pipelines: PipelineOption[]; pipeline: { id: string } }>(
        "/api/pipeline/board"
      ),
  });

  useEffect(() => {
    if (boardData?.pipeline?.id && !selectedPipelineId) {
      setSelectedPipelineId(boardData.pipeline.id);
    }
  }, [boardData, selectedPipelineId]);

  const {
    data: stages,
    isLoading: stagesLoading,
  } = useQuery({
    queryKey: ["pipeline-stages", selectedPipelineId],
    queryFn: () =>
      fetchJson<Stage[]>(`/api/pipeline/stages?pipelineId=${selectedPipelineId}`),
    enabled: !!selectedPipelineId,
  });

  const {
    data: rules,
    isLoading: rulesLoading,
  } = useQuery({
    queryKey: ["pipeline-automation-rules", selectedPipelineId],
    queryFn: () =>
      fetchJson<AutomationRule[]>(
        `/api/pipeline/automation-rules?pipelineId=${selectedPipelineId}`
      ),
    enabled: !!selectedPipelineId,
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/pipeline/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages", selectedPipelineId] });
    },
  });

  const addStageMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pipeline/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: selectedPipelineId,
          name: "New Stage",
          color: "#6B7280",
        }),
      });
      if (!res.ok) throw new Error("Failed to add stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages", selectedPipelineId] });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pipeline/stages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages", selectedPipelineId] });
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      triggerType: string;
      actionType: string;
      actionValue?: string;
    }) => {
      const res = await fetch("/api/pipeline/automation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: selectedPipelineId,
          ...data,
        }),
      });
      if (!res.ok) throw new Error("Failed to add rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-automation-rules", selectedPipelineId] });
      setShowAddRule(false);
      setNewRuleName("");
      setNewRuleTrigger("STAGE_ENTER");
      setNewRuleAction("SEND_NOTIFICATION");
      setNewRuleActionValue("");
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/pipeline/automation-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-automation-rules", selectedPipelineId] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pipeline/automation-rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-automation-rules", selectedPipelineId] });
    },
  });

  return (
    <div style={{ background: "#F9FAFB", minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link
            href="/pipeline"
            data-testid="link-back-pipeline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#374151",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            <ArrowLeft size={18} />
            Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <Settings2 size={20} style={{ color: "#10B981" }} />
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#111827",
                margin: 0,
              }}
            >
              Pipeline Settings
            </h1>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <select
              data-testid="select-pipeline"
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #E5E7EB",
                fontSize: 14,
                color: "#374151",
                background: "#fff",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {boardData?.pipelines?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#111827",
              margin: "0 0 16px 0",
            }}
          >
            Pipeline Stages
          </h2>

          {stagesLoading ? (
            <div style={{ color: "#6B7280", padding: 20, textAlign: "center" }}>
              Loading stages...
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 32px 1fr 120px 60px 60px 40px",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #E5E7EB",
                  fontSize: 12,
                  color: "#6B7280",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <span></span>
                <span>Color</span>
                <span>Name</span>
                <span>Rot (hrs)</span>
                <span>Won</span>
                <span>Lost</span>
                <span></span>
              </div>

              {stages?.map((stage) => (
                <div
                  key={stage.id}
                  data-testid={`stage-row-${stage.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 32px 1fr 120px 60px 60px 40px",
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #F3F4F6",
                    fontSize: 14,
                    color: "#374151",
                  }}
                >
                  <span style={{ color: "#9CA3AF", cursor: "grab", display: "flex", justifyContent: "center" }}>
                    <GripVertical size={16} />
                  </span>

                  <span style={{ position: "relative" }}>
                    <button
                      data-testid={`color-picker-trigger-${stage.id}`}
                      onClick={() =>
                        setColorPickerStageId(
                          colorPickerStageId === stage.id ? null : stage.id
                        )
                      }
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: stage.color || "#6B7280",
                        border: "2px solid #E5E7EB",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    />
                    {colorPickerStageId === stage.id && (
                      <ColorPicker
                        currentColor={stage.color || "#6B7280"}
                        onSelect={(color) => {
                          updateStageMutation.mutate({ id: stage.id, color });
                          setColorPickerStageId(null);
                        }}
                        onClose={() => setColorPickerStageId(null)}
                      />
                    )}
                  </span>

                  <InlineEdit
                    testId={`stage-name-${stage.id}`}
                    value={stage.name}
                    onSave={(name) => updateStageMutation.mutate({ id: stage.id, name })}
                  />

                  <InlineEdit
                    testId={`stage-rot-${stage.id}`}
                    value={String(stage.rottingThresholdHours)}
                    type="number"
                    onSave={(val) =>
                      updateStageMutation.mutate({
                        id: stage.id,
                        rottingThresholdHours: parseInt(val, 10),
                      })
                    }
                  />

                  <span style={{ display: "flex", justifyContent: "center" }}>
                    <input
                      data-testid={`stage-won-${stage.id}`}
                      type="checkbox"
                      checked={stage.isWon}
                      onChange={(e) =>
                        updateStageMutation.mutate({
                          id: stage.id,
                          isWon: e.target.checked,
                          isLost: e.target.checked ? false : stage.isLost,
                        })
                      }
                      style={{ width: 16, height: 16, accentColor: "#10B981", cursor: "pointer" }}
                    />
                  </span>

                  <span style={{ display: "flex", justifyContent: "center" }}>
                    <input
                      data-testid={`stage-lost-${stage.id}`}
                      type="checkbox"
                      checked={stage.isLost}
                      onChange={(e) =>
                        updateStageMutation.mutate({
                          id: stage.id,
                          isLost: e.target.checked,
                          isWon: e.target.checked ? false : stage.isWon,
                        })
                      }
                      style={{ width: 16, height: 16, accentColor: "#10B981", cursor: "pointer" }}
                    />
                  </span>

                  <span style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      data-testid={`stage-delete-${stage.id}`}
                      onClick={() => {
                        if (stage.opportunityCount > 0) return;
                        deleteStageMutation.mutate(stage.id);
                      }}
                      disabled={stage.opportunityCount > 0}
                      title={
                        stage.opportunityCount > 0
                          ? `Cannot delete: ${stage.opportunityCount} deals`
                          : "Delete stage"
                      }
                      style={{
                        background: "none",
                        border: "none",
                        cursor: stage.opportunityCount > 0 ? "not-allowed" : "pointer",
                        color: stage.opportunityCount > 0 ? "#D1D5DB" : "#EF4444",
                        padding: 4,
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              ))}

              <button
                data-testid="button-add-stage"
                onClick={() => addStageMutation.mutate()}
                disabled={addStageMutation.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 16,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px dashed #D1D5DB",
                  background: "none",
                  color: "#059669",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                Add Stage
              </button>
            </>
          )}
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <Sparkles size={18} style={{ color: "#F59E0B" }} />
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#111827",
                margin: 0,
              }}
            >
              Automation Rules
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#92400E",
                background: "#FEF3C7",
                padding: "2px 8px",
                borderRadius: 10,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Beta
            </span>
          </div>

          {rulesLoading ? (
            <div style={{ color: "#6B7280", padding: 20, textAlign: "center" }}>
              Loading rules...
            </div>
          ) : (
            <>
              {rules && rules.length === 0 && !showAddRule && (
                <div
                  style={{
                    color: "#6B7280",
                    fontSize: 14,
                    padding: "20px 0",
                    textAlign: "center",
                  }}
                >
                  No automation rules yet. Create one to automate your pipeline.
                </div>
              )}

              {rules?.map((rule) => (
                <div
                  key={rule.id}
                  data-testid={`rule-card-${rule.id}`}
                  style={{
                    background: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {editingRuleId === rule.id ? (
                    <RuleEditForm
                      rule={rule}
                      onSave={(data) => {
                        updateRuleMutation.mutate({ id: rule.id, ...data });
                        setEditingRuleId(null);
                      }}
                      onCancel={() => setEditingRuleId(null)}
                    />
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#111827",
                            fontSize: 14,
                            marginBottom: 4,
                          }}
                          data-testid={`rule-name-${rule.id}`}
                        >
                          {rule.name}
                        </div>
                        <div style={{ color: "#6B7280", fontSize: 13 }}>
                          {formatEnumLabel(rule.triggerType)} → {formatEnumLabel(rule.actionType)}
                        </div>
                      </div>

                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          color: "#6B7280",
                        }}
                      >
                        <input
                          data-testid={`rule-active-toggle-${rule.id}`}
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={(e) =>
                            updateRuleMutation.mutate({
                              id: rule.id,
                              isActive: e.target.checked,
                            })
                          }
                          style={{ width: 16, height: 16, accentColor: "#10B981" }}
                        />
                        Active
                      </label>

                      <button
                        data-testid={`rule-edit-${rule.id}`}
                        onClick={() => setEditingRuleId(rule.id)}
                        style={{
                          background: "none",
                          border: "1px solid #E5E7EB",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 13,
                          color: "#374151",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        data-testid={`rule-delete-${rule.id}`}
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#EF4444",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {showAddRule && (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "#6B7280",
                          marginBottom: 4,
                          fontWeight: 500,
                        }}
                      >
                        Rule Name
                      </label>
                      <input
                        data-testid="input-new-rule-name"
                        type="text"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        placeholder="e.g., Notify on rotting"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #E5E7EB",
                          fontSize: 14,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "#6B7280",
                          marginBottom: 4,
                          fontWeight: 500,
                        }}
                      >
                        Trigger
                      </label>
                      <select
                        data-testid="select-new-rule-trigger"
                        value={newRuleTrigger}
                        onChange={(e) => setNewRuleTrigger(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #E5E7EB",
                          fontSize: 14,
                          background: "#fff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        {TRIGGER_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {formatEnumLabel(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "#6B7280",
                          marginBottom: 4,
                          fontWeight: 500,
                        }}
                      >
                        Action
                      </label>
                      <select
                        data-testid="select-new-rule-action"
                        value={newRuleAction}
                        onChange={(e) => setNewRuleAction(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #E5E7EB",
                          fontSize: 14,
                          background: "#fff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        {ACTION_TYPES.map((a) => (
                          <option key={a} value={a}>
                            {formatEnumLabel(a)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      data-testid="button-cancel-add-rule"
                      onClick={() => {
                        setShowAddRule(false);
                        setNewRuleName("");
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        background: "#fff",
                        color: "#374151",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      data-testid="button-save-new-rule"
                      onClick={() => {
                        if (!newRuleName.trim()) return;
                        addRuleMutation.mutate({
                          name: newRuleName,
                          triggerType: newRuleTrigger,
                          actionType: newRuleAction,
                          actionValue: newRuleActionValue || undefined,
                        });
                      }}
                      disabled={addRuleMutation.isPending || !newRuleName.trim()}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: "#10B981",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        opacity: !newRuleName.trim() ? 0.5 : 1,
                      }}
                    >
                      Save Rule
                    </button>
                  </div>
                </div>
              )}

              <button
                data-testid="button-add-rule"
                onClick={() => setShowAddRule(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px dashed #D1D5DB",
                  background: "none",
                  color: "#059669",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                Add Rule
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RuleEditForm({
  rule,
  onSave,
  onCancel,
}: {
  rule: AutomationRule;
  onSave: (data: { name: string; triggerType: string; actionType: string; actionValue?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule.name);
  const [triggerType, setTriggerType] = useState(rule.triggerType);
  const [actionType, setActionType] = useState(rule.actionType);
  const [actionValue, setActionValue] = useState(rule.actionValue || "");

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 500 }}>
            Rule Name
          </label>
          <input
            data-testid={`edit-rule-name-${rule.id}`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 500 }}>
            Trigger
          </label>
          <select
            data-testid={`edit-rule-trigger-${rule.id}`}
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              background: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          >
            {TRIGGER_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatEnumLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 500 }}>
            Action
          </label>
          <select
            data-testid={`edit-rule-action-${rule.id}`}
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              background: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          >
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {formatEnumLabel(a)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          data-testid={`edit-rule-cancel-${rule.id}`}
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #E5E7EB",
            background: "#fff",
            color: "#374151",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          data-testid={`edit-rule-save-${rule.id}`}
          onClick={() =>
            onSave({
              name,
              triggerType,
              actionType,
              actionValue: actionValue || undefined,
            })
          }
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#10B981",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
