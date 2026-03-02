import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();
    const { name, color } = body;

    const tag = await prisma.practiceTag.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
      }
      if (name.trim().length > 32) {
        return NextResponse.json({ error: "Tag name must be 32 characters or less" }, { status: 400 });
      }
      const existing = await prisma.practiceTag.findFirst({
        where: {
          practiceId: practice.id,
          name: { equals: name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;

    const oldName = tag.name;
    const newName = name !== undefined ? name.trim() : oldName;
    const nameChanged = newName !== oldName;

    if (nameChanged) {
      const patientsWithOldTag = await prisma.patient.findMany({
        where: {
          practiceId: practice.id,
          deletedAt: null,
          tags: { has: oldName },
        },
        select: { id: true, tags: true },
      });

      await prisma.$transaction([
        prisma.practiceTag.update({
          where: { id },
          data: updateData,
        }),
        ...patientsWithOldTag.map((p) =>
          prisma.patient.update({
            where: { id: p.id },
            data: {
              tags: p.tags.map((t) => (t === oldName ? newName : t)),
            },
          })
        ),
      ]);
    } else {
      await prisma.practiceTag.update({
        where: { id },
        data: updateData,
      });
    }

    const updated = await prisma.practiceTag.findUnique({ where: { id } });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/settings/tags/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const tag = await prisma.practiceTag.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    if (tag.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived tags can be permanently deleted" }, { status: 400 });
    }

    const inUseCount = await prisma.patient.count({
      where: {
        practiceId: practice.id,
        deletedAt: null,
        tags: { has: tag.name },
      },
    });
    if (inUseCount > 0) {
      return NextResponse.json({ error: "Cannot delete a tag that is still assigned to patients" }, { status: 400 });
    }

    await prisma.practiceTag.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("DELETE /api/settings/tags/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
