import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const apptType = await prisma.configuredAppointmentType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!apptType) {
      return NextResponse.json({ error: "Appointment type not found" }, { status: 404 });
    }

    const existing = await prisma.appointmentSubcategory.findFirst({
      where: {
        appointmentTypeId: id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A subcategory with this name already exists" }, { status: 409 });
    }

    const sub = await prisma.appointmentSubcategory.create({
      data: {
        name: name.trim(),
        appointmentTypeId: id,
        practiceId: practice.id,
      },
    });

    return NextResponse.json(sub, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
