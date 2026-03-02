import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const practice = await requirePractice();
    const { id, subId } = await params;
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

    const sub = await prisma.appointmentSubcategory.findFirst({
      where: { id: subId, appointmentTypeId: id },
    });
    if (!sub) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    const duplicate = await prisma.appointmentSubcategory.findFirst({
      where: {
        appointmentTypeId: id,
        name: { equals: name.trim(), mode: "insensitive" },
        id: { not: subId },
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: "A subcategory with this name already exists" }, { status: 409 });
    }

    const updated = await prisma.appointmentSubcategory.update({
      where: { id: subId },
      data: { name: name.trim() },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const practice = await requirePractice();
    const { id, subId } = await params;

    const apptType = await prisma.configuredAppointmentType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!apptType) {
      return NextResponse.json({ error: "Appointment type not found" }, { status: 404 });
    }

    const sub = await prisma.appointmentSubcategory.findFirst({
      where: { id: subId, appointmentTypeId: id },
    });
    if (!sub) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    await prisma.appointmentSubcategory.delete({ where: { id: subId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
