import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds array is required" }, { status: 400 });
    }

    const categories = await prisma.incomeCategory.findMany({
      where: {
        id: { in: orderedIds },
        practiceId: practice.id,
      },
    });

    if (categories.length !== orderedIds.length) {
      return NextResponse.json({ error: "Some categories not found" }, { status: 404 });
    }

    const parentIds = new Set(categories.map((c: any) => c.parentId));
    if (parentIds.size > 1) {
      return NextResponse.json({ error: "All categories must share the same parent" }, { status: 400 });
    }

    const updates = orderedIds.map((id: string, index: number) =>
      prisma.incomeCategory.update({
        where: { id },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/income-categories/reorder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
