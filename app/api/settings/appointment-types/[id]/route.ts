import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();
    const { name, color, durationMins, bufferMins, description } = body;

    const existing = await prisma.configuredAppointmentType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Appointment type not found" }, { status: 404 });
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      if (name.trim().length > 48) {
        return NextResponse.json({ error: "Name must be 48 characters or less" }, { status: 400 });
      }
      const duplicate = await prisma.configuredAppointmentType.findFirst({
        where: {
          practiceId: practice.id,
          name: { equals: name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: "An appointment type with this name already exists" }, { status: 409 });
      }
    }

    const updated = await prisma.configuredAppointmentType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(durationMins !== undefined && { durationMins }),
        ...(bufferMins !== undefined && { bufferMins }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
      include: {
        subcategories: { orderBy: { createdAt: "asc" } },
        _count: { select: { appointments: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const existing = await prisma.configuredAppointmentType.findFirst({
      where: { id, practiceId: practice.id },
      include: { _count: { select: { appointments: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Appointment type not found" }, { status: 404 });
    }
    if (existing.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived appointment types can be permanently deleted" }, { status: 400 });
    }
    if (existing._count.appointments > 0) {
      return NextResponse.json({ error: "Cannot delete an appointment type that has been used in appointments" }, { status: 400 });
    }

    await prisma.configuredAppointmentType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
