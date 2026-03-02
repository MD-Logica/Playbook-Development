import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();
    const { name, category } = body;

    const procedureType = await prisma.procedureType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!procedureType) {
      return NextResponse.json({ error: "Procedure type not found" }, { status: 404 });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Procedure name is required" }, { status: 400 });
      }
      if (name.trim().length > 64) {
        return NextResponse.json({ error: "Procedure name must be 64 characters or less" }, { status: 400 });
      }
      const existing = await prisma.procedureType.findFirst({
        where: {
          practiceId: practice.id,
          name: { equals: name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "A procedure type with this name already exists" }, { status: 409 });
      }
    }

    const validCategories = ["SURGICAL", "NON_SURGICAL", "SKINCARE", "BODY", "HAIR", "OTHER"];
    if (category !== undefined && !validCategories.includes(category)) {
      return NextResponse.json({ error: "Category must be one of: Surgical, Non-Surgical, Skincare, Body, Hair, Other" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category;

    const updated = await prisma.procedureType.update({
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
    console.error("PATCH /api/settings/procedure-types/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const procedureType = await prisma.procedureType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!procedureType) {
      return NextResponse.json({ error: "Procedure type not found" }, { status: 404 });
    }
    if (procedureType.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived procedure types can be permanently deleted" }, { status: 400 });
    }

    await prisma.procedureType.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("DELETE /api/settings/procedure-types/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
