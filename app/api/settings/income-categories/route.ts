import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: any = { practiceId: practice.id };
    if (!includeArchived) {
      where.status = "ACTIVE";
    }

    const allCategories = await prisma.incomeCategory.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    const categoryMap = new Map<string | null, any[]>();
    for (const cat of allCategories) {
      const key = cat.parentId ?? null;
      if (!categoryMap.has(key)) categoryMap.set(key, []);
      categoryMap.get(key)!.push(cat);
    }

    function buildTree(parentId: string | null): any[] {
      const nodes = categoryMap.get(parentId) || [];
      return nodes.map((node) => ({
        ...node,
        children: buildTree(node.id),
      }));
    }

    const tree = buildTree(null);

    return NextResponse.json(tree);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/settings/income-categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const body = await req.json();
    const { name, parentId } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    if (parentId) {
      const parent = await prisma.incomeCategory.findFirst({
        where: { id: parentId, practiceId: practice.id },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
      }
    }

    const existing = await prisma.incomeCategory.findFirst({
      where: {
        practiceId: practice.id,
        parentId: parentId || null,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A category with this name already exists at this level" }, { status: 409 });
    }

    const maxOrder = await prisma.incomeCategory.aggregate({
      where: { practiceId: practice.id, parentId: parentId || null },
      _max: { sortOrder: true },
    });

    const category = await prisma.incomeCategory.create({
      data: {
        practiceId: practice.id,
        name: name.trim(),
        parentId: parentId || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/income-categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
