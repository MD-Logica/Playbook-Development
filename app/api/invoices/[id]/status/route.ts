import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice, user } = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status || !["SENT", "VOID"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be SENT or VOID" },
        { status: 400 }
      );
    }

    const existing = await prisma.invoice.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (status === "SENT") {
      if (!["DRAFT"].includes(existing.status)) {
        return NextResponse.json(
          { error: "Only DRAFT invoices can be sent" },
          { status: 400 }
        );
      }

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          coordinator: { select: { id: true, firstName: true, lastName: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { paymentDate: "desc" } },
        },
      });

      if (existing.opportunityId) {
        await prisma.activity.create({
          data: {
            practiceId: practice.id,
            patientId: existing.patientId,
            opportunityId: existing.opportunityId,
            userId: user.id,
            type: "INVOICE",
            body: `Invoice ${existing.invoiceNumber} sent`,
            metadata: {
              action: "invoice_sent",
              invoiceId: id,
              invoiceNumber: existing.invoiceNumber,
            },
          },
        });
      }

      return NextResponse.json(invoice);
    }

    if (status === "VOID") {
      if (existing.status === "VOID") {
        return NextResponse.json(
          { error: "Invoice is already voided" },
          { status: 400 }
        );
      }

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: "VOID",
          voidedAt: new Date(),
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          coordinator: { select: { id: true, firstName: true, lastName: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { paymentDate: "desc" } },
        },
      });

      if (existing.opportunityId) {
        await prisma.activity.create({
          data: {
            practiceId: practice.id,
            patientId: existing.patientId,
            opportunityId: existing.opportunityId,
            userId: user.id,
            type: "INVOICE",
            body: `Invoice ${existing.invoiceNumber} voided`,
            metadata: {
              action: "invoice_voided",
              invoiceId: id,
              invoiceNumber: existing.invoiceNumber,
            },
          },
        });
      }

      return NextResponse.json(invoice);
    }

    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/invoices/[id]/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
