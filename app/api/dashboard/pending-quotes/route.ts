import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET() {
  try {
    const practice = await requirePractice();

    const pendingQuotes = await prisma.quote.findMany({
      where: {
        practiceId: practice.id,
        status: "SENT",
        deletedAt: null,
      },
      orderBy: { sentAt: "asc" },
      take: 4,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        total: true,
        sentAt: true,
        expirationDate: true,
        patient: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json(pendingQuotes);
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
