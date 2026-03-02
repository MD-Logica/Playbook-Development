import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET() {
  try {
    const practice = await requirePractice();

    const tags = await prisma.practiceTag.findMany({
      where: { practiceId: practice.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(tags);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/practices/tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
