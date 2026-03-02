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

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: practice.id,
        deletedAt: null,
      },
      include: {
        referredBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        parentGuardian: {
          select: { id: true, firstName: true, lastName: true },
        },
        opportunities: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            stage: { select: { name: true, color: true } },
            pipeline: { select: { name: true } },
            assignedTo: { select: { firstName: true, lastName: true } },
          },
        },
        appointments: {
          where: { deletedAt: null },
          orderBy: { startTime: "asc" },
          include: {
            provider: { select: { firstName: true, lastName: true } },
          },
        },
        invoices: {
          where: { deletedAt: null },
          select: { total: true, status: true, amountPaid: true },
        },
        treatmentPlans: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const lifetimeValue = patient.invoices
      .filter((inv) => inv.status === "PAID")
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const totalBilled = patient.invoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0
    );

    const totalPaid = patient.invoices.reduce(
      (sum, inv) => sum + Number(inv.amountPaid),
      0
    );

    const outstandingBalance = totalBilled - totalPaid;

    return NextResponse.json({
      ...patient,
      referredByPatient: patient.referredBy,
      lifetimeValue,
      totalBilled,
      totalPaid,
      outstandingBalance,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/patients/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await request.json();

    const patient = await prisma.patient.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (body.referralSource !== undefined) {
      updateData.referralSource = body.referralSource || null;
    }

    const updated = await prisma.patient.update({
      where: { id },
      data: updateData,
      select: { id: true, referralSource: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/patients/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
