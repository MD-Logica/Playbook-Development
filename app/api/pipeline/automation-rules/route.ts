import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const practice = await requirePractice();

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId is required" }, { status: 400 });
    }

    const rules = await prisma.pipelineAutomationRule.findMany({
      where: { pipelineId, practiceId: practice.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(rules);
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

export async function POST(request: Request) {
  try {
    const practice = await requirePractice();

    const body = await request.json();
    const { pipelineId, name, triggerType, triggerStageId, actionType, actionValue, isActive } = body;

    if (!pipelineId || !name || !triggerType || !actionType) {
      return NextResponse.json(
        { error: "pipelineId, name, triggerType, and actionType are required" },
        { status: 400 }
      );
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, practiceId: practice.id },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const rule = await prisma.pipelineAutomationRule.create({
      data: {
        practiceId: practice.id,
        pipelineId,
        name,
        triggerType,
        triggerStageId: triggerStageId || null,
        actionType,
        actionValue: actionValue || null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
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
