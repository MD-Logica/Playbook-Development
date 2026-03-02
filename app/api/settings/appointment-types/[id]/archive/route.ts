import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const existing = await prisma.configuredAppointmentType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Appointment type not found" }, { status: 404 });
    }

    const updated = await prisma.configuredAppointmentType.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
