import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice, user: adminUser } = await requireAdmin();
    const { id } = await params;

    if (id === adminUser.id) {
      return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id, practiceId: practice.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "User is already deactivated" }, { status: 400 });
    }

    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { practiceId: practice.id, role: "ADMIN", isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot deactivate the last admin" }, { status: 400 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const { reassignToUserId } = body;

    if (reassignToUserId) {
      const targetUser = await prisma.user.findFirst({
        where: { id: reassignToUserId, practiceId: practice.id, isActive: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "Reassignment target user not found or inactive" }, { status: 400 });
      }

      const openDeals = await prisma.opportunity.findMany({
        where: {
          practiceId: practice.id,
          OR: [{ assignedToId: id }, { providerId: id }],
          closedAt: null,
          isArchived: false,
        },
      });

      for (const deal of openDeals) {
        const updateData: any = {};
        if (deal.assignedToId === id) updateData.assignedToId = reassignToUserId;
        if (deal.providerId === id) updateData.providerId = reassignToUserId;

        await prisma.opportunity.update({
          where: { id: deal.id },
          data: updateData,
        });

        await prisma.activity.create({
          data: {
            practiceId: practice.id,
            patientId: deal.patientId,
            opportunityId: deal.id,
            userId: adminUser.id,
            type: "NOTE",
            body: `Deal reassigned from ${user.firstName} ${user.lastName} to ${targetUser.firstName} ${targetUser.lastName} due to staff deactivation`,
            metadata: {
              action: "bulk_reassign",
              reason: "staff_deactivated",
              fromUserId: id,
              toUserId: reassignToUserId,
            },
          },
        });
      }
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    if (practice.clerkOrgId && user.clerkId) {
      try {
        const clerk = await clerkClient();
        const memberships = await clerk.organizations.getOrganizationMembershipList({
          organizationId: practice.clerkOrgId,
        });
        const membership = memberships.data.find(
          (m: any) => m.publicUserData?.userId === user.clerkId
        );
        if (membership) {
          await clerk.organizations.deleteOrganizationMembership({
            organizationId: practice.clerkOrgId,
            userId: user.clerkId,
          });
        }
      } catch {
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Admin access required") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to deactivate user" }, { status: 500 });
  }
}
