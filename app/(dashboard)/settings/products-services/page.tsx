"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";

type ItemType = "SERVICE_FLAT" | "SERVICE_HOURLY" | "SERVICE_TIERED" | "BUNDLE" | "INVENTORY" | "NON_INVENTORY";

interface IncomeCategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children: IncomeCategoryNode[];
}

interface BundleComponentData {
  id: string;
  itemId: string;
  item: { id: string; name: string; itemType: ItemType };
}

interface ProductServiceItem {
  id: string;
  name: string;
  description: string | null;
  itemType: ItemType;
  price: string | null;
  hourlyRate: string | null;
  tieredBaseRate: string | null;
  tieredSubRate: string | null;
  internalCost: string | null;
  taxable: boolean;
  currentStock: number | null;
  incomeCategoryId: string | null;
  incomeCategory: any | null;
  status: "ACTIVE" | "ARCHIVED";
  bundleComponents: BundleComponentData[];
  bundleMembershipsCount: number;
  createdAt: string;
}

const TYPE_LABELS: Record<ItemType, string> = {
  SERVICE_FLAT: "Service",
  SERVICE_HOURLY: "Hourly Service",
  SERVICE_TIERED: "Tiered Service",
  BUNDLE: "Bundle",
  INVENTORY: "Inventory",
  NON_INVENTORY: "Non-Inventory",
};

const TYPE_COLORS: Record<ItemType, { bg: string; text: string }> = {
  SERVICE_FLAT: { bg: "rgba(59, 130, 246, 0.1)", text: "#3B82F6" },
  SERVICE_HOURLY: { bg: "rgba(139, 92, 246, 0.1)", text: "#8B5CF6" },
  SERVICE_TIERED: { bg: "rgba(236, 72, 153, 0.1)", text: "#EC4899" },
  BUNDLE: { bg: "rgba(16, 185, 129, 0.1)", text: "#10B981" },
  INVENTORY: { bg: "rgba(245, 158, 11, 0.1)", text: "#F59E0B" },
  NON_INVENTORY: { bg: "rgba(107, 114, 128, 0.1)", text: "#6B7280" },
};

const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: "SERVICE_FLAT", label: "Service (Flat Fee)" },
  { value: "SERVICE_HOURLY", label: "Service (Hourly)" },
  { value: "SERVICE_TIERED", label: "Service (Tiered)" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "INVENTORY", label: "Inventory Item" },
  { value: "NON_INVENTORY", label: "Non-Inventory Item" },
];

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getCategoryPath(cat: any): string {
  if (!cat) return "";
  const parts: string[] = [];
  let c = cat;
  while (c) {
    parts.unshift(c.name);
    c = c.parent;
  }
  return parts.join(" › ");
}

