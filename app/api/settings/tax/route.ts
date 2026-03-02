import { NextResponse } from "next/server";
import { requirePractice } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const practice = await requirePractice();

    return NextResponse.json({
      defaultTaxRate: practice.defaultTaxRate ?? null,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const practice = await requirePractice();
    const body = await request.json();

    const { defaultTaxRate } = body;

    if (defaultTaxRate !== null && defaultTaxRate !== undefined) {
      const rate = parseFloat(defaultTaxRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return NextResponse.json(
          { error: "Tax rate must be a number between 0 and 100" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.practice.update({
      where: { id: practice.id },
      data: {
        defaultTaxRate: defaultTaxRate === null || defaultTaxRate === undefined
          ? null
          : parseFloat(defaultTaxRate),
      },
    });

    return NextResponse.json({
      defaultTaxRate: updated.defaultTaxRate ?? null,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
