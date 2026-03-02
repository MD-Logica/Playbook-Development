import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

const VALID_REASONS = [
  "COMPETITOR",
  "PRICE_BUDGET",
  "UNRESPONSIVE",
  "NOT_A_CANDIDATE",
  "DISTANCE_LOCATION",
  "OTHER",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const body = await request.json();
    const { reason, note } = body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: "Valid reason is required" }, { status: 400 });
    }

    const opportunity = await prisma.opportunity.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: { stage: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const now = new Date();

    const REASON_LABELS: Record<string, string> = {
      COMPETITOR: "Competitor",
      PRICE_BUDGET: "Price / Budget",
      UNRESPONSIVE: "Unresponsive",
      NOT_A_CANDIDATE: "Not a Candidate",
      DISTANCE_LOCATION: "Distance / Location",
      OTHER: "Other",
    };

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        closedStatus: "LOST",
        closedLostReason: reason,
        lostNote: note || null,
        closedAt: now,
        isWon: false,
        isLost: true,
        lostReason: REASON_LABELS[reason] || reason,
        lostAt: now,
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
          body: `Marked as Lost — ${REASON_LABELS[reason] || reason}`,
          metadata: {
            fromStageId: opportunity.stageId,
            fromStageName: opportunity.stage?.name ?? null,
            toStageId: null,
            toStageName: "Lost",
            opportunityId: id,
            action: "lost",
            reason,
            reasonLabel: REASON_LABELS[reason] || reason,
            note: note || null,
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
