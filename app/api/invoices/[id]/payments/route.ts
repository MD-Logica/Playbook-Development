import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
const Decimal = Prisma.Decimal;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, practice } = await requireUser();
    const { id: invoiceId } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, practiceId: practice.id, deletedAt: null },
      include: { payments: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "VOID") {
      return NextResponse.json(
        { error: "Cannot record payment on a voided invoice" },
        { status: 400 }
      );
    }

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { error: "Invoice is already fully paid" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, paymentDate, method, referenceNumber, notes } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (!method) {
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 }
      );
    }

    const paymentAmount = new Decimal(amount);
    const currentAmountPaid = new Decimal(invoice.amountPaid.toString());
    const invoiceTotal = new Decimal(invoice.total.toString());
    const newAmountPaid = currentAmountPaid.plus(paymentAmount);
    const newBalanceDue = invoiceTotal.minus(newAmountPaid);

    let newStatus: string = invoice.status;
    if (newBalanceDue.lte(new Decimal(0))) {
      newStatus = "PAID";
    } else if (newAmountPaid.gt(new Decimal(0))) {
      newStatus = "PARTIALLY_PAID";
    }

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          practiceId: practice.id,
          patientId: invoice.patientId,
          invoiceId: invoice.id,
          amount: paymentAmount,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          method,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          recordedBy: user.id,
        },
        include: {
          recorder: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid.toNumber() > invoiceTotal.toNumber()
            ? invoiceTotal
            : newAmountPaid,
          balanceDue: newBalanceDue.lt(new Decimal(0))
            ? new Decimal(0)
            : newBalanceDue,
          status: newStatus as any,
          paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
        },
      }),
      prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId: invoice.patientId,
          opportunityId: invoice.opportunityId,
          userId: user.id,
          type: "PAYMENT",
          body: `Payment of $${paymentAmount.toFixed(2)} recorded via ${method}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: paymentAmount.toFixed(2),
            method,
            referenceNumber: referenceNumber || null,
          },
        },
      }),
    ]);

    return NextResponse.json(payment, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("POST /api/invoices/[id]/payments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
