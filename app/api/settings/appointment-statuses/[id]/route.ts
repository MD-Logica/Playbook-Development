import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const status = await prisma.appointmentCustomStatus.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!status) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    if (status.isSystem) {
      if (body.label !== undefined && body.label !== status.label) {
        return NextResponse.json({ error: "System status labels cannot be modified." }, { status: 400 });
      }
      if (body.isTerminal !== undefined && body.isTerminal !== status.isTerminal) {
        return NextResponse.json({ error: "System status labels cannot be modified." }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (body.color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
        return NextResponse.json({ error: "Color must be a valid hex color" }, { status: 400 });
      }
      updateData.color = body.color;
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (!status.isSystem) {
      if (body.label !== undefined) {
        if (body.label.trim().length === 0) {
          return NextResponse.json({ error: "Label is required" }, { status: 400 });
        }
        if (body.label.trim().length > 40) {
          return NextResponse.json({ error: "Label must be 40 characters or less" }, { status: 400 });
        }
        const dup = await prisma.appointmentCustomStatus.findFirst({
          where: { practiceId: practice.id, label: body.label.trim(), id: { not: id } },
        });
        if (dup) {
          return NextResponse.json({ error: "A status with this label already exists" }, { status: 400 });
        }
        updateData.label = body.label.trim();
      }
      if (body.isTerminal !== undefined) updateData.isTerminal = body.isTerminal;
    }

    const updated = await prisma.appointmentCustomStatus.update({
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

    const status = await prisma.appointmentCustomStatus.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!status) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }
    if (status.isSystem) {
      return NextResponse.json({ error: "System statuses cannot be deleted." }, { status: 400 });
    }

    await prisma.appointmentCustomStatus.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
