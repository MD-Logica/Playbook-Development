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
    const { stageId } = body;

    if (!stageId) {
      return NextResponse.json({ error: "stageId is required" }, { status: 400 });
    }

    const opportunity = await prisma.opportunity.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: { pipeline: true, stage: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId: opportunity.pipelineId },
    });

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const now = new Date();

    const updatedOpportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        stageId,
        stageEnteredAt: now,
        lastStageMovedAt: now,
        lastActivityAt: now,
        isWon: stage.isWon,
        isLost: stage.isLost,
        wonAt: stage.isWon ? now : undefined,
        lostAt: stage.isLost ? now : undefined,
      },
      include: {
        patient: true,
        stage: true,
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
          body: `Moved to ${stage.name}`,
          metadata: {
            fromStageId: opportunity.stageId,
            fromStageName: opportunity.stage?.name ?? null,
            toStageId: stage.id,
            toStageName: stage.name,
            opportunityId: id,
          },
        },
      });
    }

    return NextResponse.json(updatedOpportunity);
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
