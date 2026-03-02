import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: any = { practiceId: practice.id };
    if (!includeArchived) {
      where.status = "ACTIVE";
    }

    const items = await prisma.productService.findMany({
      where,
      include: {
        bundleComponents: {
          include: {
            item: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        incomeCategory: {
          include: {
            parent: {
              include: {
                parent: {
                  include: {
                    parent: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            bundleMemberships: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = items.map((item) => ({
      ...item,
      bundleMembershipsCount: item._count.bundleMemberships,
      _count: undefined,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/settings/products-services error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
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

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }
    if (name.trim().length > 64) {
      return NextResponse.json({ error: "Item name must be 64 characters or less" }, { status: 400 });
    }
    if (!itemType) {
      return NextResponse.json({ error: "Item type is required" }, { status: 400 });
    }

    const validTypes = ["SERVICE_FLAT", "SERVICE_HOURLY", "SERVICE_TIERED", "BUNDLE", "INVENTORY", "NON_INVENTORY"];
    if (!validTypes.includes(itemType)) {
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 });
    }

    const existing = await prisma.productService.findFirst({
      where: {
        practiceId: practice.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "An item with this name already exists" }, { status: 409 });
    }

    const pricingError = validatePricing(itemType, { price, hourlyRate, tieredBaseRate, tieredSubRate, componentIds });
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 });
    }

    if (description && typeof description === "string" && description.length > 500) {
      return NextResponse.json({ error: "Description must be 500 characters or less" }, { status: 400 });
    }

    const data: any = {
      practiceId: practice.id,
      name: name.trim(),
      description: description || null,
      itemType,
      taxable: taxable ?? false,
      internalCost: internalCost != null ? internalCost : null,
      incomeCategoryId: incomeCategoryId || null,
      status: "ACTIVE",
    };

    if (itemType === "SERVICE_FLAT" || itemType === "INVENTORY" || itemType === "NON_INVENTORY" || itemType === "BUNDLE") {
      data.price = price != null ? price : null;
    }
    if (itemType === "SERVICE_HOURLY") {
      data.hourlyRate = hourlyRate != null ? hourlyRate : null;
    }
    if (itemType === "SERVICE_TIERED") {
      data.tieredBaseRate = tieredBaseRate != null ? tieredBaseRate : null;
      data.tieredSubRate = tieredSubRate != null ? tieredSubRate : null;
    }
    if (itemType === "INVENTORY") {
      data.currentStock = currentStock != null ? currentStock : null;
    }

    if (itemType === "BUNDLE" && componentIds && componentIds.length >= 2) {
      const item = await prisma.$transaction(async (tx) => {
        const created = await tx.productService.create({ data });
        await tx.bundleComponent.createMany({
          data: componentIds.map((cId: string, index: number) => ({
            bundleId: created.id,
            itemId: cId,
            sortOrder: index,
          })),
        });
        return created;
      });

      const full = await prisma.productService.findUnique({
        where: { id: item.id },
        include: {
          bundleComponents: { include: { item: true }, orderBy: { sortOrder: "asc" } },
          incomeCategory: { include: { parent: { include: { parent: { include: { parent: true } } } } } },
          _count: { select: { bundleMemberships: true } },
        },
      });

      return NextResponse.json({ ...full, bundleMembershipsCount: full!._count.bundleMemberships, _count: undefined }, { status: 201 });
    }

    const item = await prisma.productService.create({ data });

    const full = await prisma.productService.findUnique({
      where: { id: item.id },
      include: {
        bundleComponents: { include: { item: true }, orderBy: { sortOrder: "asc" } },
        incomeCategory: { include: { parent: { include: { parent: { include: { parent: true } } } } } },
        _count: { select: { bundleMemberships: true } },
      },
    });

    return NextResponse.json({ ...full, bundleMembershipsCount: full!._count.bundleMemberships, _count: undefined }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/products-services error:", error);
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
