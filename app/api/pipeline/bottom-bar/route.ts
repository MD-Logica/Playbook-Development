import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const practice = await requirePractice();

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");

    let pipeline;
    if (pipelineId) {
      pipeline = await prisma.pipeline.findFirst({
        where: { id: pipelineId, practiceId: practice.id },
      });
    } else {
      pipeline = await prisma.pipeline.findFirst({
        where: { practiceId: practice.id, isDefault: true },
      });
      if (!pipeline) {
        pipeline = await prisma.pipeline.findFirst({
          where: { practiceId: practice.id },
        });
      }
    }

    if (!pipeline) {
      return NextResponse.json({ error: "No pipeline found" }, { status: 404 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: "asc" },
    });

    const firstStage = stages[0];
    const wonStageIds = stages.filter((s) => s.isWon).map((s) => s.id);

    const opportunities = await prisma.opportunity.findMany({
      where: {
        pipelineId: pipeline.id,
        practiceId: practice.id,
        deletedAt: null,
        isArchived: false,
      },
    });

    let todaysActions = 0;
    let closingThisWeek = 0;
    let stalledCount = 0;

    for (const opp of opportunities) {
      const stageConfig = stages.find((s) => s.id === opp.stageId);
      if (!stageConfig) continue;

      const thresholdMs = stageConfig.rottingThresholdHours * 60 * 60 * 1000;
      const lastActivity = opp.lastActivityAt ? new Date(opp.lastActivityAt) : new Date(opp.stageEnteredAt);
      const timeSinceActivity = now.getTime() - lastActivity.getTime();
      const isRotting = timeSinceActivity > thresholdMs && !opp.isWon && !opp.isLost;

      if (isRotting) {
        stalledCount++;
      }

      if (firstStage && opp.stageId === firstStage.id && !opp.isWon && !opp.isLost) {
        if (isRotting) {
          todaysActions++;
        }
        const enteredAt = new Date(opp.stageEnteredAt);
        if (enteredAt >= todayStart) {
          todaysActions++;
        }
      }

      if (wonStageIds.includes(opp.stageId) || opp.isWon) {
        const wonAt = opp.wonAt ? new Date(opp.wonAt) : null;
        if (wonAt && wonAt >= todayStart && wonAt <= weekFromNow) {
          closingThisWeek += opp.value ? Number(opp.value) : 0;
        } else if (!wonAt && wonStageIds.includes(opp.stageId)) {
          closingThisWeek += opp.value ? Number(opp.value) : 0;
        }
      }
    }

    const stalledLabel = stalledCount > 0 ? `${stalledCount} deals` : "Pipeline healthy";

    return NextResponse.json({
      todaysActions,
      closingThisWeek,
      stalledCount,
      stalledLabel,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
