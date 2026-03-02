"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";

interface BundleComponent {
  item: { name: string; price: string };
}

interface LineItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: string;
  hours: number | null;
  discountType: string | null;
  discountValue: string | null;
  productService: {
    itemType: string;
    bundleComponents: BundleComponent[];
  } | null;
}

interface QuotePreview {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  depositType: string | null;
  depositValue: string | null;
  expirationDate: string | null;
  createdAt: string;
  patientNotes: string | null;
  showComponents: boolean;
  patient: { firstName: string; lastName: string; email: string | null; phone: string | null };
  coordinator: { firstName: string; lastName: string } | null;
  practice: { name: string; phone: string | null; email: string | null; address: string | null };
  lineItems: LineItem[];
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "$0.00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "$0.00";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function calcLineTotal(item: LineItem): number {
  const price = parseFloat(item.unitPrice) || 0;
  if (item.hours && item.hours > 0) {
    return item.hours * price;
  }
  return (item.quantity || 1) * price;
}

export default function QuotePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: quote, isLoading, error } = useQuery<QuotePreview>({
    queryKey: ["/api/quotes", id, "preview"],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${id}/preview`);
      if (!res.ok) throw new Error("Failed to load quote");
      return res.json();
    },
  });

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
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading quote...</span>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <span style={{ color: "#EF4444", fontSize: "14px" }} data-testid="error-message">
          Failed to load quote preview
        </span>
      </div>
    );
  }

  const discountAmount = parseFloat(quote.discountAmount) || 0;
  const taxAmount = parseFloat(quote.taxAmount) || 0;
  const total = parseFloat(quote.total) || 0;
  const depositValue = parseFloat(quote.depositValue || "0") || 0;

  let depositDisplay = "";
  if (quote.depositType === "PERCENTAGE" && depositValue > 0) {
    const depositDollar = (depositValue / 100) * total;
    depositDisplay = `${formatCurrency(depositDollar)} (${depositValue}% of total)`;
  } else if (quote.depositType === "FLAT" && depositValue > 0) {
    depositDisplay = formatCurrency(depositValue);
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          nav, aside, header, [data-sidebar], [data-topbar], .sidebar-component, .topbar-component { display: none !important; }
          body { margin: 0; padding: 0; background: white !important; }
          .quote-preview-container { margin: 0 !important; padding: 20px !important; box-shadow: none !important; max-width: 100% !important; }
          .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>

      <button
        className="no-print"
        onClick={() => window.print()}
        data-testid="print-button"
        style={{
          position: "fixed",
          top: "16px",
          right: "16px",
          padding: "8px 16px",
          fontSize: "13px",
          fontWeight: 500,
          borderRadius: "6px",
          border: "1px solid var(--border-default)",
          backgroundColor: "var(--brand-primary)",
          color: "white",
          cursor: "pointer",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        Print
      </button>

      <div
        className="quote-preview-container"
        data-testid="quote-preview"
        style={{
          maxWidth: "800px",
          margin: "24px auto",
          padding: "48px",
          backgroundColor: "white",
          color: "#1a1a1a",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: "14px",
          lineHeight: 1.6,
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <h1
              data-testid="practice-name"
              style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#111" }}
            >
              {quote.practice.name}
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666" }}>
              QUOTE
            </div>
            <div data-testid="quote-number" style={{ fontSize: "18px", fontWeight: 600, color: "#111" }}>
              {quote.quoteNumber}
            </div>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #e5e7eb", margin: "0 0 24px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", gap: "40px", marginBottom: "32px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", marginBottom: "8px" }}>
              Patient
            </div>
            <div data-testid="patient-name" style={{ fontWeight: 600, fontSize: "15px", color: "#111" }}>
              {quote.patient.firstName} {quote.patient.lastName}
            </div>
            {quote.patient.email && (
              <div data-testid="patient-email" style={{ fontSize: "13px", color: "#555" }}>
                {quote.patient.email}
              </div>
            )}
            {quote.patient.phone && (
              <div data-testid="patient-phone" style={{ fontSize: "13px", color: "#555" }}>
                {quote.patient.phone}
              </div>
            )}
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", marginBottom: "8px" }}>
              Quote Details
            </div>
            <div style={{ fontSize: "13px", color: "#555" }}>
              <span style={{ color: "#999" }}>Date Issued:</span>{" "}
              <span data-testid="date-issued" style={{ color: "#111" }}>{formatDate(quote.createdAt)}</span>
            </div>
            {quote.expirationDate && (
              <div style={{ fontSize: "13px", color: "#555" }}>
                <span style={{ color: "#999" }}>Expires:</span>{" "}
                <span data-testid="expiration-date" style={{ color: "#111" }}>{formatDate(quote.expirationDate)}</span>
              </div>
            )}
            {quote.coordinator && (
              <div style={{ fontSize: "13px", color: "#555" }}>
                <span style={{ color: "#999" }}>Coordinator:</span>{" "}
                <span data-testid="coordinator-name" style={{ color: "#111" }}>
                  {quote.coordinator.firstName} {quote.coordinator.lastName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* LINE ITEMS TABLE */}
        <table
          data-testid="line-items-table"
          style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={previewThStyle}>Item</th>
              <th style={previewThStyle}>Description</th>
              <th style={{ ...previewThStyle, textAlign: "center", width: "60px" }}>Qty</th>
              <th style={{ ...previewThStyle, textAlign: "right", width: "100px" }}>Unit Price</th>
              <th style={{ ...previewThStyle, textAlign: "right", width: "100px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((item) => {
              const lineTotal = calcLineTotal(item);
              const hasDiscount = item.discountType && item.discountValue && parseFloat(item.discountValue) > 0;
              const isBundle = item.productService?.itemType === "BUNDLE";
              const hasHours = item.hours && item.hours > 0;

              return (
                <Fragment key={item.id}>
                  <tr data-testid={`line-item-${item.id}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={previewTdStyle}>
                      <span style={{ fontWeight: 500, color: "#111" }}>{item.name}</span>
                    </td>
                    <td style={{ ...previewTdStyle, color: "#666" }}>{item.description || ""}</td>
                    <td style={{ ...previewTdStyle, textAlign: "center" }}>
                      {hasHours ? `${item.hours} hrs` : item.quantity}
                    </td>
                    <td style={{ ...previewTdStyle, textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                    <td style={{ ...previewTdStyle, textAlign: "right", fontWeight: 500 }}>
                      {formatCurrency(lineTotal)}
                    </td>
                  </tr>
                  {hasDiscount && (
                    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td colSpan={4} style={{ ...previewTdStyle, paddingLeft: "28px", fontSize: "12px", color: "#999" }}>
                        Discount: {item.discountType === "PERCENTAGE" ? `-${item.discountValue}%` : `-${formatCurrency(item.discountValue)}`}
                      </td>
                      <td style={{ ...previewTdStyle, textAlign: "right", fontSize: "12px", color: "#999" }}>
                        {item.discountType === "PERCENTAGE"
                          ? `-${formatCurrency(lineTotal * (parseFloat(item.discountValue!) / 100))}`
                          : `-${formatCurrency(item.discountValue)}`}
                      </td>
                    </tr>
                  )}
                  {isBundle && quote.showComponents && item.productService?.bundleComponents?.map((comp, idx) => (
                    <tr key={`bundle-${item.id}-${idx}`} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td
                        colSpan={5}
                        style={{ ...previewTdStyle, paddingLeft: "28px", fontSize: "12px", color: "#aaa", fontStyle: "italic" }}
                      >
                        {comp.item.name} — {formatCurrency(comp.item.price)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* TOTALS */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
          <div style={{ width: "260px" }} data-testid="totals-section">
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
              <span style={{ color: "#666" }}>Subtotal</span>
              <span data-testid="subtotal" style={{ color: "#111" }}>{formatCurrency(quote.subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
                <span style={{ color: "#666" }}>Discount</span>
                <span data-testid="discount-amount" style={{ color: "#EF4444" }}>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
              <span style={{ color: "#666" }}>Tax</span>
              <span data-testid="tax-amount" style={{ color: "#111" }}>{formatCurrency(quote.taxAmount)}</span>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span style={{ fontWeight: 700, fontSize: "18px", color: "#111" }}>Total</span>
              <span data-testid="total-amount" style={{ fontWeight: 700, fontSize: "18px", color: "#111" }}>
                {formatCurrency(quote.total)}
              </span>
            </div>
          </div>
        </div>

        {/* DEPOSIT SECTION */}
        {depositDisplay && (
          <div
            data-testid="deposit-section"
            style={{
              border: "2px solid #111",
              borderRadius: "8px",
              padding: "20px 24px",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: "8px" }}>
              Deposit to Secure Your Date
            </div>
            <div data-testid="deposit-amount" style={{ fontSize: "22px", fontWeight: 700, color: "#111" }}>
              {depositDisplay}
            </div>
          </div>
        )}

        {/* FINANCING SECTION */}
        <div
          data-testid="financing-section"
          style={{
            padding: "16px 20px",
            backgroundColor: "#f9fafb",
            borderRadius: "6px",
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "4px" }}>
            Financing Available
          </div>
          <div style={{ fontSize: "13px", color: "#666" }}>
            CareCredit &bull; Cherry &bull; PatientFi
          </div>
        </div>

        {/* FOOTER */}
        <div data-testid="quote-footer" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", fontSize: "13px", color: "#666" }}>
          {quote.expirationDate && (
            <p data-testid="validity-notice" style={{ margin: "0 0 12px 0", fontWeight: 500, color: "#111" }}>
              This quote is valid until {formatDate(quote.expirationDate)}.
            </p>
          )}
          {quote.patientNotes && (
            <div data-testid="patient-notes" style={{ margin: "0 0 16px 0", padding: "12px 16px", backgroundColor: "#f9fafb", borderRadius: "6px", whiteSpace: "pre-wrap" }}>
              {quote.patientNotes}
            </div>
          )}
          <div data-testid="practice-contact" style={{ fontSize: "12px", color: "#999" }}>
            <div style={{ fontWeight: 600, color: "#666" }}>{quote.practice.name}</div>
            {quote.practice.address && <div>{quote.practice.address}</div>}
            {quote.practice.phone && <div>{quote.practice.phone}</div>}
            {quote.practice.email && <div>{quote.practice.email}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

const Fragment = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const previewThStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#999",
};

const previewTdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "13px",
  color: "#333",
  verticalAlign: "top",
};
