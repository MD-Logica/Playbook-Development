import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const item = await prisma.productService.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (item.status === "ARCHIVED") {
      return NextResponse.json({ error: "Item is already archived" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bundleComponent.deleteMany({ where: { itemId: id } });
      await tx.productService.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });
    });

    const updated = await prisma.productService.findUnique({
      where: { id },
      include: {
        bundleComponents: { include: { item: true }, orderBy: { sortOrder: "asc" } },
        incomeCategory: { include: { parent: { include: { parent: { include: { parent: true } } } } } },
        _count: { select: { bundleMemberships: true } },
      },
    });

    return NextResponse.json({ ...updated, bundleMembershipsCount: updated!._count.bundleMemberships, _count: undefined });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/settings/products-services/[id]/archive error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
