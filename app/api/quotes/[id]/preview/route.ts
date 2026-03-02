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
        coordinator: { select: { id: true, firstName: true, lastName: true } },
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            productService: {
              select: {
                id: true,
                name: true,
                itemType: true,
                bundleComponents: {
                  include: { item: { select: { name: true, price: true } } },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
        practice: { select: { name: true, phone: true, email: true, address: true } },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const previewData = {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      status: quote.status,
      subtotal: quote.subtotal,
      discountAmount: quote.discountAmount,
      taxAmount: quote.taxAmount,
      total: quote.total,
      depositType: quote.depositType,
      depositValue: quote.depositValue,
      expirationDate: quote.expirationDate,
      createdAt: quote.createdAt,
      patientNotes: quote.patientNotes,
      showComponents: quote.showComponents,
      patient: quote.patient,
      coordinator: quote.coordinator,
      practice: quote.practice,
      lineItems: quote.lineItems.map((li) => ({
        id: li.id,
        name: li.name,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        hours: li.hours,
        discountType: li.discountType,
        discountValue: li.discountValue,
        productService: li.productService
          ? {
              itemType: li.productService.itemType,
              bundleComponents: li.productService.bundleComponents,
            }
          : null,
      })),
    };

    return NextResponse.json(previewData);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/quotes/[id]/preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
