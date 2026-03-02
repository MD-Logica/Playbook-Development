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

    const rule = await prisma.pipelineAutomationRule.findFirst({
      where: { id, practiceId: practice.id },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType;
    if (body.triggerStageId !== undefined) updateData.triggerStageId = body.triggerStageId;
    if (body.actionType !== undefined) updateData.actionType = body.actionType;
    if (body.actionValue !== undefined) updateData.actionValue = body.actionValue;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updatedRule = await prisma.pipelineAutomationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedRule);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
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

    const rule = await prisma.pipelineAutomationRule.findFirst({
      where: { id, practiceId: practice.id },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.pipelineAutomationRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
