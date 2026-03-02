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

    const sources = await prisma.leadSource.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    const sourceNames = sources.map((s) => s.name);

    const opportunities = await prisma.opportunity.findMany({
      where: {
        practiceId: practice.id,
        deletedAt: null,
      },
      select: { referralSource: true },
    });

    const patients = await prisma.patient.findMany({
      where: {
        practiceId: practice.id,
        deletedAt: null,
      },
      select: { referralSource: true },
    });

    const countMap: Record<string, number> = {};
    for (const o of opportunities) {
      if (o.referralSource) {
        const key = o.referralSource.toString();
        countMap[key] = (countMap[key] || 0) + 1;
      }
    }
    for (const p of patients) {
      if (p.referralSource) {
        const key = p.referralSource.toString();
        countMap[key] = (countMap[key] || 0) + 1;
      }
    }

    const result = sources.map((source) => ({
      ...source,
      inUseCount: countMap[source.name] || 0,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/settings/lead-sources error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { name, channelType } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Source name is required" }, { status: 400 });
    }
    if (name.trim().length > 48) {
      return NextResponse.json({ error: "Source name must be 48 characters or less" }, { status: 400 });
    }

    const validChannels = ["PAID", "ORGANIC", "RELATIONSHIP"];
    if (!channelType || !validChannels.includes(channelType)) {
      return NextResponse.json({ error: "Channel type must be PAID, ORGANIC, or RELATIONSHIP" }, { status: 400 });
    }

    const existing = await prisma.leadSource.findFirst({
      where: {
        practiceId: practice.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A lead source with this name already exists" }, { status: 409 });
    }

    const maxOrder = await prisma.leadSource.aggregate({
      where: { practiceId: practice.id },
      _max: { sortOrder: true },
    });

    const source = await prisma.leadSource.create({
      data: {
        practiceId: practice.id,
        name: name.trim(),
        channelType,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/lead-sources error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
