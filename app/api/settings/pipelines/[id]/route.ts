import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();

    const pipeline = await prisma.pipeline.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "Pipeline name is required" }, { status: 400 });
      }
      const existing = await prisma.pipeline.findFirst({
        where: {
          practiceId: practice.id,
          name: { equals: body.name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "A pipeline with this name already exists" }, { status: 409 });
      }
      updateData.name = body.name.trim();
    }

    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isDefault !== undefined) {
      if (body.isDefault) {
        await prisma.pipeline.updateMany({
          where: { practiceId: practice.id, id: { not: id } },
          data: { isDefault: false },
        });
      }
      updateData.isDefault = body.isDefault;
    }

    const updated = await prisma.pipeline.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/settings/pipelines/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const pipeline = await prisma.pipeline.findFirst({
      where: { id, practiceId: practice.id },
      include: { _count: { select: { opportunities: true } } },
    });
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    if (pipeline.isDefault) {
      return NextResponse.json({ error: "Cannot delete the default pipeline" }, { status: 400 });
    }

    if (pipeline._count.opportunities > 0) {
      return NextResponse.json({ error: "Cannot delete a pipeline with existing deals. Archive it instead." }, { status: 400 });
    }

    await prisma.pipelineStage.deleteMany({ where: { pipelineId: id } });
    await prisma.pipeline.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("DELETE /api/settings/pipelines/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
