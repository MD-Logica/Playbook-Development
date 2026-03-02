import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();

    const { id } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const [quotes, invoices] = await Promise.all([
      prisma.quote.findMany({
        where: { patientId: id, practiceId: practice.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              productService: { select: { name: true, itemType: true } },
            },
          },
          coordinator: { select: { firstName: true, lastName: true } },
          opportunity: { select: { id: true, title: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { patientId: id, practiceId: practice.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          opportunity: { select: { id: true, title: true } },
          coordinator: { select: { id: true, firstName: true, lastName: true } },
          payments: {
            orderBy: { paymentDate: "desc" },
            include: {
              recorder: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const openQuoteStatuses = ["DRAFT", "SENT"];
    const openQuoteValue = quotes
      .filter((q) => openQuoteStatuses.includes(q.status))
      .reduce((sum, q) => sum + Number(q.total), 0);

    const totalInvoiced = invoices
      .filter((inv) => inv.status !== "VOID")
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);

    const outstandingBalance = invoices
      .filter((inv) => inv.status === "SENT" || inv.status === "PARTIALLY_PAID")
      .reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

    return NextResponse.json({
      quotes,
      invoices,
      summary: {
        totalQuoted: openQuoteValue,
        totalInvoiced,
        totalPaid,
        outstandingBalance,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/patients/[id]/financial error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
