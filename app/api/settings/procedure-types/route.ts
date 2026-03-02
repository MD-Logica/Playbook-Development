import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: any = { practiceId: practice.id };
    if (!includeArchived) {
      where.status = "ACTIVE";
    }

    const types = await prisma.procedureType.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            opportunityProcedures: {
              where: {
                opportunity: { deletedAt: null },
              },
            },
          },
        },
      },
    });

    const result = types.map((pt) => ({
      ...pt,
      inUseCount: pt._count.opportunityProcedures,
      _count: undefined,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/settings/procedure-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { name, category } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Procedure name is required" }, { status: 400 });
    }
    if (name.trim().length > 64) {
      return NextResponse.json({ error: "Procedure name must be 64 characters or less" }, { status: 400 });
    }

    const validCategories = ["SURGICAL", "NON_SURGICAL", "SKINCARE", "BODY", "HAIR", "OTHER"];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ error: "Category must be one of: Surgical, Non-Surgical, Skincare, Body, Hair, Other" }, { status: 400 });
    }

    const existing = await prisma.procedureType.findFirst({
      where: {
        practiceId: practice.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A procedure type with this name already exists" }, { status: 409 });
    }

    const maxOrder = await prisma.procedureType.aggregate({
      where: { practiceId: practice.id },
      _max: { sortOrder: true },
    });

    const procedureType = await prisma.procedureType.create({
      data: {
        practiceId: practice.id,
        name: name.trim(),
        category,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(procedureType, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/procedure-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
