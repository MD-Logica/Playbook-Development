import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Prisma } from "@prisma/client";
const Decimal = Prisma.Decimal;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { user, practice } = await requireAdmin();
    const { id: invoiceId, paymentId } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, practiceId: practice.id, deletedAt: null },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, invoiceId: invoice.id, practiceId: practice.id },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const paymentAmount = new Decimal(payment.amount.toString());
    const currentAmountPaid = new Decimal(invoice.amountPaid.toString());
    const invoiceTotal = new Decimal(invoice.total.toString());
    const newAmountPaid = currentAmountPaid.minus(paymentAmount);
    const clampedAmountPaid = newAmountPaid.lt(new Decimal(0))
      ? new Decimal(0)
      : newAmountPaid;
    const newBalanceDue = invoiceTotal.minus(clampedAmountPaid);

    let newStatus = invoice.status;
    if (invoice.status !== "VOID") {
      if (clampedAmountPaid.lte(new Decimal(0))) {
        newStatus = invoice.sentAt ? "SENT" : "DRAFT";
      } else if (clampedAmountPaid.lt(invoiceTotal)) {
        newStatus = "PARTIALLY_PAID";
      } else {
        newStatus = "PAID";
      }
    }

    await prisma.$transaction([
      prisma.payment.delete({
        where: { id: paymentId },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: clampedAmountPaid,
          balanceDue: newBalanceDue.gt(invoiceTotal) ? invoiceTotal : newBalanceDue,
          status: newStatus,
          paidAt: newStatus === "PAID" ? invoice.paidAt : null,
        },
      }),
      prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId: invoice.patientId,
          opportunityId: invoice.opportunityId,
          userId: user.id,
          type: "PAYMENT",
          body: `Payment of $${paymentAmount.toFixed(2)} deleted from invoice ${invoice.invoiceNumber || invoice.id}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            deletedPaymentId: paymentId,
            amount: paymentAmount.toFixed(2),
            method: payment.method,
          },
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized" || message === "Admin access required") {
      return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
    }
    console.error("DELETE /api/invoices/[id]/payments/[paymentId] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
