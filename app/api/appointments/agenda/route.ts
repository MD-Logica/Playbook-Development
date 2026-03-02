import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const { searchParams } = new URL(req.url);

    const providerId = searchParams.get("providerId");
    const days = parseInt(searchParams.get("days") || "30");
    const offsetDays = parseInt(searchParams.get("offset") || "0");

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + offsetDays);

    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const where: any = {
      practiceId: practice.id,
      deletedAt: null,
      startTime: { gte: start, lt: end },
      status: { notIn: ["CANCELLED"] },
    };

    if (providerId && providerId !== "all") {
      where.providerId = providerId;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true } },
        subcategory: { select: { id: true, name: true } },
        attendees: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json(appointments);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
