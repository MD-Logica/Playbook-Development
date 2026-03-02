import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 48,
    color: "#1a1a1a",
    fontSize: 9,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  practiceName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    color: "#1a1a1a",
    maxWidth: 300,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  invoiceLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: "#999999",
    letterSpacing: 4,
  },
  invoiceNumber: {
    fontSize: 9,
    color: "#888888",
    marginTop: 2,
  },
  quoteRef: {
    fontSize: 8,
    color: "#999999",
    marginTop: 2,
    fontStyle: "italic",
  },
  accentLine: {
    height: 2,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  infoCol: {
    width: "48%",
  },
  infoLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#999999",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 9,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  infoTextMuted: {
    fontSize: 8,
    color: "#666666",
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#1a1a1a",
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#999999",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 7,
    alignItems: "flex-start",
  },
  colService: { width: "32%" },
  colDesc: { width: "28%" },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },
  cellText: { fontSize: 9, color: "#1a1a1a" },
  cellTextMuted: { fontSize: 8, color: "#888888" },
  discountRow: {
    paddingLeft: 12,
    paddingTop: 2,
    paddingBottom: 2,
  },
  discountText: {
    fontSize: 7.5,
    color: "#cc4444",
    fontStyle: "italic",
  },
  totalsContainer: {
    marginTop: 16,
    alignItems: "flex-end",
    marginBottom: 24,
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: { fontSize: 9, color: "#666666" },
  totalValue: { fontSize: 9, color: "#1a1a1a" },
  totalDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#1a1a1a",
  },
  grandTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#1a1a1a",
  },
  balanceBox: {
    borderLeftWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#fafafa",
    marginBottom: 20,
  },
  balanceLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 2,
    color: "#999999",
    marginBottom: 6,
  },
  balanceAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
  },
  balanceSubtext: {
    fontSize: 8,
    color: "#888888",
    marginTop: 2,
  },
  paymentSectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#1a1a1a",
    marginBottom: 8,
    marginTop: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  paymentTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 4,
    marginBottom: 4,
  },
  paymentTableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#999999",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  paymentRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 5,
  },
  payColDate: { width: "22%" },
  payColMethod: { width: "22%" },
  payColRef: { width: "28%" },
  payColAmount: { width: "28%", textAlign: "right" },
  notesBox: {
    backgroundColor: "#f8f8f8",
    padding: 14,
    marginBottom: 20,
    borderRadius: 4,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#999999",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: "#444444",
    lineHeight: 1.5,
  },
  coordinatorBox: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  coordinatorName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#1a1a1a",
  },
  coordinatorSeparator: {
    fontSize: 9,
    color: "#cccccc",
    marginHorizontal: 8,
  },
  coordinatorDetail: {
    fontSize: 8,
    color: "#666666",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 48,
    right: 48,
    textAlign: "center",
  },
  footerText: {
    fontSize: 7,
    color: "#aaaaaa",
    textAlign: "center",
    lineHeight: 1.6,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  statusBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    marginTop: 4,
    letterSpacing: 1,
  },
});

function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return "$" + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    CASH: "Cash",
    CHECK: "Check",
    CREDIT_CARD: "Credit Card",
    CARECREDIT: "CareCredit",
    CHERRY: "Cherry",
    PATIENTFI: "PatientFi",
    WIRE_TRANSFER: "Wire Transfer",
    OTHER: "Other",
  };
  return map[method] || method;
}

function calcLineTotal(li: any): number {
  const qty = Number(li.quantity || 1);
  const unitPrice = Number(li.unitPrice || 0);
  const hours = li.hours ? Number(li.hours) : null;
  const itemType = li.productService?.itemType;

  let lineTotal = 0;
  if (itemType === "SERVICE_TIERED") {
    const baseRate = Number(li.productService?.tieredBaseRate || unitPrice);
    const subRate = Number(li.productService?.tieredSubRate || 0);
    const h = hours || 1;
    lineTotal = baseRate + subRate * Math.max(0, h - 1);
  } else if (itemType === "SERVICE_HOURLY" || hours !== null) {
    lineTotal = (hours || 0) * unitPrice;
  } else {
    lineTotal = qty * unitPrice;
  }

  return lineTotal;
}

function calcLineDiscount(li: any, lineTotal: number): number {
  if (li.discountType && li.discountValue) {
    if (li.discountType === "FIXED") {
      return Number(li.discountValue);
    }
    return lineTotal * (Number(li.discountValue) / 100);
  }
  return 0;
}

