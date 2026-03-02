import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const expiredQuotes = await prisma.quote.findMany({
      where: {
        status: { notIn: ["CONVERTED", "EXPIRED"] },
        expirationDate: { not: null, lt: now },
        deletedAt: null,
      },
      include: {
        opportunity: { select: { id: true, patientId: true, practiceId: true } },
        coordinator: { select: { id: true } },
      },
    });

    let expired = 0;

    for (const quote of expiredQuotes) {
      await prisma.$transaction([
        prisma.quote.update({
          where: { id: quote.id },
          data: { status: "EXPIRED" },
        }),
        ...(quote.opportunity
          ? [
              prisma.activity.create({
                data: {
                  practiceId: quote.practiceId,
                  patientId: quote.opportunity.patientId,
                  userId: quote.coordinatorId,
                  opportunityId: quote.opportunity.id,
                  type: "NOTE" as const,
                  body: `Quote ${quote.quoteNumber || quote.id} has expired`,
                  metadata: {
                    action: "quote_expired",
                    quoteId: quote.id,
                    quoteNumber: quote.quoteNumber,
                    opportunityId: quote.opportunity.id,
                  } as any,
                },
              }),
            ]
          : []),
      ]);

      expired++;
    }

    return NextResponse.json({ expired });
  } catch (error: any) {
    console.error("POST /api/cron/check-expiring-quotes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
