import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";
import { normalizePhone, stripNonDigits } from "@/lib/phone";
import { generateChartId } from "@/lib/chartId";

export async function POST(request: Request) {
  try {
    const practice = await requirePractice();

    const body = await request.json();
    const {
      firstName,
      lastName,
      phone,
      email,
      procedureTypeIds,
      title,
      estimatedValue,
      leadSource,
      assignedToId,
      stageId,
      pipelineId,
      notes,
      force,
      patientId: existingPatientId,
      countryDialCode,
    } = body;

    const isExistingPatientFlow = !!existingPatientId;

    if (!isExistingPatientFlow && (!firstName || !lastName || !phone)) {
      return NextResponse.json(
        { error: "firstName, lastName, and phone are required for new patients" },
        { status: 400 }
      );
    }

    if (!stageId || !pipelineId) {
      return NextResponse.json(
        { error: "stageId and pipelineId are required" },
        { status: 400 }
      );
    }

    if (!procedureTypeIds || !Array.isArray(procedureTypeIds) || procedureTypeIds.length === 0) {
      return NextResponse.json(
        { error: "At least one procedure type must be selected" },
        { status: 400 }
      );
    }

    const validProcedureTypes = await prisma.procedureType.findMany({
      where: {
        id: { in: procedureTypeIds },
        practiceId: practice.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const validPtIds = validProcedureTypes.map((pt) => pt.id);
    if (validPtIds.length === 0) {
      return NextResponse.json(
        { error: "No valid procedure types found" },
        { status: 400 }
      );
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, practiceId: practice.id },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId },
    });

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const normalizedPhone = phone ? normalizePhone(stripNonDigits(phone), countryDialCode || "1") : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    const referralSource = leadSource as string | undefined;
    const now = new Date();

    let patientId: string;
    let isExistingPatient = false;

    if (isExistingPatientFlow) {
      const existing = await prisma.patient.findFirst({
        where: { id: existingPatientId, practiceId: practice.id, deletedAt: null },
      });
      if (!existing) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 });
      }
      patientId = existing.id;
      isExistingPatient = true;
    } else if (!force) {
      const duplicateConditions: any[] = [];
      if (normalizedPhone) {
        const digits10 = stripNonDigits(phone).slice(-10);
        duplicateConditions.push({ practiceId: practice.id, phone: { endsWith: digits10 } });
      }
      if (normalizedEmail) {
        duplicateConditions.push({ practiceId: practice.id, email: { equals: normalizedEmail, mode: "insensitive" } });
      }

      if (duplicateConditions.length > 0) {
        const existingPatient = await prisma.patient.findFirst({
          where: {
            OR: duplicateConditions,
            deletedAt: null,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            updatedAt: true,
          },
        });

        if (existingPatient) {
          return NextResponse.json({
            duplicate: true,
            existingPatient: {
              id: existingPatient.id,
              firstName: existingPatient.firstName,
              lastName: existingPatient.lastName,
              phone: existingPatient.phone,
              email: existingPatient.email,
              lastActivityAt: existingPatient.updatedAt,
            },
          });
        }
      }

      let chartId: string;
      do {
        chartId = generateChartId();
      } while (await prisma.patient.findFirst({ where: { chartId } }));

      const patient = await prisma.patient.create({
        data: {
          practiceId: practice.id,
          chartId,
          firstName,
          lastName,
          phone: normalizedPhone,
          email: normalizedEmail || null,
          referralSource: referralSource || null,
          status: "LEAD",
        },
      });
      patientId = patient.id;
    } else {
      const dupConditions: any[] = [];
      if (normalizedPhone) {
        const digits10 = stripNonDigits(phone).slice(-10);
        dupConditions.push({ phone: { endsWith: digits10 } });
      }
      if (normalizedEmail) {
        dupConditions.push({ email: { equals: normalizedEmail, mode: "insensitive" } });
      }

      const existingPatient = dupConditions.length > 0
        ? await prisma.patient.findFirst({
            where: {
              practiceId: practice.id,
              deletedAt: null,
              OR: dupConditions,
            },
          })
        : null;

      if (existingPatient) {
        patientId = existingPatient.id;
        isExistingPatient = true;
      } else {
        let newChartId: string;
        do {
          newChartId = generateChartId();
        } while (await prisma.patient.findFirst({ where: { chartId: newChartId } }));

        const patient = await prisma.patient.create({
          data: {
            practiceId: practice.id,
            chartId: newChartId,
            firstName,
            lastName,
            phone: normalizedPhone,
            email: normalizedEmail || null,
            referralSource: referralSource || null,
            status: "LEAD",
          },
        });
        patientId = patient.id;
      }
    }

    const opportunityTitle = title || "New Deal";

    const opportunity = await prisma.opportunity.create({
      data: {
        practiceId: practice.id,
        patientId,
        pipelineId,
        stageId,
        title: opportunityTitle,
        value: estimatedValue ? parseFloat(String(estimatedValue)) : null,
        referralSource: referralSource || null,
        assignedToId: assignedToId || null,
        lastActivityAt: now,
        stageEnteredAt: now,
        lastStageMovedAt: now,
      },
      include: {
        patient: true,
        stage: true,
        pipeline: true,
      },
    });

    if (validPtIds.length > 0) {
      await prisma.opportunityProcedure.createMany({
        data: validPtIds.map((ptId: string) => ({
          opportunityId: opportunity.id,
          procedureTypeId: ptId,
        })),
      });
    }

    const user = await prisma.user.findFirst({
      where: { practiceId: practice.id, deletedAt: null },
    });

    if (user) {
      await prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId,
          opportunityId: opportunity.id,
          userId: user.id,
          type: "NOTE",
          body: notes || "New deal created",
          metadata: {
            action: "lead_created",
            opportunityId: opportunity.id,
            patientId,
            pipelineId,
            stageId,
            stageName: stage.name,
            isExistingPatient,
            procedureTypeIds: validPtIds,
            title: opportunityTitle,
            estimatedValue: estimatedValue ? parseFloat(String(estimatedValue)) : null,
            leadSource: referralSource || null,
          },
        },
      });
    }

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("Create opportunity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
