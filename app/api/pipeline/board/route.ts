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

    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: "asc" },
      include: {
        opportunities: {
          where: {
            deletedAt: null,
            isArchived: false,
            closedStatus: null,
          },
          orderBy: { stageEnteredAt: "desc" },
          include: {
            patient: true,
            assignedTo: true,
            provider: true,
            opportunityProcedures: {
              include: { procedureType: true },
            },
            appointments: {
              where: {
                startTime: { gte: new Date() },
                deletedAt: null,
              },
              orderBy: { startTime: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    const closedOpportunities = await prisma.opportunity.findMany({
      where: {
        pipelineId: pipeline.id,
        practiceId: practice.id,
        deletedAt: null,
        isArchived: false,
        closedStatus: { not: null },
      },
      orderBy: { closedAt: "desc" },
      include: {
        patient: true,
        assignedTo: true,
        provider: true,
        opportunityProcedures: {
          include: { procedureType: true },
        },
      },
    });

    const now = new Date();

    let allDaysInStage: number[] = [];
    let totalWon = 0;
    let totalLost = 0;
    let pipelineTotalValue = 0;
    let atRiskValue = 0;

    const formattedStages = stages.map((stage) => {
      let stageTotalValue = 0;

      const opportunities = stage.opportunities.map((opp) => {
        const stageEnteredAt = opp.stageEnteredAt ? new Date(opp.stageEnteredAt) : new Date(opp.createdAt);
        const daysInStage = Math.floor((now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24));

        const thresholdMs = stage.rottingThresholdHours * 60 * 60 * 1000;
        const lastActivity = opp.lastActivityAt ? new Date(opp.lastActivityAt) : stageEnteredAt;
        const timeSinceActivity = now.getTime() - lastActivity.getTime();
        const isRotting = timeSinceActivity > thresholdMs;
        const rottingDays = isRotting
          ? Math.floor((timeSinceActivity - thresholdMs) / (1000 * 60 * 60 * 24))
          : 0;

        const estimatedValue = opp.value ? Number(opp.value) : 0;
        stageTotalValue += estimatedValue;

        if (!opp.isWon && !opp.isLost) {
          pipelineTotalValue += estimatedValue;
          allDaysInStage.push(daysInStage);
          if (isRotting) {
            atRiskValue += estimatedValue;
          }
        }

        if (opp.isWon) totalWon++;
        if (opp.isLost) totalLost++;

        let status = "active";
        if (opp.isWon) status = "won";
        else if (opp.isLost) status = "lost";
        else if (isRotting) status = "rotting";

        const nextAppointment = opp.appointments[0]
          ? {
              id: opp.appointments[0].id,
              startTime: opp.appointments[0].startTime,
              title: opp.appointments[0].title,
            }
          : null;

        return {
          id: opp.id,
          patientName: `${opp.patient.firstName} ${opp.patient.lastName}`,
          procedureName: opp.title,
          estimatedValue,
          assignedToName: opp.assignedTo
            ? `${opp.assignedTo.firstName} ${opp.assignedTo.lastName}`
            : null,
          assignedToId: opp.assignedToId,
          leadSource: opp.referralSource || opp.patient.referralSource || null,
          lastActivityAt: opp.lastActivityAt,
          createdAt: opp.createdAt,
          daysInStage,
          isRotting,
          rottingDays,
          status,
          nextAppointment,
          procedureTypeIds: opp.opportunityProcedures.map((op: any) => op.procedureTypeId),
          tags: opp.patient.tags ?? [],
          providerId: opp.providerId,
          providerName: opp.provider
            ? `${opp.provider.firstName} ${opp.provider.lastName}`
            : null,
        };
      });

      return {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        rottingThresholdHours: stage.rottingThresholdHours,
        order: stage.order,
        isWon: stage.isWon,
        isLost: stage.isLost,
        opportunities,
        totalValue: stageTotalValue,
        count: opportunities.length,
      };
    });

    const velocity =
      allDaysInStage.length > 0
        ? Math.round(allDaysInStage.reduce((a, b) => a + b, 0) / allDaysInStage.length)
        : 0;

    const winRate =
      totalWon + totalLost > 0
        ? Math.round((totalWon / (totalWon + totalLost)) * 100)
        : 0;

    const pipelines = await prisma.pipeline.findMany({
      where: { practiceId: practice.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
    });

    const wonOpps = closedOpportunities.filter((o) => o.closedStatus === "WON");
    const lostOpps = closedOpportunities.filter((o) => o.closedStatus === "LOST");

    const formatClosedOpp = (opp: typeof closedOpportunities[0]) => ({
      id: opp.id,
      patientName: `${opp.patient.firstName} ${opp.patient.lastName}`,
      procedureName: opp.title,
      estimatedValue: opp.value ? Number(opp.value) : 0,
      assignedToName: opp.assignedTo ? `${opp.assignedTo.firstName} ${opp.assignedTo.lastName}` : null,
      assignedToId: opp.assignedToId,
      leadSource: opp.referralSource || opp.patient.referralSource || null,
      lastActivityAt: opp.lastActivityAt,
      createdAt: opp.createdAt,
      closedAt: opp.closedAt,
      closedStatus: opp.closedStatus,
      closedLostReason: opp.closedLostReason,
      lostNote: opp.lostNote,
      daysInStage: 0,
      isRotting: false,
      rottingDays: 0,
      status: opp.closedStatus === "WON" ? "won" : "lost",
      nextAppointment: null,
      procedureTypeIds: opp.opportunityProcedures.map((op: any) => op.procedureTypeId),
      tags: opp.patient.tags ?? [],
      providerId: opp.providerId,
      providerName: opp.provider ? `${opp.provider.firstName} ${opp.provider.lastName}` : null,
    });

    return NextResponse.json({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        totalValue: pipelineTotalValue,
        velocity,
        winRate,
        atRisk: atRiskValue,
      },
      stages: formattedStages,
      pipelines,
      closedColumns: {
        won: {
          opportunities: wonOpps.map(formatClosedOpp),
          count: wonOpps.length,
          totalValue: wonOpps.reduce((sum, o) => sum + (o.value ? Number(o.value) : 0), 0),
        },
        lost: {
          opportunities: lostOpps.map(formatClosedOpp),
          count: lostOpps.length,
          totalValue: lostOpps.reduce((sum, o) => sum + (o.value ? Number(o.value) : 0), 0),
        },
      },
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
