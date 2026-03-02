import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { role } = body;

    const validRoles = ["ADMIN", "PROVIDER", "COORDINATOR", "FRONT_DESK"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id, practiceId: practice.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { practiceId: practice.id, role: "ADMIN", isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "At least one admin must exist in the organization" }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: role as any },
    });

    return NextResponse.json({ id: updated.id, role: updated.role });
  } catch (e: any) {
    if (e.message === "Admin access required") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
