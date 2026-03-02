import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const body = await request.json();
    const { pipelineId } = body;

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId is required" }, { status: 400 });
    }

    const opportunity = await prisma.opportunity.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: { stage: true, pipeline: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (opportunity.pipelineId === pipelineId) {
      return NextResponse.json(opportunity);
    }

    const targetPipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, practiceId: practice.id },
    });

    if (!targetPipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const targetStages = await prisma.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
    });

    if (targetStages.length === 0) {
      return NextResponse.json({ error: "Target pipeline has no stages" }, { status: 400 });
    }

    const currentStageExists = targetStages.some((s) => s.id === opportunity.stageId);
    const newStageId = currentStageExists ? opportunity.stageId : targetStages[0].id;

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        pipelineId,
        stageId: newStageId,
        stageEnteredAt: currentStageExists ? undefined : new Date(),
      },
    });

    const user = await prisma.user.findFirst({
      where: { practiceId: practice.id, deletedAt: null },
    });

    if (user) {
      await prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId: opportunity.patientId,
          opportunityId: id,
          userId: user.id,
          type: "STAGE_CHANGE",
          body: `Moved to pipeline: ${targetPipeline.name}`,
          metadata: {
            fromStageId: opportunity.stageId,
            fromStageName: opportunity.stage?.name ?? null,
            toStageId: newStageId,
            toStageName: targetStages.find((s) => s.id === newStageId)?.name ?? null,
            opportunityId: id,
            action: "pipeline_switch",
            fromPipelineId: opportunity.pipelineId,
            fromPipelineName: opportunity.pipeline?.name ?? null,
            toPipelineId: pipelineId,
            toPipelineName: targetPipeline.name,
          },
        },
      });
    }

    return NextResponse.json(updated);
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
