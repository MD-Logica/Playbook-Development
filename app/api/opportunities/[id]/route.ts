import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();

    const { id } = await params;
    const body = await request.json();

    const opportunity = await prisma.opportunity.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim() === "") {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      updateData.title = body.title.trim();
    }

    if (body.coordinatorId !== undefined) {
      if (body.coordinatorId === null) {
        updateData.assignedToId = null;
      } else {
        const user = await prisma.user.findFirst({
          where: { id: body.coordinatorId, practiceId: practice.id },
        });
        if (!user) {
          return NextResponse.json({ error: "Coordinator not found" }, { status: 404 });
        }
        updateData.assignedToId = body.coordinatorId;
      }
    }

    if (body.providerId !== undefined) {
      if (body.providerId === null) {
        updateData.providerId = null;
      } else {
        const user = await prisma.user.findFirst({
          where: { id: body.providerId, practiceId: practice.id },
        });
        if (!user) {
          return NextResponse.json({ error: "Provider not found" }, { status: 404 });
        }
        updateData.providerId = body.providerId;
      }
    }

    if (body.value !== undefined) {
      updateData.value = body.value;
    }

    if (body.referralSource !== undefined) {
      updateData.referralSource = body.referralSource || null;
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (body.procedureTypeIds !== undefined && Array.isArray(body.procedureTypeIds)) {
      const validPts = await prisma.procedureType.findMany({
        where: { id: { in: body.procedureTypeIds }, practiceId: practice.id, status: "ACTIVE" },
        select: { id: true },
      });
      const validIds = validPts.map((pt) => pt.id);

      await prisma.opportunityProcedure.deleteMany({
        where: { opportunityId: id },
      });

      if (validIds.length > 0) {
        await prisma.opportunityProcedure.createMany({
          data: validIds.map((ptId) => ({
            opportunityId: id,
            procedureTypeId: ptId,
          })),
        });
      }

      const updatedProcs = await prisma.opportunityProcedure.findMany({
        where: { opportunityId: id },
        include: { procedureType: { select: { id: true, name: true, category: true } } },
      });

      return NextResponse.json({ ...updated, opportunityProcedures: updatedProcs });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/opportunities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
