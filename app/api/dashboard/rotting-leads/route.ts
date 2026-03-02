import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET() {
  try {
    const practice = await requirePractice();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rottingLeads = await prisma.opportunity.findMany({
      where: {
        practiceId: practice.id,
        lastActivityAt: { not: null, lt: sevenDaysAgo },
        isWon: false,
        isLost: false,
        deletedAt: null,
      },
      orderBy: { lastActivityAt: "asc" },
      take: 5,
      include: {
        patient: {
          select: { firstName: true, lastName: true },
        },
        stage: {
          select: { name: true },
        },
        assignedTo: {
          select: { firstName: true },
        },
      },
    });

    return NextResponse.json(rottingLeads);
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
