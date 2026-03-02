import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

async function archiveRecursive(id: string, practiceId: string) {
  await prisma.incomeCategory.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  const children = await prisma.incomeCategory.findMany({
    where: { parentId: id, practiceId, status: "ACTIVE" },
    select: { id: true },
  });

  for (const child of children) {
    await archiveRecursive(child.id, practiceId);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const category = await prisma.incomeCategory.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (category.status === "ARCHIVED") {
      return NextResponse.json({ error: "Category is already archived" }, { status: 400 });
    }

    await archiveRecursive(id, practice.id);

    const updated = await prisma.incomeCategory.findUnique({ where: { id } });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/settings/income-categories/[id]/archive error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
