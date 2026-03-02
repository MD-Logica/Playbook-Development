import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();

    const { id } = await params;
    const body = await request.json();
    const { body: noteBody, isInternal } = body;

    if (!noteBody || typeof noteBody !== "string" || noteBody.trim() === "") {
      return NextResponse.json({ error: "Note body is required" }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
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
        patientId: id,
        userId: user.id,
        type: "NOTE",
        body: noteBody.trim(),
        isInternal: isInternal || false,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
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
    console.error("POST /api/patients/[id]/notes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
