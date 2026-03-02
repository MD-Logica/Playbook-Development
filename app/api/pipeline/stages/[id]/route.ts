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

    const stage = await prisma.pipelineStage.findFirst({
      where: {
        id,
        pipeline: { practiceId: practice.id },
      },
      include: { pipeline: true },
    });

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.rottingThresholdHours !== undefined) updateData.rottingThresholdHours = body.rottingThresholdHours;
    if (body.rottingEnabled !== undefined) updateData.rottingEnabled = body.rottingEnabled;
    if (body.rottingValue !== undefined) updateData.rottingValue = body.rottingValue;
    if (body.rottingUnit !== undefined) updateData.rottingUnit = body.rottingUnit;
    if (body.isWon !== undefined) updateData.isWon = body.isWon;
    if (body.isLost !== undefined) updateData.isLost = body.isLost;
    if (body.order !== undefined) updateData.order = body.order;

    const updatedStage = await prisma.pipelineStage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedStage);
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();

    const { id } = await params;

    const stage = await prisma.pipelineStage.findFirst({
      where: {
        id,
        pipeline: { practiceId: practice.id },
      },
      include: { pipeline: true },
    });

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const opportunityCount = await prisma.opportunity.count({
      where: { stageId: id },
    });

    if (opportunityCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete stage with existing deals" },
        { status: 400 }
      );
    }

    await prisma.pipelineStage.delete({ where: { id } });

    return NextResponse.json({ success: true });
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
