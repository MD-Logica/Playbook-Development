import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET() {
  try {
    const practice = await requirePractice();

    const providers = await prisma.user.findMany({
      where: {
        practiceId: practice.id,
        isActive: true,
        role: { in: ["ADMIN", "PROVIDER"] },
      },
      orderBy: { firstName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return NextResponse.json(providers);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
