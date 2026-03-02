import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();

    const { id } = await params;

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        practiceId: practice.id,
        deletedAt: null,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            isVip: true,
            tags: true,
            dateOfBirth: true,
            referralSource: true,
          },
        },
        opportunityProcedures: {
          include: {
            procedureType: {
              select: { id: true, name: true, category: true },
            },
          },
        },
        stage: { select: { name: true, color: true, order: true } },
        pipeline: { select: { name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        appointments: {
          where: { deletedAt: null },
          orderBy: { startTime: "asc" },
          include: {
            provider: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        quotes: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            quoteNumber: true,
            title: true,
            status: true,
            total: true,
            expirationDate: true,
            createdAt: true,
            coordinator: { select: { id: true, firstName: true, lastName: true } },
            lineItems: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, name: true, unitPrice: true, quantity: true },
            },
          },
        },
        forms: {
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            payments: {
              orderBy: { paymentDate: "desc" },
              include: {
                recorder: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            quote: { select: { id: true, status: true, quoteNumber: true } },
            coordinator: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    const users = await prisma.user.findMany({
      where: { practiceId: practice.id, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: { firstName: "asc" },
    });

    const pipelineStages = await prisma.pipelineStage.findMany({
      where: { pipelineId: opportunity.pipelineId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, order: true, isWon: true, isLost: true },
    });

    const allPipelines = await prisma.pipeline.findMany({
      where: { practiceId: practice.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      ...opportunity,
      value: opportunity.value ? Number(opportunity.value) : null,
      users,
      pipelineStages,
      allPipelines,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/opportunities/[id]/panel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
