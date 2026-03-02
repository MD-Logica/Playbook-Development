import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const practice = await requirePractice();

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId is required" }, { status: 400 });
    }

    const stages = await prisma.pipelineStage.findMany({
      where: {
        pipelineId,
        pipeline: { practiceId: practice.id },
      },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { opportunities: true },
        },
      },
    });

    const formatted = stages.map((stage) => ({
      id: stage.id,
      pipelineId: stage.pipelineId,
      name: stage.name,
      order: stage.order,
      color: stage.color,
      rottingThresholdHours: stage.rottingThresholdHours,
      rottingEnabled: stage.rottingEnabled,
      rottingValue: stage.rottingValue,
      rottingUnit: stage.rottingUnit,
      isWon: stage.isWon,
      isLost: stage.isLost,
      opportunityCount: stage._count.opportunities,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const practice = await requirePractice();

    const body = await request.json();
    const { pipelineId, name, color, rottingThresholdHours, rottingEnabled, rottingValue, rottingUnit, isWon, isLost } = body;

    if (!pipelineId || !name) {
      return NextResponse.json({ error: "pipelineId and name are required" }, { status: 400 });
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, practiceId: practice.id },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const maxOrder = await prisma.pipelineStage.aggregate({
      where: { pipelineId },
      _max: { order: true },
    });

    const newOrder = (maxOrder._max.order ?? -1) + 1;

    const stage = await prisma.pipelineStage.create({
      data: {
        pipelineId,
        name,
        color: color || "#6B7280",
        rottingThresholdHours: rottingThresholdHours ?? 168,
        rottingEnabled: rottingEnabled ?? false,
        rottingValue: rottingValue ?? null,
        rottingUnit: rottingUnit ?? null,
        isWon: isWon ?? false,
        isLost: isLost ?? false,
        order: newOrder,
      },
    });

    return NextResponse.json(stage, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
