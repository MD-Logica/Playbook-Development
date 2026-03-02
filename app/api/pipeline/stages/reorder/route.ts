import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { pipelineId, stageIds } = body;

    if (!pipelineId || !Array.isArray(stageIds) || stageIds.length === 0) {
      return NextResponse.json({ error: "pipelineId and stageIds array are required" }, { status: 400 });
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, practiceId: practice.id },
    });
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const existingStages = await prisma.pipelineStage.findMany({
      where: { pipelineId },
      select: { id: true },
    });
    const validIds = new Set(existingStages.map((s) => s.id));
    const invalidIds = stageIds.filter((id: string) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: "Some stage IDs do not belong to this pipeline" }, { status: 400 });
    }

    await prisma.$transaction(
      stageIds.map((stageId: string, index: number) =>
        prisma.pipelineStage.update({
          where: { id: stageId },
          data: { order: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/pipeline/stages/reorder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
