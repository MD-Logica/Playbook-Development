import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

interface TemplateNode {
  name: string;
  children?: TemplateNode[];
}

const PLAYBOOK_TEMPLATE: TemplateNode[] = [
  {
    name: "Surgical",
    children: [
      {
        name: "Face",
        children: [
          { name: "Facelift" },
          { name: "Rhinoplasty" },
          { name: "Blepharoplasty" },
          { name: "Brow Lift" },
          { name: "Neck Lift" },
        ],
      },
      {
        name: "Breast",
        children: [
          { name: "Augmentation" },
          { name: "Lift" },
          { name: "Reduction" },
        ],
      },
      {
        name: "Body",
        children: [
          { name: "Tummy Tuck" },
          { name: "Liposuction" },
          { name: "Body Contouring" },
        ],
      },
      {
        name: "Hair",
        children: [
          { name: "Hair Transplant" },
        ],
      },
    ],
  },
  {
    name: "Non-Surgical",
    children: [
      {
        name: "Injectables",
        children: [
          { name: "Botox / Neurotoxin" },
          { name: "Dermal Fillers" },
        ],
      },
      {
        name: "Lasers & Energy",
        children: [
          { name: "Laser Resurfacing" },
          { name: "Laser Hair Removal" },
          { name: "Body Contouring (Non-Surgical)" },
        ],
      },
      {
        name: "Aesthetician Services",
        children: [
          { name: "Facials" },
          { name: "Chemical Peels" },
          { name: "Microneedling" },
        ],
      },
    ],
  },
  { name: "Anesthesia" },
  { name: "Facility Fees" },
];

async function createTreeRecursive(
  practiceId: string,
  nodes: TemplateNode[],
  parentId: string | null
) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    const existing = await prisma.incomeCategory.findFirst({
      where: {
        practiceId,
        parentId,
        name: { equals: node.name, mode: "insensitive" },
      },
    });

    if (existing) continue;

    const maxOrder = await prisma.incomeCategory.aggregate({
      where: { practiceId, parentId },
      _max: { sortOrder: true },
    });

    const created = await prisma.incomeCategory.create({
      data: {
        practiceId,
        name: node.name,
        parentId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        status: "ACTIVE",
      },
    });

    if (node.children && node.children.length > 0) {
      await createTreeRecursive(practiceId, node.children, created.id);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const practice = await requirePractice();

    const existingTopLevel = await prisma.incomeCategory.findMany({
      where: { practiceId: practice.id, parentId: null },
      select: { name: true },
    });
    const existingNames = new Set(existingTopLevel.map((c: { name: string }) => c.name.toLowerCase()));

    const filteredTemplate = PLAYBOOK_TEMPLATE.filter(
      (node) => !existingNames.has(node.name.toLowerCase())
    );

    await createTreeRecursive(practice.id, filteredTemplate, null);

    const allCategories = await prisma.incomeCategory.findMany({
      where: { practiceId: practice.id },
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

    return NextResponse.json(buildTree(null), { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("POST /api/settings/income-categories/load-playbook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
