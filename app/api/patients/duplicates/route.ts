import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";
import { stripNonDigits } from "@/lib/phone";

export async function GET(request: Request) {
  try {
    const practice = await requirePractice();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    const email = searchParams.get("email");

    if (!phone && !email) {
      return NextResponse.json([]);
    }

    const conditions: any[] = [];

    if (phone) {
      const digits = stripNonDigits(phone);
      if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        conditions.push({
          phone: { endsWith: last10 },
        });
      }
    }

    if (email) {
      conditions.push({
        email: { equals: email.toLowerCase().trim(), mode: "insensitive" },
      });
    }

    if (conditions.length === 0) {
      return NextResponse.json([]);
    }

    const matches = await prisma.patient.findMany({
      where: {
        practiceId: practice.id,
        deletedAt: null,
        OR: conditions,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        updatedAt: true,
      },
      take: 3,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(matches);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("Duplicate check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
