import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET() {
  try {
    const practice = await requirePractice();

    const pipelines = await prisma.pipeline.findMany({
      where: { practiceId: practice.id },
      orderBy: { order: "asc" },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            _count: {
              select: { opportunities: true },
            },
          },
        },
        _count: {
          select: { opportunities: true },
        },
      },
    });

    const result = pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isDefault: p.isDefault,
      isActive: p.isActive,
      order: p.order,
      dealCount: p._count.opportunities,
      stages: p.stages.map((s) => ({
        id: s.id,
        pipelineId: s.pipelineId,
        name: s.name,
        order: s.order,
        color: s.color,
        rottingThresholdHours: s.rottingThresholdHours,
        rottingEnabled: s.rottingEnabled,
        rottingValue: s.rottingValue,
        rottingUnit: s.rottingUnit,
        isWon: s.isWon,
        isLost: s.isLost,
        dealCount: s._count.opportunities,
      })),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/settings/pipelines error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Pipeline name is required" }, { status: 400 });
    }

    const existing = await prisma.pipeline.findFirst({
      where: {
        practiceId: practice.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A pipeline with this name already exists" }, { status: 409 });
    }

    const maxOrder = await prisma.pipeline.aggregate({
      where: { practiceId: practice.id },
      _max: { order: true },
    });

    const pipeline = await prisma.pipeline.create({
      data: {
        practiceId: practice.id,
        name: name.trim(),
        description: description?.trim() || null,
        order: (maxOrder._max.order ?? -1) + 1,
        isActive: true,
        isDefault: false,
      },
    });

    const defaultStages = [
      { name: "New Inquiry", color: "#6B7280", order: 0 },
      { name: "Consult Booked", color: "#3B82F6", order: 1 },
      { name: "Consult Completed", color: "#8B5CF6", order: 2 },
      { name: "Treatment Planned", color: "#F59E0B", order: 3 },
      { name: "Won", color: "#10B981", order: 4, isWon: true },
      { name: "Lost", color: "#EF4444", order: 5, isLost: true },
    ];

    await prisma.pipelineStage.createMany({
      data: defaultStages.map((s) => ({
        pipelineId: pipeline.id,
        name: s.name,
        color: s.color,
        order: s.order,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      })),
    });

    const created = await prisma.pipeline.findUnique({
      where: { id: pipeline.id },
      include: {
        stages: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/pipelines error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
