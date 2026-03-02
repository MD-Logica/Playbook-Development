import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();
    const { name, sortOrder } = body;

    const category = await prisma.incomeCategory.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Category name is required" }, { status: 400 });
      }

      const existing = await prisma.incomeCategory.findFirst({
        where: {
          practiceId: practice.id,
          parentId: category.parentId,
          name: { equals: name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "A category with this name already exists at this level" }, { status: 409 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const updated = await prisma.incomeCategory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/settings/income-categories/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const category = await prisma.incomeCategory.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (category.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived categories can be permanently deleted" }, { status: 400 });
    }

    const childCount = await prisma.incomeCategory.count({
      where: { parentId: id, practiceId: practice.id },
    });
    if (childCount > 0) {
      return NextResponse.json({ error: "Cannot delete a category that has children" }, { status: 400 });
    }

    await prisma.incomeCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("DELETE /api/settings/income-categories/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
