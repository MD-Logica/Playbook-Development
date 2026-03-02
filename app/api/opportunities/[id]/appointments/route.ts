import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id: opportunityId } = await params;

    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, practiceId: practice.id, deletedAt: null },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        opportunityId,
        practiceId: practice.id,
        deletedAt: null,
      },
      orderBy: { startTime: "asc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true, durationMins: true, bufferMins: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(appointments);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/opportunities/[id]/appointments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