function InvoiceDocument({ data }: { data: any }) {
  const accentColor = data.practice?.primaryColor || "#1a3a2a";
  const patient = data.patient;
  const coordinator = data.coordinator;
  const practice = data.practice;
  const total = Number(data.total || 0);
  const amountPaid = Number(data.amountPaid || 0);
  const balanceDue = Number(data.balanceDue || 0);
  const payments = data.payments || [];

  return createElement(Document, {},
    createElement(Page, { size: "A4", style: styles.page },

      practice?.logoUrl
        ? createElement(Image, { src: practice.logoUrl, style: styles.logo })
        : null,

      createElement(View, { style: styles.headerRow },
        createElement(Text, { style: styles.practiceName }, practice?.name || ""),
        createElement(View, { style: styles.headerRight },
          createElement(Text, { style: styles.invoiceLabel }, "INVOICE"),
          data.invoiceNumber
            ? createElement(Text, { style: styles.invoiceNumber }, `#${data.invoiceNumber}`)
            : null,
          data.quote?.quoteNumber
            ? createElement(Text, { style: styles.quoteRef }, `Generated from Quote ${data.quote.quoteNumber}`)
            : null,
          createElement(Text, { style: styles.statusBadge }, data.status || ""),
        ),
      ),

      createElement(View, { style: [styles.accentLine, { backgroundColor: accentColor }] }),

      createElement(View, { style: styles.infoRow },
        createElement(View, { style: styles.infoCol },
          createElement(Text, { style: styles.infoLabel }, "BILLED TO"),
          createElement(Text, { style: styles.infoText },
            `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim()
          ),
          patient?.email
            ? createElement(Text, { style: styles.infoTextMuted }, patient.email)
            : null,
          patient?.phone
            ? createElement(Text, { style: styles.infoTextMuted }, patient.phone)
            : null,
        ),
        createElement(View, { style: [styles.infoCol, { alignItems: "flex-end" as const }] },
          createElement(Text, { style: styles.infoTextMuted },
            `Invoice Date: ${formatDate(data.createdAt)}`
          ),
          data.dueDate
            ? createElement(Text, { style: styles.infoTextMuted },
                `Due Date: ${formatDate(data.dueDate)}`
              )
            : null,
          coordinator
            ? createElement(Text, { style: styles.infoTextMuted },
                `Coordinator: ${coordinator.firstName} ${coordinator.lastName}`
              )
            : null,
        ),
      ),

      createElement(Text, { style: styles.sectionTitle }, "Services"),

      createElement(View, { style: styles.tableHeader },
        createElement(Text, { style: [styles.tableHeaderText, styles.colService] }, "SERVICE"),
        createElement(Text, { style: [styles.tableHeaderText, styles.colDesc] }, "DESCRIPTION"),
        createElement(Text, { style: [styles.tableHeaderText, styles.colQty] }, "QTY"),
        createElement(Text, { style: [styles.tableHeaderText, styles.colPrice] }, "PRICE"),
        createElement(Text, { style: [styles.tableHeaderText, styles.colTotal] }, "TOTAL"),
      ),

      ...(data.lineItems || []).flatMap((li: any) => {
        const lineTotal = calcLineTotal(li);
        const discount = calcLineDiscount(li, lineTotal);
        const finalTotal = lineTotal - discount;
        const qty = Number(li.quantity || 1);
        const hours = li.hours ? Number(li.hours) : null;
        const itemType = li.productService?.itemType;
        const isHourly = itemType === "SERVICE_HOURLY" || itemType === "SERVICE_TIERED";
        const displayQty = isHourly && hours !== null ? `${hours}h` : String(qty);
        const elements: any[] = [];

        elements.push(
          createElement(View, { style: styles.tableRow, key: `row-${li.id}` },
            createElement(Text, { style: [styles.cellText, styles.colService] }, li.name || ""),
            createElement(Text, { style: [styles.cellTextMuted, styles.colDesc] }, li.description || ""),
            createElement(Text, { style: [styles.cellText, styles.colQty] }, displayQty),
            createElement(Text, { style: [styles.cellText, styles.colPrice] }, formatCurrency(li.unitPrice)),
            createElement(Text, { style: [styles.cellText, styles.colTotal] }, formatCurrency(finalTotal)),
          )
        );

        if (discount > 0) {
          elements.push(
            createElement(View, { style: styles.discountRow, key: `disc-${li.id}` },
              createElement(Text, { style: styles.discountText }, `Discount: -${formatCurrency(discount)}`),
            )
          );
        }

        return elements;
      }),

      createElement(View, { style: styles.totalsContainer },
        createElement(View, { style: styles.totalsBox },
          createElement(View, { style: styles.totalRow },
            createElement(Text, { style: styles.totalLabel }, "Subtotal"),
            createElement(Text, { style: styles.totalValue }, formatCurrency(data.subtotal)),
          ),
          Number(data.discountAmount) > 0
            ? createElement(View, { style: styles.totalRow },
                createElement(Text, { style: styles.totalLabel }, "Discount"),
                createElement(Text, { style: [styles.totalValue, { color: "#cc4444" }] },
                  `-${formatCurrency(data.discountAmount)}`
                ),
              )
            : null,
          createElement(View, { style: styles.totalRow },
            createElement(Text, { style: styles.totalLabel }, "Tax"),
            createElement(Text, { style: styles.totalValue }, formatCurrency(data.taxAmount)),
          ),
          createElement(View, { style: styles.totalDivider }),
          createElement(View, { style: styles.totalRow },
            createElement(Text, { style: styles.grandTotalLabel }, "TOTAL"),
            createElement(Text, { style: styles.grandTotalValue }, formatCurrency(total)),
          ),
          amountPaid > 0
            ? createElement(View, { style: styles.totalRow },
                createElement(Text, { style: styles.totalLabel }, "Amount Paid"),
                createElement(Text, { style: [styles.totalValue, { color: "#2d8a4e" }] },
                  formatCurrency(amountPaid)
                ),
              )
            : null,
        ),
      ),

      createElement(View, { style: [styles.balanceBox, { borderLeftColor: accentColor }] },
        createElement(Text, { style: styles.balanceLabel }, "BALANCE REMAINING"),
        createElement(Text, { style: [styles.balanceAmount, { color: balanceDue > 0 ? accentColor : "#2d8a4e" }] },
          formatCurrency(balanceDue)
        ),
        balanceDue <= 0
          ? createElement(Text, { style: styles.balanceSubtext }, "Paid in full")
          : null,
      ),

      payments.length > 0
        ? createElement(View, {},
            createElement(Text, { style: styles.paymentSectionTitle }, "Payment History"),
            createElement(View, { style: styles.paymentTableHeader },
              createElement(Text, { style: [styles.paymentTableHeaderText, styles.payColDate] }, "DATE"),
              createElement(Text, { style: [styles.paymentTableHeaderText, styles.payColMethod] }, "METHOD"),
              createElement(Text, { style: [styles.paymentTableHeaderText, styles.payColRef] }, "REFERENCE"),
              createElement(Text, { style: [styles.paymentTableHeaderText, styles.payColAmount] }, "AMOUNT"),
            ),
            ...payments.map((p: any) =>
              createElement(View, { style: styles.paymentRow, key: `pay-${p.id}` },
                createElement(Text, { style: [styles.cellText, styles.payColDate] }, formatDate(p.paymentDate)),
                createElement(Text, { style: [styles.cellText, styles.payColMethod] }, formatPaymentMethod(p.method)),
                createElement(Text, { style: [styles.cellTextMuted, styles.payColRef] }, p.referenceNumber || ""),
                createElement(Text, { style: [styles.cellText, styles.payColAmount] }, formatCurrency(p.amount)),
              )
            ),
          )
        : null,

      data.patientNotes
        ? createElement(View, { style: styles.notesBox },
            createElement(Text, { style: styles.notesLabel }, "NOTES"),
            createElement(Text, { style: styles.notesText }, data.patientNotes),
          )
        : null,

      coordinator
        ? createElement(View, { style: styles.coordinatorBox },
            createElement(Text, { style: styles.coordinatorName },
              `${coordinator.firstName} ${coordinator.lastName}`
            ),
            coordinator.email
              ? createElement(Text, { style: styles.coordinatorSeparator }, "|")
              : null,
            coordinator.email
              ? createElement(Text, { style: styles.coordinatorDetail }, coordinator.email)
              : null,
            coordinator.phone
              ? createElement(Text, { style: styles.coordinatorSeparator }, "|")
              : null,
            coordinator.phone
              ? createElement(Text, { style: styles.coordinatorDetail }, coordinator.phone)
              : null,
          )
        : null,

      createElement(View, { style: styles.footer },
        practice
          ? createElement(Text, { style: styles.footerText },
              [practice.address, practice.city, practice.state].filter(Boolean).join(", ")
              + (practice.phone ? ` \u2022 ${practice.phone}` : "")
              + (practice.email ? ` \u2022 ${practice.email}` : "")
            )
          : null,
      ),
    ),
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        coordinator: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        quote: {
          select: { id: true, quoteNumber: true },
        },
        practice: {
          select: {
            name: true, address: true, city: true, state: true,
            phone: true, email: true, logoUrl: true,
            primaryColor: true, secondaryColor: true,
          },
        },
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            productService: {
              select: {
                id: true,
                name: true,
                itemType: true,
                tieredBaseRate: true,
                tieredSubRate: true,
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          include: {
            recorder: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await renderToBuffer(
      createElement(InvoiceDocument, { data: invoice }) as any
    );

    const patientLastName = invoice.patient?.lastName || "Patient";
    const invNum = invoice.invoiceNumber || "Draft";
    const filename = `Invoice-${invNum}-${patientLastName}.pdf`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("GET /api/invoices/[id]/pdf error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
