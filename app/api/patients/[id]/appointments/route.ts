import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id: patientId } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, practiceId: practice.id, deletedAt: null },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        practiceId: practice.id,
        deletedAt: null,
      },
      orderBy: { startTime: "desc" },
      include: {
        provider: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true, durationMins: true, bufferMins: true } },
        subcategory: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(appointments);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/patients/[id]/appointments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
