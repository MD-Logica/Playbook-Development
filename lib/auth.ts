import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";

export async function getAuthSession() {
  return await auth();
}

export async function getAuthUser() {
  return await currentUser();
}

export async function requireAuth() {
  const session = await auth();
  if (!session.userId) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requirePractice() {
  const session = await requireAuth();
  const orgId = session.orgId;

  if (orgId) {
    const practice = await prisma.practice.findUnique({
      where: { clerkOrgId: orgId },
    });
    if (practice) return practice;
  }

  const practice = await prisma.practice.findFirst({
    where: { deletedAt: null },
  });
  if (!practice) throw new Error("No practice found");
  return practice;
}

export async function requireUser() {
  const session = await requireAuth();
  const practice = await requirePractice();
  let user = await prisma.user.findFirst({
    where: { clerkId: session.userId, practiceId: practice.id },
  });
  if (!user) {
    const existingByClerkId = await prisma.user.findFirst({
      where: { clerkId: session.userId },
    });
    if (existingByClerkId) {
      user = await prisma.user.update({
        where: { id: existingByClerkId.id },
        data: { practiceId: practice.id },
      });
    } else {
      const clerkUser = await currentUser();
      if (!clerkUser) throw new Error("User not found");
      user = await prisma.user.create({
        data: {
          clerkId: session.userId,
          practiceId: practice.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
          firstName: clerkUser.firstName || "User",
          lastName: clerkUser.lastName || "",
          role: "ADMIN",
          isActive: true,
        },
      });
    }
  }
  return { session, practice, user };
}

export async function requireAdmin() {
  const { session, practice, user } = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return { session, practice, user };
}
