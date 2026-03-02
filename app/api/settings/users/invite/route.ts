import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    const { practice, user: adminUser } = await requireAdmin();

    if (!practice.clerkOrgId) {
      return NextResponse.json({ error: "Organization not configured" }, { status: 400 });
    }

    const body = await req.json();
    const { firstName, lastName, contactMethod, email, phone, role } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }

    const validRoles = ["ADMIN", "PROVIDER", "COORDINATOR", "FRONT_DESK"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (contactMethod === "email" && !email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (contactMethod === "phone" && !phone?.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const clerk = await clerkClient();

    const inviteEmail = contactMethod === "email"
      ? email.trim()
      : `${phone.replace(/\D/g, "")}@phone.placeholder.local`;

    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: practice.clerkOrgId,
      emailAddress: inviteEmail,
      role: "org:member",
      inviterUserId: adminUser.clerkId,
      publicMetadata: {
        staffRole: role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactMethod,
        phone: contactMethod === "phone" ? phone : undefined,
      },
    });

    return NextResponse.json({
      id: invitation.id,
      status: "pending",
    });
  } catch (e: any) {
    if (e.message === "Admin access required") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const msg = e.errors?.[0]?.longMessage || e.message || "Failed to send invite";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
