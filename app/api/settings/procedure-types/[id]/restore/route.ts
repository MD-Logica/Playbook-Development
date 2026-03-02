import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const procedureType = await prisma.procedureType.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!procedureType) {
      return NextResponse.json({ error: "Procedure type not found" }, { status: 404 });
    }
    if (procedureType.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived procedure types can be restored" }, { status: 400 });
    }

    const updated = await prisma.procedureType.update({
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
    console.error("PATCH /api/settings/procedure-types/[id]/restore error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
