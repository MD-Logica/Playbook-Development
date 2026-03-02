import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;
    const body = await req.json();
    const { name, channelType } = body;

    const source = await prisma.leadSource.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!source) {
      return NextResponse.json({ error: "Lead source not found" }, { status: 404 });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Source name is required" }, { status: 400 });
      }
      if (name.trim().length > 48) {
        return NextResponse.json({ error: "Source name must be 48 characters or less" }, { status: 400 });
      }
      const existing = await prisma.leadSource.findFirst({
        where: {
          practiceId: practice.id,
          name: { equals: name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "A lead source with this name already exists" }, { status: 409 });
      }
    }

    const validChannels = ["PAID", "ORGANIC", "RELATIONSHIP"];
    if (channelType !== undefined && !validChannels.includes(channelType)) {
      return NextResponse.json({ error: "Channel type must be PAID, ORGANIC, or RELATIONSHIP" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (channelType !== undefined) updateData.channelType = channelType;

    const updated = await prisma.leadSource.update({
      where: { id },
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
    console.error("PATCH /api/settings/lead-sources/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const practice = await requirePractice();
    const { id } = await params;

    const source = await prisma.leadSource.findFirst({
      where: { id, practiceId: practice.id },
    });
    if (!source) {
      return NextResponse.json({ error: "Lead source not found" }, { status: 404 });
    }
    if (source.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Only archived lead sources can be permanently deleted" }, { status: 400 });
    }

    await prisma.leadSource.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("DELETE /api/settings/lead-sources/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
