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

    const tags = await prisma.practiceTag.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    const tagNames = tags.map((t) => t.name);
    const patients = await prisma.patient.findMany({
      where: {
        practiceId: practice.id,
        deletedAt: null,
        tags: { hasSome: tagNames.length > 0 ? tagNames : ["__none__"] },
      },
      select: { tags: true },
    });

    const countMap: Record<string, number> = {};
    for (const p of patients) {
      for (const t of p.tags) {
        countMap[t] = (countMap[t] || 0) + 1;
      }
    }

    const result = tags.map((tag) => ({
      ...tag,
      inUseCount: countMap[tag.name] || 0,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/settings/tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { name, color } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
    }
    if (name.trim().length > 32) {
      return NextResponse.json({ error: "Tag name must be 32 characters or less" }, { status: 400 });
    }

    const existing = await prisma.practiceTag.findFirst({
      where: {
        practiceId: practice.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 });
    }

    const maxOrder = await prisma.practiceTag.aggregate({
      where: { practiceId: practice.id },
      _max: { sortOrder: true },
    });

    const tag = await prisma.practiceTag.create({
      data: {
        practiceId: practice.id,
        name: name.trim(),
        color: color || "#6B7280",
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
