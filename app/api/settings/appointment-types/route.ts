import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: any = { practiceId: practice.id };
    if (!includeArchived) {
      where.status = "ACTIVE";
    }

    const types = await prisma.configuredAppointmentType.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        subcategories: { orderBy: { createdAt: "asc" } },
        _count: { select: { appointments: true } },
      },
    });

    const now = new Date();
    const result = await Promise.all(
      types.map(async (t) => {
        const upcomingCount = await prisma.appointment.count({
          where: {
            appointmentTypeId: t.id,
            startTime: { gte: now },
            deletedAt: null,
          },
        });
        return {
          ...t,
          appointmentCount: t._count.appointments,
          upcomingAppointmentCount: upcomingCount,
          _count: undefined,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { name, color, durationMins, bufferMins, description, subcategories } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.trim().length > 48) {
      return NextResponse.json({ error: "Name must be 48 characters or less" }, { status: 400 });
    }
    if (!color) {
      return NextResponse.json({ error: "Color is required" }, { status: 400 });
    }
    if (!durationMins || durationMins < 1) {
      return NextResponse.json({ error: "Duration must be at least 1 minute" }, { status: 400 });
    }

    const existing = await prisma.configuredAppointmentType.findFirst({
      where: {
        practiceId: practice.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "An appointment type with this name already exists" }, { status: 409 });
    }

    const created = await prisma.configuredAppointmentType.create({
      data: {
        name: name.trim(),
        color,
        durationMins,
        bufferMins: bufferMins || 0,
        description: description?.trim() || null,
        practiceId: practice.id,
      },
      include: { subcategories: true },
    });

    if (subcategories && Array.isArray(subcategories) && subcategories.length > 0) {
      for (const sub of subcategories) {
        if (sub.name && sub.name.trim()) {
          await prisma.appointmentSubcategory.create({
            data: {
              name: sub.name.trim(),
              appointmentTypeId: created.id,
              practiceId: practice.id,
            },
          });
        }
      }
    }

    const result = await prisma.configuredAppointmentType.findUnique({
      where: { id: created.id },
      include: {
        subcategories: { orderBy: { createdAt: "asc" } },
        _count: { select: { appointments: true } },
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
