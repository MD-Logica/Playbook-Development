import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { practice } = await requireAdmin();

    const users = await prisma.user.findMany({
      where: { practiceId: practice.id },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }],
      select: {
        id: true,
        clerkId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let pendingInvitations: any[] = [];
    try {
      const clerk = await clerkClient();
      if (practice.clerkOrgId) {
        const invitations = await clerk.organizations.getOrganizationInvitationList({
          organizationId: practice.clerkOrgId,
          status: ["pending"],
        });
        pendingInvitations = invitations.data.map((inv: any) => ({
          id: inv.id,
          emailAddress: inv.emailAddress,
          role: inv.role,
          status: inv.status,
          createdAt: inv.createdAt,
          publicMetadata: inv.publicMetadata || {},
        }));
      }
    } catch {
    }

    return NextResponse.json({ users, pendingInvitations });
  } catch (e: any) {
    if (e.message === "Admin access required") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
