"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  GripVertical,
  Check,
  X,
  BookOpen,
} from "lucide-react";

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  status: "ACTIVE" | "ARCHIVED";
  children: CategoryNode[];
  itemCount?: number;
}

export default function IncomeCategoriesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingAt, setAddingAt] = useState<string | null | "root">(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmArchive, setConfirmArchive] = useState<CategoryNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CategoryNode | null>(null);
  const [confirmPlaybook, setConfirmPlaybook] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (addingAt !== null && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [addingAt]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const { data: categories = [], isLoading } = useQuery<CategoryNode[]>({
    queryKey: ["/api/settings/income-categories", { includeArchived: showArchived }],
    queryFn: async () => {
      const res = await fetch(`/api/settings/income-categories?includeArchived=${showArchived}`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId: string | null }) => {
      const res = await fetch("/api/settings/income-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create category");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/income-categories"] });
      setAddingAt(null);
      setNewName("");
      if (variables.parentId) {
        setExpandedIds((prev) => new Set(prev).add(variables.parentId!));
      }
      setToast({ message: "Category created", type: "success" });
    },
    onError: (err: Error) => {
      setToast({ message: err.message, type: "error" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/settings/income-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/income-categories"] });
      setEditingId(null);
      setEditName("");
      setToast({ message: "Category renamed", type: "success" });
    },
    onError: (err: Error) => {
      setToast({ message: err.message, type: "error" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/income-categories/${id}/archive`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to archive");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/income-categories"] });
      setConfirmArchive(null);
      setToast({ message: "Category archived", type: "success" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/income-categories/${id}/restore`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to restore");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/income-categories"] });
      setToast({ message: "Category restored", type: "success" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/income-categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/income-categories"] });
      setConfirmDelete(null);
      setToast({ message: "Category deleted", type: "success" });
    },
    onError: (err: Error) => {
      setToast({ message: err.message, type: "error" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch("/api/settings/income-categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/income-categories"] });
    },
  });

  const playbookMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/income-categories/load-playbook", { method: "POST" });
      if (!res.ok) throw new Error("Failed to load template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/income-categories"] });
      setConfirmPlaybook(false);
      setToast({ message: "Playbook template loaded", type: "success" });
      setExpandedIds(new Set());
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSubmit = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddingAt(null);
      setNewName("");
      return;
    }
    const parentId = addingAt === "root" ? null : (addingAt as string);
    createMutation.mutate({ name: trimmed, parentId });
  };

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (!trimmed || !editingId) {
      setEditingId(null);
      setEditName("");
      return;
    }
    renameMutation.mutate({ id: editingId, name: trimmed });
  };

  const handleArchiveClick = (node: CategoryNode) => {
    const childCount = countDescendants(node);
    const itemCount = node.itemCount || 0;
    if (childCount === 0 && itemCount === 0) {
      archiveMutation.mutate(node.id);
    } else {
      setConfirmArchive(node);
    }
  };

  const countDescendants = (node: CategoryNode): number => {
    let count = node.children.length;
    for (const child of node.children) {
      count += countDescendants(child);
    }
    return count;
  };

  const getSiblings = useCallback(
    (nodeId: string, tree: CategoryNode[]): CategoryNode[] => {
      for (const cat of tree) {
        if (cat.children.some((c) => c.id === nodeId)) {
          return cat.children;
        }
        const found = getSiblings(nodeId, cat.children);
        if (found.length > 0) return found;
      }
      if (tree.some((c) => c.id === nodeId)) return tree;
      return [];
    },
    []
  );

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragId && dragId !== id) {
      const siblings = getSiblings(id, categories);
      const dragSiblings = getSiblings(dragId, categories);
      if (siblings.length > 0 && dragSiblings.length > 0 && siblings === dragSiblings) {
        setDragOverId(id);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const siblings = getSiblings(targetId, categories);
    const dragSiblings = getSiblings(dragId, categories);
    if (siblings !== dragSiblings) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const ids = siblings.map((s) => s.id);
    const fromIndex = ids.indexOf(dragId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, dragId);
    reorderMutation.mutate(ids);
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  const renderNode = (node: CategoryNode, depth: number) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const isArchived = node.status === "ARCHIVED";
    const isEditing = editingId === node.id;
    const isTopLevel = depth === 0;
    const isDragOver = dragOverId === node.id;

    return (
      <div key={node.id} data-testid={`category-node-${node.id}`}>
        <div
          draggable={!isEditing && !isArchived}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDrop={(e) => handleDrop(e, node.id)}
          onDragEnd={handleDragEnd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            paddingLeft: `${12 + depth * 24}px`,
            borderRadius: "6px",
            backgroundColor: isDragOver
              ? "rgba(16, 185, 129, 0.08)"
              : "transparent",
            opacity: isArchived ? 0.5 : 1,
            transition: "background-color 120ms ease",
            cursor: isEditing ? "default" : "grab",
          }}
          onMouseEnter={(e) => {
            if (!isDragOver) {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-tertiary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragOver) {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }
          }}
        >
          <div
            style={{
              width: "16px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!isEditing && !isArchived && (
              <GripVertical
                size={14}
                style={{ color: "var(--text-muted)", cursor: "grab" }}
                data-testid={`drag-handle-${node.id}`}
              />
            )}
          </div>

          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: hasChildren ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              width: "16px",
              flexShrink: 0,
            }}
            data-testid={`expand-toggle-${node.id}`}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
              ) : (
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
              )
            ) : (
              <span style={{ width: 14 }} />
            )}
          </button>

          {isEditing ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
              <input
                ref={editInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") {
                    setEditingId(null);
                    setEditName("");
                  }
                }}
                data-testid={`rename-input-${node.id}`}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  fontSize: "13px",
                  border: "1px solid var(--brand-primary)",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleRenameSubmit}
                data-testid={`rename-confirm-${node.id}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  color: "var(--brand-primary)",
                }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditName("");
                }}
                data-testid={`rename-cancel-${node.id}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  color: "var(--text-muted)",
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <span
                style={{
                  flex: 1,
                  fontSize: "13px",
                  fontWeight: isTopLevel ? 600 : 400,
                  color: isArchived ? "var(--text-muted)" : "var(--text-primary)",
                }}
              >
                {node.name}
              </span>

              {(node.itemCount ?? 0) > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                  data-testid={`item-count-${node.id}`}
                >
                  {node.itemCount} item{node.itemCount !== 1 ? "s" : ""}
                </span>
              )}

              {isArchived && (
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(107, 114, 128, 0.15)",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  Archived
                </span>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  flexShrink: 0,
                }}
                className="action-buttons"
              >
                {!isArchived && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingAt(node.id);
                        setNewName("");
                        setExpandedIds((prev) => new Set(prev).add(node.id));
                      }}
                      title="Add child category"
                      data-testid={`add-child-${node.id}`}
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
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--brand-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                      }}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(node.id);
                        setEditName(node.name);
                      }}
                      title="Rename"
                      data-testid={`edit-category-${node.id}`}
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
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveClick(node);
                      }}
                      title="Archive"
                      data-testid={`archive-category-${node.id}`}
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
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "#F59E0B";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                      }}
                    >
                      <Archive size={13} />
                    </button>
                  </>
                )}
                {isArchived && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreMutation.mutate(node.id);
                      }}
                      title="Restore"
                      data-testid={`restore-category-${node.id}`}
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
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--brand-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                      }}
                    >
                      <RotateCcw size={13} />
                    </button>
                    {node.children.length === 0 && (node.itemCount ?? 0) === 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(node);
                        }}
                        title="Delete permanently"
                        data-testid={`delete-category-${node.id}`}
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
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color = "#EF4444";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}

        {addingAt === node.id && isExpanded && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              paddingLeft: `${12 + (depth + 1) * 24}px`,
            }}
          >
            <span style={{ width: "16px" }} />
            <span style={{ width: "16px" }} />
            <input
              ref={addInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSubmit();
                if (e.key === "Escape") {
                  setAddingAt(null);
                  setNewName("");
                }
              }}
              placeholder="Category name..."
              data-testid="add-child-input"
              style={{
                flex: 1,
                padding: "4px 8px",
                fontSize: "13px",
                border: "1px solid var(--brand-primary)",
                borderRadius: "4px",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            <button
              onClick={handleAddSubmit}
              data-testid="add-child-confirm"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: "var(--brand-primary)",
              }}
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setAddingAt(null);
                setNewName("");
              }}
              data-testid="add-child-cancel"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: "var(--text-muted)",
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid var(--border-default)",
            borderTopColor: "var(--brand-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading categories...</span>
      </div>
    );
  }

  const isEmpty = categories.length === 0;

  return (
    <div style={{ maxWidth: "720px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0,
            }}
            data-testid="page-title"
          >
            Income Categories
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginTop: "4px",
              lineHeight: 1.5,
            }}
          >
            Organize your services into categories for financial reporting. Think of these as your
            chart of accounts — the more accurately you categorize, the more useful your reports
            will be.
          </p>
        </div>
        {!isEmpty && (
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "24px" }}>
            <button
              onClick={() => setConfirmPlaybook(true)}
              data-testid="load-playbook-button"
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-primary)";
                (e.currentTarget as HTMLElement).style.color = "var(--brand-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
            >
              <BookOpen size={14} />
              Load Playbook Template
            </button>
            <button
              onClick={() => {
                setAddingAt("root");
                setNewName("");
              }}
              data-testid="add-category-button"
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--brand-primary)",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
              }}
            >
              <Plus size={14} />
              Add Category
            </button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div
          style={{
            padding: "60px 40px",
            textAlign: "center",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-default)",
          }}
          data-testid="empty-state"
        >
          <FolderTree
            size={40}
            strokeWidth={1.2}
            style={{ color: "var(--text-muted)", margin: "0 auto 16px" }}
          />
          <h3
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 8px",
            }}
          >
            No income categories yet
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              margin: "0 0 24px",
              maxWidth: "400px",
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.5,
            }}
          >
            Set up your chart of accounts to enable financial reporting. You can build your own
            structure or load our recommended template for aesthetic practices.
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button
              onClick={() => setConfirmPlaybook(true)}
              data-testid="empty-load-playbook"
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <BookOpen size={14} />
              Load Playbook Template
            </button>
            <button
              onClick={() => {
                setAddingAt("root");
                setNewName("");
              }}
              data-testid="empty-add-category"
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--brand-primary)",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Plus size={14} />
              Add Category
            </button>
          </div>

          {addingAt === "root" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                maxWidth: "400px",
                margin: "16px auto 0",
              }}
            >
              <input
                ref={addInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSubmit();
                  if (e.key === "Escape") {
                    setAddingAt(null);
                    setNewName("");
                  }
                }}
                placeholder="Category name..."
                data-testid="add-root-input"
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: "13px",
                  border: "1px solid var(--brand-primary)",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleAddSubmit}
                data-testid="add-root-confirm"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  color: "var(--brand-primary)",
                }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => {
                  setAddingAt(null);
                  setNewName("");
                }}
                data-testid="add-root-cancel"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  color: "var(--text-muted)",
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "12px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
              data-testid="show-archived-toggle"
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

          <div
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: "10px",
              border: "1px solid var(--border-default)",
              padding: "8px 0",
            }}
            data-testid="category-tree"
          >
            {categories.map((node) => renderNode(node, 0))}

            {addingAt === "root" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                }}
              >
                <span style={{ width: "16px" }} />
                <span style={{ width: "16px" }} />
                <input
                  ref={addInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSubmit();
                    if (e.key === "Escape") {
                      setAddingAt(null);
                      setNewName("");
                    }
                  }}
                  placeholder="Category name..."
                  data-testid="add-root-input"
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    fontSize: "13px",
                    border: "1px solid var(--brand-primary)",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleAddSubmit}
                  data-testid="add-root-confirm"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    color: "var(--brand-primary)",
                  }}
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => {
                    setAddingAt(null);
                    setNewName("");
                  }}
                  data-testid="add-root-cancel"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    color: "var(--text-muted)",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {confirmArchive && (
        <ConfirmModal
          title="Archive Category"
          message={`Archiving "${confirmArchive.name}" will also archive all subcategories${(confirmArchive.itemCount ?? 0) > 0 ? ` and unassign ${confirmArchive.itemCount} products/services from this category. They can be reassigned after.` : "."} Continue?`}
          confirmLabel="Archive"
          confirmColor="#F59E0B"
          onConfirm={() => archiveMutation.mutate(confirmArchive.id)}
          onCancel={() => setConfirmArchive(null)}
          loading={archiveMutation.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete Category"
          message={`Are you sure you want to permanently delete "${confirmDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmColor="#EF4444"
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}

      {confirmPlaybook && (
        <ConfirmModal
          title="Load Playbook Template"
          message="This will load a recommended category structure for aesthetic practices. You can customize it after loading. Any existing categories will not be affected."
          confirmLabel="Load Template"
          confirmColor="var(--brand-primary)"
          onConfirm={() => playbookMutation.mutate()}
          onCancel={() => setConfirmPlaybook(false)}
          loading={playbookMutation.isPending}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            color: "white",
            backgroundColor: toast.type === "success" ? "#10B981" : "#EF4444",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 9999,
            animation: "slideIn 200ms ease",
          }}
          data-testid="toast-message"
        >
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
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
        zIndex: 9998,
      }}
      onClick={onCancel}
      data-testid="confirm-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          padding: "24px",
          maxWidth: "420px",
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        data-testid="confirm-modal"
      >
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 8px",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            margin: "0 0 20px",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            data-testid="confirm-modal-cancel"
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            data-testid="confirm-modal-confirm"
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              backgroundColor: confirmColor,
              color: "white",
              cursor: loading ? "wait" : "pointer",
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