function flattenCategories(nodes: IncomeCategoryNode[], prefix = ""): { id: string; path: string }[] {
  const result: { id: string; path: string }[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix} › ${node.name}` : node.name;
    result.push({ id: node.id, path });
    if (node.children?.length) {
      result.push(...flattenCategories(node.children, path));
    }
  }
  return result;
}

export default function ProductsServicesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductServiceItem | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<ProductServiceItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProductServiceItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const { data: items = [], isLoading } = useQuery<ProductServiceItem[]>({
    queryKey: ["/api/settings/products-services", { includeArchived: showArchived }],
    queryFn: async () => {
      const res = await fetch(`/api/settings/products-services?includeArchived=${showArchived}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const groupedItems = useMemo(() => {
    const groups: { key: string; label: string; items: ProductServiceItem[] }[] = [];
    const groupMap = new Map<string, ProductServiceItem[]>();
    const UNCATEGORIZED = "__uncategorized__";

    for (const item of items) {
      const catPath = item.incomeCategory ? getCategoryPath(item.incomeCategory) : UNCATEGORIZED;
      if (!groupMap.has(catPath)) groupMap.set(catPath, []);
      groupMap.get(catPath)!.push(item);
    }

    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      groups.push({
        key,
        label: key === UNCATEGORIZED ? "Uncategorized" : key,
        items: groupMap.get(key)!,
      });
    }
    return groups;
  }, [items]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/products-services/${id}/archive`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to archive");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/products-services"] });
      setConfirmArchive(null);
      setToast({ message: "Item archived", type: "success" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/products-services/${id}/restore`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to restore");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/products-services"] });
      setToast({ message: "Item restored", type: "success" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/products-services/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/products-services"] });
      setConfirmDelete(null);
      setToast({ message: "Item deleted", type: "success" });
    },
    onError: (err: Error) => {
      setToast({ message: err.message, type: "error" });
    },
  });

  const handleArchiveClick = (item: ProductServiceItem) => {
    if (item.bundleMembershipsCount > 0) {
      setConfirmArchive(item);
    } else {
      archiveMutation.mutate(item.id);
    }
  };

  const getPriceDisplay = (item: ProductServiceItem): string => {
    switch (item.itemType) {
      case "SERVICE_FLAT":
      case "INVENTORY":
      case "NON_INVENTORY":
        return formatCurrency(item.price);
      case "SERVICE_HOURLY":
        return item.hourlyRate ? `${formatCurrency(item.hourlyRate)}/hr` : "";
      case "SERVICE_TIERED":
        return "Tiered";
      case "BUNDLE":
        return formatCurrency(item.price);
      default:
        return "";
    }
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
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading items...</span>
      </div>
    );
  }

  const isEmpty = items.length === 0;

  return (
    <div style={{ maxWidth: "960px" }}>
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
            style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}
            data-testid="page-title"
          >
            Products & Services
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.5 }}>
            Build your catalog of billable items. These appear as line items on quotes and invoices.
          </p>
        </div>
        {!isEmpty && (
          <button
            onClick={() => { setEditingItem(null); setModalOpen(true); }}
            data-testid="add-item-button"
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
              flexShrink: 0,
            }}
          >
            <Plus size={14} />
            Add Item
          </button>
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
          <Package
            size={40}
            strokeWidth={1.2}
            style={{ color: "var(--text-muted)", margin: "0 auto 16px" }}
          />
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>
            No products or services yet
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 24px", maxWidth: "400px", marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Build your catalog of billable items. Products and services you create here will be
            available as line items on quotes and invoices.
          </p>
          <button
            onClick={() => { setEditingItem(null); setModalOpen(true); }}
            data-testid="empty-add-item"
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--brand-primary)",
              color: "white",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={14} />
            Add Item
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}
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
              overflow: "hidden",
            }}
            data-testid="items-table"
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Price</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Taxable</th>
                  {showArchived && <th style={thStyle}>Status</th>}
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key);
                  return (
                    <GroupSection
                      key={group.key}
                      groupKey={group.key}
                      label={group.label}
                      count={group.items.length}
                      collapsed={isCollapsed}
                      onToggle={() => toggleGroup(group.key)}
                      colSpan={showArchived ? 6 : 5}
                    >
                      {!isCollapsed && group.items.map((item) => {
                        const isArchived = item.status === "ARCHIVED";
                        return (
                          <tr
                            key={item.id}
                            data-testid={`item-row-${item.id}`}
                            style={{
                              borderBottom: "1px solid var(--border-default)",
                              opacity: isArchived ? 0.5 : 1,
                            }}
                          >
                            <td style={tdStyle}>
                              <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{item.name}</span>
                            </td>
                            <td style={tdStyle}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  backgroundColor: TYPE_COLORS[item.itemType]?.bg,
                                  color: TYPE_COLORS[item.itemType]?.text,
                                }}
                                data-testid={`item-type-${item.id}`}
                              >
                                {TYPE_LABELS[item.itemType]}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ color: "var(--text-primary)" }}>{getPriceDisplay(item)}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <span style={{ color: item.taxable ? "var(--text-primary)" : "var(--text-muted)" }}>
                                {item.taxable ? "Yes" : "No"}
                              </span>
                            </td>
                            {showArchived && (
                              <td style={tdStyle}>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    backgroundColor: isArchived ? "rgba(107,114,128,0.15)" : "rgba(16,185,129,0.1)",
                                    color: isArchived ? "var(--text-muted)" : "#10B981",
                                    fontWeight: 500,
                                  }}
                                >
                                  {isArchived ? "Archived" : "Active"}
                                </span>
                              </td>
                            )}
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "2px", justifyContent: "flex-end" }}>
                                {!isArchived && (
                                  <>
                                    <ActionBtn
                                      icon={<Pencil size={13} />}
                                      title="Edit"
                                      testId={`edit-item-${item.id}`}
                                      hoverColor="var(--text-primary)"
                                      onClick={() => { setEditingItem(item); setModalOpen(true); }}
                                    />
                                    <ActionBtn
                                      icon={<Archive size={13} />}
                                      title="Archive"
                                      testId={`archive-item-${item.id}`}
                                      hoverColor="#F59E0B"
                                      onClick={() => handleArchiveClick(item)}
                                    />
                                  </>
                                )}
                                {isArchived && (
                                  <>
                                    <ActionBtn
                                      icon={<RotateCcw size={13} />}
                                      title="Restore"
                                      testId={`restore-item-${item.id}`}
                                      hoverColor="var(--brand-primary)"
                                      onClick={() => restoreMutation.mutate(item.id)}
                                    />
                                    <ActionBtn
                                      icon={<Trash2 size={13} />}
                                      title="Delete"
                                      testId={`delete-item-${item.id}`}
                                      hoverColor="#EF4444"
                                      onClick={() => setConfirmDelete(item)}
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </GroupSection>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOpen && (
        <ItemModal
          item={editingItem}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          onSuccess={(msg) => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/products-services"] });
            setModalOpen(false);
            setEditingItem(null);
            setToast({ message: msg, type: "success" });
          }}
          onError={(msg) => setToast({ message: msg, type: "error" })}
          allItems={items}
        />
      )}

      {confirmArchive && (
        <ConfirmModal
          title="Archive Item"
          message={
            confirmArchive.bundleMembershipsCount > 0
              ? `This item is a component of ${confirmArchive.bundleMembershipsCount} bundle(s). Archiving it will remove it from those bundles. Continue?`
              : `Are you sure you want to archive "${confirmArchive.name}"?`
          }
          confirmLabel="Archive"
          confirmColor="#F59E0B"
          onConfirm={() => archiveMutation.mutate(confirmArchive.id)}
          onCancel={() => setConfirmArchive(null)}
          loading={archiveMutation.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete Item"
          message={`Are you sure you want to permanently delete "${confirmDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmColor="#EF4444"
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
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
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  color: "var(--text-secondary)",
};

function GroupSection({
  groupKey,
  label,
  count,
  collapsed,
  onToggle,
  colSpan,
  children,
}: {
  groupKey: string;
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  colSpan: number;
  children: React.ReactNode;
}) {
  const isUncategorized = groupKey === "__uncategorized__";
  return (
    <>
      <tr
        data-testid={`group-header-${groupKey}`}
        style={{
          borderBottom: "1px solid var(--border-default)",
          backgroundColor: "var(--bg-secondary)",
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <td colSpan={colSpan} style={{ padding: "8px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {collapsed ? (
              <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            ) : (
              <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            )}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: isUncategorized ? "var(--text-muted)" : "var(--text-primary)",
                fontStyle: isUncategorized ? "italic" : "normal",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                fontWeight: 400,
              }}
            >
              ({count})
            </span>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

function ActionBtn({ icon, title, testId, hoverColor, onClick }: {
  icon: React.ReactNode;
  title: string;
  testId: string;
  hoverColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testId}
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
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = hoverColor; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
    >
      {icon}
    </button>
  );
}

function ItemModal({
  item,
  onClose,
  onSuccess,
  onError,
  allItems,
}: {
  item: ProductServiceItem | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  allItems: ProductServiceItem[];
}) {
  const isEdit = !!item;

  const [name, setName] = useState(item?.name || "");
  const [itemType, setItemType] = useState<ItemType>(item?.itemType || "SERVICE_FLAT");
  const [description, setDescription] = useState(item?.description || "");
  const [price, setPrice] = useState(item?.price?.toString() || "");
  const [hourlyRate, setHourlyRate] = useState(item?.hourlyRate?.toString() || "");
  const [tieredBaseRate, setTieredBaseRate] = useState(item?.tieredBaseRate?.toString() || "");
  const [tieredSubRate, setTieredSubRate] = useState(item?.tieredSubRate?.toString() || "");
  const [internalCost, setInternalCost] = useState(item?.internalCost?.toString() || "");
  const [taxable, setTaxable] = useState(item?.taxable || false);
  const [currentStock, setCurrentStock] = useState(item?.currentStock?.toString() || "");
  const [incomeCategoryId, setIncomeCategoryId] = useState(item?.incomeCategoryId || "");
  const [componentIds, setComponentIds] = useState<string[]>(
    item?.bundleComponents?.map((c) => c.itemId) || []
  );
  const [saving, setSaving] = useState(false);
  const [tieredHoursPreview, setTieredHoursPreview] = useState("3");
  const prevItemType = useRef(itemType);

  useEffect(() => {
    if (prevItemType.current !== itemType && !isEdit) {
      setPrice("");
      setHourlyRate("");
      setTieredBaseRate("");
      setTieredSubRate("");
      setCurrentStock("");
      setComponentIds([]);
    }
    prevItemType.current = itemType;
  }, [itemType, isEdit]);

  const { data: categories = [] } = useQuery<IncomeCategoryNode[]>({
    queryKey: ["/api/settings/income-categories"],
    queryFn: async () => {
      const res = await fetch("/api/settings/income-categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  const availableComponents = useMemo(
    () => allItems.filter((i) => i.status === "ACTIVE" && i.itemType !== "BUNDLE" && i.id !== item?.id),
    [allItems, item]
  );

  const computeTieredPreview = () => {
    const base = parseFloat(tieredBaseRate);
    const sub = parseFloat(tieredSubRate);
    const hours = parseFloat(tieredHoursPreview);
    if (isNaN(base) || isNaN(sub) || isNaN(hours) || hours <= 0) return null;
    const total = hours <= 1 ? base : base + sub * (hours - 1);
    if (hours <= 1) return `${hours} hour = ${formatCurrency(total)}`;
    return `${hours} hours = ${formatCurrency(base)} + (${formatCurrency(sub)} × ${hours - 1}) = ${formatCurrency(total)}`;
  };

  const handleSubmit = async () => {
    if (!name.trim()) { onError("Item name is required"); return; }
    if (name.trim().length > 64) { onError("Item name must be 64 characters or fewer"); return; }

    const body: any = {
      name: name.trim(),
      itemType,
      description: description.trim() || null,
      incomeCategoryId: incomeCategoryId || null,
      taxable,
      internalCost: internalCost ? parseFloat(internalCost) : null,
    };

    switch (itemType) {
      case "SERVICE_FLAT":
      case "INVENTORY":
      case "NON_INVENTORY":
        if (!price) { onError("Price is required"); return; }
        body.price = parseFloat(price);
        break;
      case "SERVICE_HOURLY":
        if (!hourlyRate) { onError("Hourly rate is required"); return; }
        body.hourlyRate = parseFloat(hourlyRate);
        break;
      case "SERVICE_TIERED":
        if (!tieredBaseRate || !tieredSubRate) { onError("Both base rate and subsequent rate are required"); return; }
        body.tieredBaseRate = parseFloat(tieredBaseRate);
        body.tieredSubRate = parseFloat(tieredSubRate);
        break;
      case "BUNDLE":
        if (!price) { onError("Bundle price is required"); return; }
        if (componentIds.length < 2) { onError("Bundles require at least 2 components"); return; }
        body.price = parseFloat(price);
        body.componentIds = componentIds;
        break;
    }

    if (itemType === "INVENTORY" && currentStock) {
      body.currentStock = parseInt(currentStock);
    }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/settings/products-services/${item.id}`
        : "/api/settings/products-services";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      onSuccess(isEdit ? "Item updated" : "Item created");
    } catch (err: any) {
      onError(err.message);
    } finally {
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
        zIndex: 9998,
      }}
      onClick={onClose}
      data-testid="item-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "10px",
          padding: "24px",
          maxWidth: "560px",
          width: "95%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        data-testid="item-modal"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {isEdit ? "Edit Item" : "Add Item"}
          </h2>
          <button
            onClick={onClose}
            data-testid="modal-close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <FieldGroup label="Item Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="e.g., Botox Treatment"
              data-testid="input-item-name"
              style={inputStyle}
            />
          </FieldGroup>

          <FieldGroup label="Item Type" required>
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as ItemType)}
              data-testid="select-item-type"
              style={inputStyle}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Internal notes, payment info, or anything staff needs to know..."
              data-testid="input-description"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </FieldGroup>

          {(itemType === "SERVICE_FLAT" || itemType === "INVENTORY" || itemType === "NON_INVENTORY") && (
            <FieldGroup label="Price" required>
              <CurrencyInput value={price} onChange={setPrice} testId="input-price" />
            </FieldGroup>
          )}

          {itemType === "SERVICE_HOURLY" && (
            <FieldGroup label="Hourly Rate" required>
              <CurrencyInput value={hourlyRate} onChange={setHourlyRate} testId="input-hourly-rate" />
            </FieldGroup>
          )}

          {itemType === "SERVICE_TIERED" && (
            <>
              <div style={{ display: "flex", gap: "12px" }}>
                <FieldGroup label="Base Rate (First Hour)" required style={{ flex: 1 }}>
                  <CurrencyInput value={tieredBaseRate} onChange={setTieredBaseRate} testId="input-tiered-base" />
                </FieldGroup>
                <FieldGroup label="Subsequent Rate (Per Hour)" required style={{ flex: 1 }}>
                  <CurrencyInput value={tieredSubRate} onChange={setTieredSubRate} testId="input-tiered-sub" />
                </FieldGroup>
              </div>
              {tieredBaseRate && tieredSubRate && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(16, 185, 129, 0.06)",
                    border: "1px solid rgba(16, 185, 129, 0.15)",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                  }}
                  data-testid="tiered-preview"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 500 }}>Preview:</span>
                    <input
                      type="number"
                      value={tieredHoursPreview}
                      onChange={(e) => setTieredHoursPreview(e.target.value)}
                      min="0.5"
                      step="0.5"
                      style={{
                        width: "50px",
                        padding: "2px 4px",
                        fontSize: "12px",
                        border: "1px solid var(--border-default)",
                        borderRadius: "3px",
                        backgroundColor: "var(--bg-primary)",
                        color: "var(--text-primary)",
                        textAlign: "center",
                      }}
                      data-testid="input-tiered-preview-hours"
                    />
                    <span>hours</span>
                  </div>
                  <div>{computeTieredPreview() || "Enter valid rates"}</div>
                </div>
              )}
            </>
          )}

          {itemType === "BUNDLE" && (
            <>
              <FieldGroup label="Bundle Price" required>
                <CurrencyInput value={price} onChange={setPrice} testId="input-bundle-price" />
              </FieldGroup>
              <FieldGroup label="Components" required>
                <ComponentSelector
                  available={availableComponents}
                  selected={componentIds}
                  onChange={setComponentIds}
                />
                {componentIds.length < 2 && componentIds.length > 0 && (
                  <span style={{ fontSize: "11px", color: "#F59E0B", marginTop: "4px", display: "block" }}>
                    At least 2 components required
                  </span>
                )}
              </FieldGroup>
            </>
          )}

          {itemType === "INVENTORY" && (
            <FieldGroup label="Current Stock">
              <input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                min="0"
                placeholder="0"
                data-testid="input-current-stock"
                style={inputStyle}
              />
            </FieldGroup>
          )}

          <FieldGroup label="Income Category">
            <CategorySelector
              categories={flatCategories}
              value={incomeCategoryId}
              onChange={setIncomeCategoryId}
            />
          </FieldGroup>

          <FieldGroup label="Internal Cost">
            <CurrencyInput value={internalCost} onChange={setInternalCost} testId="input-internal-cost" />
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
              Used for margin reporting. Not shown on quotes or invoices.
            </span>
          </FieldGroup>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} data-testid="toggle-taxable">
              <div
                onClick={() => setTaxable(!taxable)}
                style={{
                  width: "36px",
                  height: "20px",
                  borderRadius: "10px",
                  backgroundColor: taxable ? "var(--brand-primary)" : "var(--border-default)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor: "white",
                    position: "absolute",
                    top: "2px",
                    left: taxable ? "18px" : "2px",
                    transition: "left 150ms ease",
                  }}
                />
              </div>
              <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>Taxable</span>
            </label>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
          <button
            onClick={onClose}
            data-testid="modal-cancel"
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
            onClick={handleSubmit}
            disabled={saving}
            data-testid="modal-save"
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--brand-primary)",
              color: "white",
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  border: "1px solid var(--border-default)",
  borderRadius: "6px",
  backgroundColor: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

