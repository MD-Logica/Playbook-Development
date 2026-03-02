import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const DEFAULT_STATUSES = [
  { sortOrder: 0, label: "Confirmed", color: "#10B981", isSystem: true, isTerminal: false },
  { sortOrder: 1, label: "Checked In", color: "#3B82F6", isSystem: true, isTerminal: false },
  { sortOrder: 2, label: "Roomed", color: "#8B5CF6", isSystem: true, isTerminal: false },
  { sortOrder: 3, label: "In Progress", color: "#F59E0B", isSystem: true, isTerminal: false },
  { sortOrder: 4, label: "Ended", color: "#64748B", isSystem: true, isTerminal: false },
  { sortOrder: 5, label: "Checked Out", color: "#64748B", isSystem: true, isTerminal: true },
  { sortOrder: 6, label: "No Show", color: "#EF4444", isSystem: true, isTerminal: true },
  { sortOrder: 7, label: "Cancelled", color: "#EF4444", isSystem: true, isTerminal: true },
];

export async function GET() {
  try {
    const { practice } = await requireUser();

    const count = await prisma.appointmentCustomStatus.count({
      where: { practiceId: practice.id },
    });

    if (count === 0) {
      await prisma.appointmentCustomStatus.createMany({
        data: DEFAULT_STATUSES.map((s) => ({ ...s, practiceId: practice.id })),
      });
    }

    const statuses = await prisma.appointmentCustomStatus.findMany({
      where: { practiceId: practice.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(statuses);
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

    const { label, color, isTerminal } = body;

    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (label.trim().length > 40) {
      return NextResponse.json({ error: "Label must be 40 characters or less" }, { status: 400 });
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ error: "Color must be a valid hex color" }, { status: 400 });
    }

    const existing = await prisma.appointmentCustomStatus.findUnique({
      where: { practiceId_label: { practiceId: practice.id, label: label.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: "A status with this label already exists" }, { status: 400 });
    }

    const maxOrder = await prisma.appointmentCustomStatus.findFirst({
      where: { practiceId: practice.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const status = await prisma.appointmentCustomStatus.create({
      data: {
        practiceId: practice.id,
        label: label.trim(),
        color: color || "#6B7280",
        isSystem: false,
        isTerminal: isTerminal ?? false,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(status, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
