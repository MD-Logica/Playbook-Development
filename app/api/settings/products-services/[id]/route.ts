import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      description,
      itemType,
      price,
      hourlyRate,
      tieredBaseRate,
      tieredSubRate,
      internalCost,
      taxable,
      currentStock,
      incomeCategoryId,
      componentIds,
    } = body;

    const item = await prisma.productService.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const effectiveType = itemType || item.itemType;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Item name is required" }, { status: 400 });
      }
      if (name.trim().length > 64) {
        return NextResponse.json({ error: "Item name must be 64 characters or less" }, { status: 400 });
      }
      const existing = await prisma.productService.findFirst({
        where: {
          practiceId: practice.id,
          name: { equals: name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "An item with this name already exists" }, { status: 409 });
      }
    }

    if (description !== undefined && typeof description === "string" && description.length > 500) {
      return NextResponse.json({ error: "Description must be 500 characters or less" }, { status: 400 });
    }

    if (itemType) {
      const validTypes = ["SERVICE_FLAT", "SERVICE_HOURLY", "SERVICE_TIERED", "BUNDLE", "INVENTORY", "NON_INVENTORY"];
      if (!validTypes.includes(itemType)) {
        return NextResponse.json({ error: "Invalid item type" }, { status: 400 });
      }
    }

    const pricingFields = {
      price: price !== undefined ? price : (effectiveType !== item.itemType ? undefined : item.price),
      hourlyRate: hourlyRate !== undefined ? hourlyRate : (effectiveType !== item.itemType ? undefined : item.hourlyRate),
      tieredBaseRate: tieredBaseRate !== undefined ? tieredBaseRate : (effectiveType !== item.itemType ? undefined : item.tieredBaseRate),
      tieredSubRate: tieredSubRate !== undefined ? tieredSubRate : (effectiveType !== item.itemType ? undefined : item.tieredSubRate),
      componentIds: componentIds,
    };

    const pricingError = validatePricing(effectiveType, pricingFields);
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description || null;
    if (itemType !== undefined) updateData.itemType = itemType;
    if (taxable !== undefined) updateData.taxable = taxable;
    if (internalCost !== undefined) updateData.internalCost = internalCost != null ? internalCost : null;
    if (incomeCategoryId !== undefined) updateData.incomeCategoryId = incomeCategoryId || null;

    updateData.price = null;
    updateData.hourlyRate = null;
    updateData.tieredBaseRate = null;
    updateData.tieredSubRate = null;
    updateData.currentStock = null;

    if (effectiveType === "SERVICE_FLAT" || effectiveType === "INVENTORY" || effectiveType === "NON_INVENTORY" || effectiveType === "BUNDLE") {
      updateData.price = price != null ? price : item.price;
    }
    if (effectiveType === "SERVICE_HOURLY") {
      updateData.hourlyRate = hourlyRate != null ? hourlyRate : item.hourlyRate;
    }
    if (effectiveType === "SERVICE_TIERED") {
      updateData.tieredBaseRate = tieredBaseRate != null ? tieredBaseRate : item.tieredBaseRate;
      updateData.tieredSubRate = tieredSubRate != null ? tieredSubRate : item.tieredSubRate;
    }
    if (effectiveType === "INVENTORY") {
      updateData.currentStock = currentStock != null ? currentStock : item.currentStock;
    }

    await prisma.$transaction(async (tx) => {
      await tx.productService.update({ where: { id }, data: updateData });

      if (effectiveType === "BUNDLE" && componentIds) {
        await tx.bundleComponent.deleteMany({ where: { bundleId: id } });
        await tx.bundleComponent.createMany({
          data: componentIds.map((cId: string, index: number) => ({
            bundleId: id,
            itemId: cId,
            sortOrder: index,
          })),
        });
      } else if (itemType && itemType !== "BUNDLE" && item.itemType === "BUNDLE") {
        await tx.bundleComponent.deleteMany({ where: { bundleId: id } });
      }
    });

    const full = await prisma.productService.findUnique({
      where: { id },
      include: {
        bundleComponents: { include: { item: true }, orderBy: { sortOrder: "asc" } },
        incomeCategory: { include: { parent: { include: { parent: { include: { parent: true } } } } } },
        _count: { select: { bundleMemberships: true } },
      },
    });

    return NextResponse.json({ ...full, bundleMembershipsCount: full!._count.bundleMemberships, _count: undefined });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/settings/products-services/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const item = await prisma.productService.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (item.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived items can be permanently deleted" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bundleComponent.deleteMany({ where: { bundleId: id } });
      await tx.bundleComponent.deleteMany({ where: { itemId: id } });
      await tx.productService.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("DELETE /api/settings/products-services/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function validatePricing(
  itemType: string,
  fields: { price?: any; hourlyRate?: any; tieredBaseRate?: any; tieredSubRate?: any; componentIds?: string[] }
): string | null {
  switch (itemType) {
    case "SERVICE_FLAT":
      if (fields.price == null || isNaN(Number(fields.price))) return "Price is required for flat-rate services";
      break;
    case "SERVICE_HOURLY":
      if (fields.hourlyRate == null || isNaN(Number(fields.hourlyRate))) return "Hourly rate is required for hourly services";
      break;
    case "SERVICE_TIERED":
      if (fields.tieredBaseRate == null || isNaN(Number(fields.tieredBaseRate))) return "Base rate is required for tiered services";
      if (fields.tieredSubRate == null || isNaN(Number(fields.tieredSubRate))) return "Subsequent rate is required for tiered services";
      break;
    case "BUNDLE":
      if (fields.price == null || isNaN(Number(fields.price))) return "Bundle price is required";
      if (!fields.componentIds || !Array.isArray(fields.componentIds) || fields.componentIds.length < 2)
        return "Bundles require at least 2 component items";
      break;
    case "INVENTORY":
      if (fields.price == null || isNaN(Number(fields.price))) return "Price is required for inventory items";
      break;
    case "NON_INVENTORY":
      if (fields.price == null || isNaN(Number(fields.price))) return "Price is required for non-inventory items";
      break;
  }
  return null;
}
