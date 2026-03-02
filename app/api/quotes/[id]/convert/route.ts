import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { practice, user } = await requireUser();
    const { id } = await params;

    const quote = await prisma.quote.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, title: true, patientId: true } },
        coordinator: { select: { id: true, firstName: true, lastName: true } },
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            productService: { select: { id: true, name: true, itemType: true, taxable: true } },
            provider: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const allowedStatuses = ["DRAFT", "SENT", "ACCEPTED"];
    if (!allowedStatuses.includes(quote.status)) {
      return NextResponse.json(
        { error: `Cannot convert a quote with status "${quote.status}". Only DRAFT, SENT, or ACCEPTED quotes can be converted.` },
        { status: 400 }
      );
    }

    if (quote.opportunityId) {
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          opportunityId: quote.opportunityId,
          practiceId: practice.id,
          status: { not: "VOID" },
          deletedAt: null,
        },
      });

      if (existingInvoice) {
        return NextResponse.json(
          { error: `This deal already has an active invoice (${existingInvoice.invoiceNumber || existingInvoice.id}). Void the existing invoice before creating a new one.` },
          { status: 409 }
        );
      }
    }

    const lastInvoice = await prisma.invoice.findFirst({
      where: { practiceId: practice.id, invoiceNumber: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true },
    });

    let nextNum = 1;
    if (lastInvoice?.invoiceNumber) {
      const match = lastInvoice.invoiceNumber.match(/INV-\d{4}-(\d{4})/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(nextNum).padStart(4, "0")}`;

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: { status: "CONVERTED" },
      });

      const createdInvoice = await tx.invoice.create({
        data: {
          practiceId: practice.id,
          patientId: quote.patientId,
          quoteId: quote.id,
          opportunityId: quote.opportunityId || null,
          coordinatorId: quote.coordinatorId,
          invoiceNumber,
          description: quote.title || null,
          status: "DRAFT",
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
          taxAmount: quote.taxAmount,
          total: quote.total,
          amountPaid: 0,
          balanceDue: Number(quote.total),
          depositType: quote.depositType,
          depositValue: quote.depositValue,
          discountType: quote.quoteLevelDiscountType || null,
          discountValue: quote.quoteLevelDiscountValue || null,
          internalNotes: quote.internalNotes,
          patientNotes: quote.patientNotes,
          lineItems: {
            create: quote.lineItems.map((li) => ({
              productServiceId: li.productServiceId || null,
              name: li.name,
              description: li.description || null,
              quantity: li.quantity,
              unitPrice: li.unitPrice || null,
              hours: li.hours || null,
              providerId: li.providerId || null,
              discountType: li.discountType || null,
              discountValue: li.discountValue || null,
              sortOrder: li.sortOrder,
            })),
          },
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          opportunity: { select: { id: true, title: true, pipelineId: true } },
          coordinator: { select: { id: true, firstName: true, lastName: true } },
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              productService: { select: { id: true, name: true, itemType: true, taxable: true } },
              provider: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          payments: true,
        },
      });

      await tx.activity.create({
        data: {
          practiceId: practice.id,
          patientId: quote.patientId,
          opportunityId: quote.opportunityId || null,
          userId: user.id,
          type: "INVOICE",
          body: `Quote ${quote.quoteNumber || quote.id} converted to Invoice ${invoiceNumber}`,
          metadata: {
            action: "quote_converted",
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            invoiceId: createdInvoice.id,
            invoiceNumber,
            total: Number(quote.total),
          },
        },
      });

      return createdInvoice;
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/quotes/[id]/convert error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
