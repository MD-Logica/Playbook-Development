import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const ALLOWED_ICONS = [
  "check-circle", "dollar-sign", "file-text", "clipboard", "shield",
  "heart", "user-check", "calendar-check", "camera", "pill", "stethoscope",
];

const VALID_INTEGRATION_TYPES = ["MANUAL", "STRIPE", "DOCUSIGN", "PANDADOC"];

const DEFAULT_INDICATORS = [
  { sortOrder: 0, label: "Consultation Fee", icon: "dollar-sign", integrationType: "STRIPE" as const },
  { sortOrder: 1, label: "Consent Forms", icon: "file-text", integrationType: "DOCUSIGN" as const },
  { sortOrder: 2, label: "Intake Forms", icon: "clipboard", integrationType: "MANUAL" as const },
];

export async function GET() {
  try {
    const { practice } = await requireUser();

    const count = await prisma.readinessIndicator.count({
      where: { practiceId: practice.id },
    });

    if (count === 0) {
      await prisma.readinessIndicator.createMany({
        data: DEFAULT_INDICATORS.map((i) => ({ ...i, practiceId: practice.id })),
      });
    }

    const indicators = await prisma.readinessIndicator.findMany({
      where: { practiceId: practice.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(indicators);
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { practice } = await requireUser();
    const body = await request.json();

    const { label, icon, integrationType } = body;

    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (label.trim().length > 50) {
      return NextResponse.json({ error: "Label must be 50 characters or less" }, { status: 400 });
    }
    if (icon && !ALLOWED_ICONS.includes(icon)) {
      return NextResponse.json({ error: `Icon must be one of: ${ALLOWED_ICONS.join(", ")}` }, { status: 400 });
    }
    if (integrationType && !VALID_INTEGRATION_TYPES.includes(integrationType)) {
      return NextResponse.json({ error: `Integration type must be one of: ${VALID_INTEGRATION_TYPES.join(", ")}` }, { status: 400 });
    }

    const existing = await prisma.readinessIndicator.findUnique({
      where: { practiceId_label: { practiceId: practice.id, label: label.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: "An indicator with this label already exists" }, { status: 400 });
    }

    const maxOrder = await prisma.readinessIndicator.findFirst({
      where: { practiceId: practice.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const indicator = await prisma.readinessIndicator.create({
      data: {
        practiceId: practice.id,
        label: label.trim(),
        icon: icon || "check-circle",
        integrationType: integrationType || "MANUAL",
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(indicator, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
