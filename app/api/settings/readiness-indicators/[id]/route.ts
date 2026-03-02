import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const ALLOWED_ICONS = [
  "check-circle", "dollar-sign", "file-text", "clipboard", "shield",
  "heart", "user-check", "calendar-check", "camera", "pill", "stethoscope",
];

const VALID_INTEGRATION_TYPES = ["MANUAL", "STRIPE", "DOCUSIGN", "PANDADOC"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const indicator = await prisma.readinessIndicator.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!indicator) {
      return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (body.label !== undefined) {
      if (body.label.trim().length === 0) {
        return NextResponse.json({ error: "Label is required" }, { status: 400 });
      }
      if (body.label.trim().length > 50) {
        return NextResponse.json({ error: "Label must be 50 characters or less" }, { status: 400 });
      }
      const dup = await prisma.readinessIndicator.findFirst({
        where: { practiceId: practice.id, label: body.label.trim(), id: { not: id } },
      });
      if (dup) {
        return NextResponse.json({ error: "An indicator with this label already exists" }, { status: 400 });
      }
      updateData.label = body.label.trim();
    }
    if (body.icon !== undefined) {
      if (!ALLOWED_ICONS.includes(body.icon)) {
        return NextResponse.json({ error: `Icon must be one of: ${ALLOWED_ICONS.join(", ")}` }, { status: 400 });
      }
      updateData.icon = body.icon;
    }
    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.integrationType !== undefined) {
      if (!VALID_INTEGRATION_TYPES.includes(body.integrationType)) {
        return NextResponse.json({ error: `Integration type must be one of: ${VALID_INTEGRATION_TYPES.join(", ")}` }, { status: 400 });
      }
      updateData.integrationType = body.integrationType;
    }

    const updated = await prisma.readinessIndicator.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;

    const indicator = await prisma.readinessIndicator.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!indicator) {
      return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
    }

    await prisma.readinessIndicator.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
