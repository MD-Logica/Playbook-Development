import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, chartId: true } },
        opportunity: { select: { id: true, title: true, pipelineId: true } },
        coordinator: { select: { id: true, firstName: true, lastName: true, email: true } },
        quote: { select: { id: true, quoteNumber: true, status: true } },
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            productService: { select: { id: true, name: true, itemType: true, taxable: true } },
            provider: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          include: {
            recorder: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        practice: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            phone: true,
            email: true,
            logoUrl: true,
            primaryColor: true,
            defaultTaxRate: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/invoices/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.invoice.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (existing.status === "VOID") {
      return NextResponse.json({ error: "Cannot edit a voided invoice" }, { status: 400 });
    }

    if (existing.status === "PAID") {
      return NextResponse.json({ error: "Cannot edit a fully paid invoice" }, { status: 400 });
    }

    const {
      description,
      coordinatorId,
      dueDate,
      depositType,
      depositValue,
      discountType,
      discountValue,
      internalNotes,
      patientNotes,
      lineItems,
    } = body;

    const taxRate = (await prisma.practice.findUnique({
      where: { id: practice.id },
      select: { defaultTaxRate: true },
    }))?.defaultTaxRate;
    const taxRateNum = taxRate ? Number(taxRate) : 0;

    let subtotal = 0;
    let taxAmount = 0;
    let processedItems: any[] = [];

    if (lineItems && Array.isArray(lineItems)) {
      processedItems = lineItems.map((li: any, idx: number) => {
        let lineTotal = 0;
        const qty = Number(li.quantity || 1);
        const unitPrice = Number(li.unitPrice || 0);
        const hours = li.hours ? Number(li.hours) : null;

        if (hours !== null) {
          lineTotal = hours * unitPrice;
        } else {
          lineTotal = qty * unitPrice;
        }

        let discountAmt = 0;
        if (li.discountType && li.discountValue) {
          if (li.discountType === "FIXED") {
            discountAmt = Number(li.discountValue);
          } else {
            discountAmt = lineTotal * (Number(li.discountValue) / 100);
          }
        }
        lineTotal -= discountAmt;
        subtotal += lineTotal;

        return {
          productServiceId: li.productServiceId || null,
          name: li.name || "",
          description: li.description || null,
          quantity: qty,
          unitPrice: unitPrice,
          hours: hours,
          providerId: li.providerId || null,
          discountType: li.discountType || null,
          discountValue: li.discountValue ? Number(li.discountValue) : null,
          sortOrder: idx,
          taxable: li.taxable ?? false,
        };
      });

      let invoiceLevelDiscount = 0;
      const dType = discountType !== undefined ? discountType : existing.discountType;
      const dValue = discountValue !== undefined ? discountValue : existing.discountValue;
      if (dType && dValue) {
        if (dType === "FIXED") {
          invoiceLevelDiscount = Number(dValue);
        } else {
          invoiceLevelDiscount = subtotal * (Number(dValue) / 100);
        }
      }

      let taxableTotal = 0;
      for (const li of processedItems) {
        if (li.taxable) {
          let lt = 0;
          if (li.hours !== null) {
            lt = li.hours * li.unitPrice;
          } else {
            lt = li.quantity * li.unitPrice;
          }
          let da = 0;
          if (li.discountType && li.discountValue) {
            if (li.discountType === "FIXED") da = li.discountValue;
            else da = lt * (li.discountValue / 100);
          }
          taxableTotal += lt - da;
        }
      }

      if (invoiceLevelDiscount > 0 && subtotal > 0) {
        const discountRatio = invoiceLevelDiscount / subtotal;
        taxableTotal = taxableTotal * (1 - discountRatio);
      }

      taxAmount = taxableTotal * (taxRateNum / 100);
      const total = subtotal - invoiceLevelDiscount + taxAmount;
      const amountPaid = Number(existing.amountPaid);
      const balanceDue = Math.max(0, total - amountPaid);

      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          ...(description !== undefined && { description }),
          ...(coordinatorId !== undefined && { coordinatorId }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(depositType !== undefined && { depositType }),
          ...(depositValue !== undefined && { depositValue: Number(depositValue) }),
          ...(discountType !== undefined && { discountType: discountType || null }),
          ...(discountValue !== undefined && { discountValue: discountValue ? Number(discountValue) : null }),
          ...(internalNotes !== undefined && { internalNotes }),
          ...(patientNotes !== undefined && { patientNotes }),
          subtotal,
          discountAmount: invoiceLevelDiscount,
          taxAmount,
          total,
          balanceDue,
          lineItems: {
            create: processedItems.map(({ taxable, ...item }) => item),
          },
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          opportunity: { select: { id: true, title: true, pipelineId: true } },
          coordinator: { select: { id: true, firstName: true, lastName: true } },
          quote: { select: { id: true, quoteNumber: true } },
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              productService: { select: { id: true, name: true, itemType: true, taxable: true } },
              provider: { select: { id: true, firstName: true, lastName: true } },
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

      return NextResponse.json(invoice);
    }

    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (coordinatorId !== undefined) updateData.coordinatorId = coordinatorId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (depositType !== undefined) updateData.depositType = depositType;
    if (depositValue !== undefined) updateData.depositValue = Number(depositValue);
    if (discountType !== undefined) updateData.discountType = discountType || null;
    if (discountValue !== undefined) updateData.discountValue = discountValue ? Number(discountValue) : null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (patientNotes !== undefined) updateData.patientNotes = patientNotes;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        opportunity: { select: { id: true, title: true, pipelineId: true } },
        coordinator: { select: { id: true, firstName: true, lastName: true } },
        quote: { select: { id: true, quoteNumber: true } },
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            productService: { select: { id: true, name: true, itemType: true, taxable: true } },
            provider: { select: { id: true, firstName: true, lastName: true } },
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

    return NextResponse.json(invoice);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/invoices/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
