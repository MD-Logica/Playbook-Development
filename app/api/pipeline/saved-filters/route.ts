import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice, requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const [practice, session] = await Promise.all([requirePractice(), requireAuth()]);
    const userId = session.userId;

    const filters = await prisma.savedFilter.findMany({
      where: {
        practiceId: practice.id,
        OR: [
          { visibility: "PUBLIC" },
          { createdBy: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(filters);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const [practice, session] = await Promise.all([requirePractice(), requireAuth()]);
    const userId = session.userId;
    const body = await request.json();

    const { name, filters, visibility } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.trim().length > 48) {
      return NextResponse.json({ error: "Name must be 48 characters or less" }, { status: 400 });
    }
    if (!filters || typeof filters !== "object") {
      return NextResponse.json({ error: "Filters are required" }, { status: 400 });
    }

    const savedFilter = await prisma.savedFilter.create({
      data: {
        name: name.trim(),
        filters,
        visibility: visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
        createdBy: userId,
        practiceId: practice.id,
      },
    });

    return NextResponse.json(savedFilter, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
