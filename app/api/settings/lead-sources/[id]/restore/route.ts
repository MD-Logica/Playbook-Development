import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const source = await prisma.leadSource.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!source) {
      return NextResponse.json({ error: "Lead source not found" }, { status: 404 });
    }
    if (source.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived lead sources can be restored" }, { status: 400 });
    }

    const updated = await prisma.leadSource.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("PATCH /api/settings/lead-sources/[id]/restore error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
