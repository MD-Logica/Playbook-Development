import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET() {
  try {
    const practice = await requirePractice();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [todayTotal, todayConfirmed, todayPending, todayHold, rottingLeads] =
      await Promise.all([
        prisma.appointment.count({
          where: {
            practiceId: practice.id,
            startTime: { gte: todayStart, lt: todayEnd },
          },
        }),
        prisma.appointment.count({
          where: {
            practiceId: practice.id,
            startTime: { gte: todayStart, lt: todayEnd },
            status: "CONFIRMED",
          },
        }),
        prisma.appointment.count({
          where: {
            practiceId: practice.id,
            startTime: { gte: todayStart, lt: todayEnd },
            status: "PENDING",
          },
        }),
        prisma.appointment.count({
          where: {
            practiceId: practice.id,
            startTime: { gte: todayStart, lt: todayEnd },
            status: "HOLD",
          },
        }),
        prisma.opportunity.count({
          where: {
            practiceId: practice.id,
            lastActivityAt: { lt: sevenDaysAgo },
            isWon: false,
            isLost: false,
            deletedAt: null,
          },
        }),
      ]);

    return NextResponse.json({
      todayTotal,
      todayConfirmed,
      todayPending,
      todayHold,
      rottingLeads,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
