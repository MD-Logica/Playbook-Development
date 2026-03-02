import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice, requireAuth } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [practice, session] = await Promise.all([requirePractice(), requireAuth()]);
    const userId = session.userId;
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.savedFilter.findFirst({
      where: { id, practiceId: practice.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.createdBy !== userId) {
      return NextResponse.json({ error: "Only the creator can edit this filter" }, { status: 403 });
    }

    const updateData: any = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      if (name.length > 48) {
        return NextResponse.json({ error: "Name must be 48 characters or less" }, { status: 400 });
      }
      updateData.name = name;
    }
    if (body.visibility !== undefined) {
      updateData.visibility = body.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
    }
    if (body.isStarred !== undefined) {
      updateData.isStarred = Boolean(body.isStarred);
    }
    if (body.filters !== undefined) {
      updateData.filters = body.filters;
    }

    const updated = await prisma.savedFilter.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [practice, session] = await Promise.all([requirePractice(), requireAuth()]);
    const userId = session.userId;
    const { id } = await params;

    const existing = await prisma.savedFilter.findFirst({
      where: { id, practiceId: practice.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.createdBy !== userId) {
      return NextResponse.json({ error: "Only the creator can delete this filter" }, { status: 403 });
    }

    await prisma.savedFilter.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
