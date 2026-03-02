import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

const VALID_ACTIVITY_TYPES = [
  "NOTE", "CALL", "SMS", "EMAIL", "APPOINTMENT", "QUOTE",
  "INVOICE", "PAYMENT", "CONSENT", "DOCUMENT", "PHOTO",
  "TASK", "STAGE_CHANGE", "SYSTEM",
] as const;

export async function POST(request: Request) {
  try {
    const practice = await requirePractice();

    const body = await request.json();
    const { patientId, opportunityId, type, body: activityBody, isInternal, metadata } = body;

    if (!patientId || !type) {
      return NextResponse.json(
        { error: "patientId and type are required" },
        { status: 400 }
      );
    }

    if (!VALID_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_ACTIVITY_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, practiceId: practice.id, deletedAt: null },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found in this practice" }, { status: 404 });
    }

    if (opportunityId) {
      const opportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, practiceId: practice.id, deletedAt: null },
      });

      if (!opportunity) {
        return NextResponse.json({ error: "Deal not found in this practice" }, { status: 404 });
      }
    }

    const user = await prisma.user.findFirst({
      where: { practiceId: practice.id },
    });

    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    const activity = await prisma.activity.create({
      data: {
        practiceId: practice.id,
        patientId,
        opportunityId: opportunityId || null,
        userId: user.id,
        type,
        body: activityBody || null,
        isInternal: isInternal || false,
        metadata: metadata || null,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
