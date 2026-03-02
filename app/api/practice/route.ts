import { NextResponse, NextRequest } from "next/server";
import { requirePractice } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const practice = await requirePractice();

    return NextResponse.json(practice);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await request.json();

    const allowedFields = [
      "name", "address", "city", "state", "phone", "email",
      "logoUrl", "primaryColor", "secondaryColor",
    ];

    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updateData[key] = body[key];
      }
    }

    const updated = await prisma.practice.update({
      where: { id: practice.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