function FieldGroup({ label, required, children, style }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>
        {label}
        {required && <span style={{ color: "#EF4444", marginLeft: "2px" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function CurrencyInput({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "var(--text-muted)" }}>$</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="0.01"
        placeholder="0.00"
        data-testid={testId}
        style={{ ...inputStyle, paddingLeft: "22px" }}
      />
    </div>
  );
}

function CategorySelector({ categories, value, onChange }: {
  categories: { id: string; path: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search
    ? categories.filter((c) => c.path.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const selected = categories.find((c) => c.id === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid="select-income-category"
        style={{
          ...inputStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          textAlign: "left",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selected ? selected.path : "Select category..."}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 10,
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "6px", borderBottom: "1px solid var(--border-default)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                autoFocus
                data-testid="search-income-category"
                style={{ ...inputStyle, paddingLeft: "26px", border: "none", backgroundColor: "transparent" }}
              />
            </div>
          </div>
          {value && (
            <button
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "12px",
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--border-default)",
                cursor: "pointer",
                textAlign: "left",
              }}
              data-testid="clear-income-category"
            >
              Clear selection
            </button>
          )}
          {filtered.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { onChange(cat.id); setOpen(false); setSearch(""); }}
              data-testid={`category-option-${cat.id}`}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "12px",
                color: cat.id === value ? "var(--brand-primary)" : "var(--text-primary)",
                background: cat.id === value ? "rgba(16,185,129,0.06)" : "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-tertiary)"; }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = cat.id === value ? "rgba(16,185,129,0.06)" : "transparent";
              }}
            >
              {cat.id === value && <Check size={12} />}
              {cat.path}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
              No categories found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComponentSelector({ available, selected, onChange }: {
  available: ProductServiceItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? available.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  const toggleComponent = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div>
      <div
        style={{
          border: "1px solid var(--border-default)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "6px", borderBottom: "1px solid var(--border-default)" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              data-testid="search-bundle-components"
              style={{ ...inputStyle, paddingLeft: "26px", border: "none", backgroundColor: "transparent" }}
            />
          </div>
        </div>

        {selected.length > 0 && (
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-default)", display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {selected.map((id) => {
              const item = available.find((a) => a.id === id);
              if (!item) return null;
              return (
                <span
                  key={id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    backgroundColor: "rgba(16,185,129,0.1)",
                    color: "var(--brand-primary)",
                    fontWeight: 500,
                  }}
                  data-testid={`selected-component-${id}`}
                >
                  {item.name}
                  <button
                    onClick={() => toggleComponent(id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0 1px", color: "var(--brand-primary)" }}
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div style={{ maxHeight: "180px", overflowY: "auto" }}>
          {filtered.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggleComponent(item.id)}
                data-testid={`component-option-${item.id}`}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "12px",
                  color: "var(--text-primary)",
                  background: isSelected ? "rgba(16,185,129,0.06)" : "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-tertiary)"; }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? "rgba(16,185,129,0.06)" : "transparent";
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "3px",
                    border: isSelected ? "none" : "1px solid var(--border-default)",
                    backgroundColor: isSelected ? "var(--brand-primary)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && <Check size={10} style={{ color: "white" }} />}
                </div>
                <span style={{ flex: 1 }}>{item.name}</span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 5px",
                    borderRadius: "3px",
                    backgroundColor: TYPE_COLORS[item.itemType]?.bg,
                    color: TYPE_COLORS[item.itemType]?.text,
                  }}
                >
                  {TYPE_LABELS[item.itemType]}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
              {available.length === 0 ? "Create items first to add as components" : "No matching items"}
            </div>
          )}
        </div>
      </div>
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
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>
          {title}
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.5 }}>
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
