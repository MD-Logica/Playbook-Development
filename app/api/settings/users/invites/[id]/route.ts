import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice, user: adminUser } = await requireAdmin();
    const { id } = await params;

    if (!practice.clerkOrgId) {
      return NextResponse.json({ error: "Organization not configured" }, { status: 400 });
    }

    const clerk = await clerkClient();
    await clerk.organizations.revokeOrganizationInvitation({
      organizationId: practice.clerkOrgId,
      invitationId: id,
      requestingUserId: adminUser.clerkId,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Admin access required") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to cancel invite" }, { status: 500 });
  }
}
