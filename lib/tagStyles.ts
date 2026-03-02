export interface TagStyle {
  bg: string;
  text: string;
  emoji?: string;
}

const TAG_STYLES: Record<string, TagStyle> = {
  "VIP": { bg: "#D1FAE5", text: "#065F46", emoji: "👑" },
  "PITA": { bg: "#FFEDD5", text: "#9A3412", emoji: "🔥" },
  "Discharged": { bg: "#FEE2E2", text: "#991B1B", emoji: "⛔" },
  "Surgical Candidate": { bg: "#EDE9FE", text: "#5B21B6" },
  "Financing Needed": { bg: "#DBEAFE", text: "#1E40AF" },
  "High Value": { bg: "#FEF3C7", text: "#92400E", emoji: "💎" },
  "Recall Priority": { bg: "#FCE7F3", text: "#9D174D" },
};

export function getTagStyle(name: string): TagStyle {
  return TAG_STYLES[name] || { bg: "var(--bg-tertiary)", text: "var(--text-secondary)" };
}

export function getTagPillStyle(name: string): Record<string, string | number> {
  const s = getTagStyle(name);
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: "10px",
    backgroundColor: s.bg,
    color: s.text,
    whiteSpace: "nowrap",
  };
}
