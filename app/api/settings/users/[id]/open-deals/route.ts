import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireAdmin();
    const { id } = await params;

    const count = await prisma.opportunity.count({
      where: {
        practiceId: practice.id,
        OR: [{ assignedToId: id }, { providerId: id }],
        closedAt: null,
        isArchived: false,
      },
    });

    return NextResponse.json({ count });
  } catch (e: any) {
    if (e.message === "Admin access required") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to check open deals" }, { status: 500 });
  }
}
