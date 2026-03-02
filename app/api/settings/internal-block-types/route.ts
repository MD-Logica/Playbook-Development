import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const DEFAULT_BLOCK_TYPES = [
  { sortOrder: 0, name: "Lunch Break", color: "#F59E0B", isSystem: true },
  { sortOrder: 1, name: "Staff Meeting", color: "#3B82F6", isSystem: true },
  { sortOrder: 2, name: "Personal Time", color: "#8B5CF6", isSystem: false },
  { sortOrder: 3, name: "Vendor Meeting", color: "#64748B", isSystem: false },
  { sortOrder: 4, name: "Training", color: "#10B981", isSystem: false },
  { sortOrder: 5, name: "Other", color: "#6B7280", isSystem: false },
];

export async function GET() {
  try {
    const { practice } = await requireUser();

    const count = await prisma.internalBlockType.count({
      where: { practiceId: practice.id },
    });

    if (count === 0) {
      await prisma.internalBlockType.createMany({
        data: DEFAULT_BLOCK_TYPES.map((b) => ({ ...b, practiceId: practice.id })),
      });
    }

    const blockTypes = await prisma.internalBlockType.findMany({
      where: { practiceId: practice.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(blockTypes);
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

    const { name, color } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.trim().length > 40) {
      return NextResponse.json({ error: "Name must be 40 characters or less" }, { status: 400 });
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ error: "Color must be a valid hex color" }, { status: 400 });
    }

    const existing = await prisma.internalBlockType.findUnique({
      where: { practiceId_name: { practiceId: practice.id, name: name.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: "A block type with this name already exists" }, { status: 400 });
    }

    const maxOrder = await prisma.internalBlockType.findFirst({
      where: { practiceId: practice.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const blockType = await prisma.internalBlockType.create({
      data: {
        practiceId: practice.id,
        name: name.trim(),
        color: color || "#6B7280",
        isSystem: false,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(blockType, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "No practice found" || error.message === "No organization context found") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
