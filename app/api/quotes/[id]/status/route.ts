import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { practice, user } = await requireUser();
    const { id } = await params;
    const { status } = await req.json();

    const validStatuses = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "CONVERTED", "EXPIRED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.quote.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: { opportunity: { select: { id: true, patientId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const updateData: any = { status };
    if (status === "SENT" && !existing.sentAt) updateData.sentAt = new Date();
    if (status === "ACCEPTED") updateData.acceptedAt = new Date();
    if (status === "DECLINED") updateData.declinedAt = new Date();

    const quote = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        coordinator: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (existing.opportunity) {
      const actionMap: Record<string, string> = {
        SENT: "quote_sent",
        ACCEPTED: "quote_accepted",
        DECLINED: "quote_declined",
      };
      const action = actionMap[status];
      if (action) {
        await prisma.activity.create({
          data: {
            practiceId: practice.id,
            patientId: existing.opportunity.patientId,
            userId: user.id,
            type: "NOTE",
            body: `Quote ${existing.quoteNumber || existing.id} ${status.toLowerCase()}`,
            metadata: {
              action,
              quoteId: id,
              quoteNumber: existing.quoteNumber,
              opportunityId: existing.opportunity.id,
            },
          },
        });
      }
    }

    return NextResponse.json(quote);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/quotes/[id]/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
