import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePractice } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireAuth();
    const practice = await requirePractice();

    const user = await prisma.user.findFirst({
      where: { clerkId: session.userId, practiceId: practice.id },
      select: { role: true },
    });

    return NextResponse.json({ role: user?.role || null });
  } catch {
    return NextResponse.json({ role: null }, { status: 401 });
  }
}
