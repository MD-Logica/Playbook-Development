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

    const opportunity = await prisma.opportunity.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: { stage: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        closedStatus: null,
        closedLostReason: null,
        lostNote: null,
        closedAt: null,
        isWon: false,
        isLost: false,
        lostReason: null,
        wonAt: null,
        lostAt: null,
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
          body: "Reopened deal",
          metadata: {
            fromStageId: opportunity.stageId,
            fromStageName: opportunity.closedStatus === "WON" ? "Won" : opportunity.closedStatus === "LOST" ? "Lost" : (opportunity.stage?.name ?? null),
            toStageId: opportunity.stageId,
            toStageName: opportunity.stage?.name ?? null,
            opportunityId: id,
            action: "reopen",
          },
        },
      });
    }

    return NextResponse.json(updated);
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
