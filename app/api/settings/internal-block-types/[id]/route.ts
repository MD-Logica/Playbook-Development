import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const blockType = await prisma.internalBlockType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!blockType) {
      return NextResponse.json({ error: "Block type not found" }, { status: 404 });
    }

    if (blockType.isSystem && body.name !== undefined && body.name !== blockType.name) {
      return NextResponse.json({ error: "System block type names cannot be modified." }, { status: 400 });
    }

    const updateData: any = {};
    if (body.color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
        return NextResponse.json({ error: "Color must be a valid hex color" }, { status: 400 });
      }
      updateData.color = body.color;
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (!blockType.isSystem && body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      if (body.name.trim().length > 40) {
        return NextResponse.json({ error: "Name must be 40 characters or less" }, { status: 400 });
      }
      const dup = await prisma.internalBlockType.findFirst({
        where: { practiceId: practice.id, name: body.name.trim(), id: { not: id } },
      });
      if (dup) {
        return NextResponse.json({ error: "A block type with this name already exists" }, { status: 400 });
      }
      updateData.name = body.name.trim();
    }

    const updated = await prisma.internalBlockType.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;

    const blockType = await prisma.internalBlockType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!blockType) {
      return NextResponse.json({ error: "Block type not found" }, { status: 404 });
    }
    if (blockType.isSystem) {
      return NextResponse.json({ error: "System block types cannot be deleted." }, { status: 400 });
    }

    await prisma.internalBlockType.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
