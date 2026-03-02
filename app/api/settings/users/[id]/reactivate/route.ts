import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireAdmin();
    const { id } = await params;

    const user = await prisma.user.findFirst({
      where: { id, practiceId: practice.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isActive) {
      return NextResponse.json({ error: "User is already active" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    if (practice.clerkOrgId && user.clerkId) {
      try {
        const clerk = await clerkClient();
        await clerk.organizations.createOrganizationMembership({
          organizationId: practice.clerkOrgId,
          userId: user.clerkId,
          role: "org:member",
        });
      } catch {
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Admin access required") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to reactivate user" }, { status: 500 });
  }
}
