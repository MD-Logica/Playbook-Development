import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;

    const quote = await prisma.quote.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        opportunity: { select: { id: true, title: true, pipelineId: true } },
        coordinator: { select: { id: true, firstName: true, lastName: true } },
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            productService: {
              select: {
                id: true,
                name: true,
                itemType: true,
                taxable: true,
                price: true,
                hourlyRate: true,
                tieredBaseRate: true,
                tieredSubRate: true,
                description: true,
                bundleComponents: {
                  include: { item: { select: { id: true, name: true, price: true } } },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            provider: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/quotes/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { practice, user } = await requireUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.quote.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const {
      title,
      coordinatorId,
      expirationDate,
      depositType,
      depositValue,
      quoteLevelDiscountType,
      quoteLevelDiscountValue,
      internalNotes,
      patientNotes,
      showComponents,
      lineItems,
    } = body;

    const taxRate = practice.defaultTaxRate ? Number(practice.defaultTaxRate) : 0;

    let subtotal = 0;
    let processedItems: any[] = [];

    if (lineItems && lineItems.length > 0) {
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
    }

    const qDiscountType = quoteLevelDiscountType ?? existing.quoteLevelDiscountType;
    const qDiscountVal = quoteLevelDiscountValue !== undefined ? quoteLevelDiscountValue : existing.quoteLevelDiscountValue;

    let quoteLevelDiscount = 0;
    if (qDiscountType && qDiscountVal) {
      if (qDiscountType === "FIXED") {
        quoteLevelDiscount = Number(qDiscountVal);
      } else {
        quoteLevelDiscount = subtotal * (Number(qDiscountVal) / 100);
      }
    }

    const afterDiscount = subtotal - quoteLevelDiscount;

    let taxableTotal = 0;
    for (const li of processedItems) {
      if (li.taxable) {
        let lineTotal = 0;
        if (li.hours !== null) {
          lineTotal = li.hours * li.unitPrice;
        } else {
          lineTotal = li.quantity * li.unitPrice;
        }
        let discAmt = 0;
        if (li.discountType && li.discountValue) {
          if (li.discountType === "FIXED") discAmt = li.discountValue;
          else discAmt = lineTotal * (li.discountValue / 100);
        }
        taxableTotal += lineTotal - discAmt;
      }
    }

    if (quoteLevelDiscount > 0 && subtotal > 0) {
      const discountRatio = quoteLevelDiscount / subtotal;
      taxableTotal = taxableTotal * (1 - discountRatio);
    }

    const taxAmount = taxableTotal * (taxRate / 100);
    const total = afterDiscount + taxAmount;

    const updateData: any = {
      subtotal,
      discountAmount: quoteLevelDiscount,
      taxAmount,
      total,
    };

    if (title !== undefined) updateData.title = title || null;
    if (coordinatorId) updateData.coordinatorId = coordinatorId;
    if (expirationDate) updateData.expirationDate = new Date(expirationDate);
    if (depositType) updateData.depositType = depositType;
    if (depositValue !== undefined) updateData.depositValue = depositValue;
    if (quoteLevelDiscountType !== undefined) updateData.quoteLevelDiscountType = quoteLevelDiscountType || null;
    if (quoteLevelDiscountValue !== undefined) updateData.quoteLevelDiscountValue = quoteLevelDiscountValue ? Number(quoteLevelDiscountValue) : null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes || null;
    if (patientNotes !== undefined) updateData.patientNotes = patientNotes || null;
    if (showComponents !== undefined) updateData.showComponents = showComponents;

    if (lineItems && lineItems.length > 0) {
      await prisma.quoteLineItem.deleteMany({ where: { quoteId: id } });
      await prisma.quoteLineItem.createMany({
        data: processedItems.map(({ taxable, ...item }) => ({ ...item, quoteId: id })),
      });
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, title: true } },
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

    return NextResponse.json(quote);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/quotes/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
