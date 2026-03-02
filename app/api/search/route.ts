import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { practice } = await requireUser();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const patientId = url.searchParams.get("patientId");

    if (patientId) {
      const deals = await prisma.opportunity.findMany({
        where: {
          practiceId: practice.id,
          patientId,
          deletedAt: null,
          isArchived: false,
        },
        select: {
          id: true,
          title: true,
          stage: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ deals });
    }

    if (!q || q.length < 1) {
      return NextResponse.json({ patients: [], deals: [] });
    }

    const words = q.split(/\s+/).filter(Boolean);
    let patientWhere: any;

    if (words.length >= 2) {
      const first = words[0];
      const last = words.slice(1).join(" ");
      patientWhere = {
        practiceId: practice.id,
        OR: [
          { AND: [{ firstName: { contains: first, mode: "insensitive" } }, { lastName: { contains: last, mode: "insensitive" } }] },
          { AND: [{ firstName: { contains: last, mode: "insensitive" } }, { lastName: { contains: first, mode: "insensitive" } }] },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      };
    } else {
      patientWhere = {
        practiceId: practice.id,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    const [patients, deals] = await Promise.all([
      prisma.patient.findMany({
        where: patientWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
        take: 8,
        orderBy: { lastName: "asc" },
      }),
      prisma.opportunity.findMany({
        where: {
          practiceId: practice.id,
          deletedAt: null,
          isArchived: false,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { patient: { firstName: { contains: q, mode: "insensitive" } } },
            { patient: { lastName: { contains: q, mode: "insensitive" } } },
            ...(words.length >= 2
              ? [
                  { AND: [{ patient: { firstName: { contains: words[0], mode: "insensitive" as const } } }, { patient: { lastName: { contains: words.slice(1).join(" "), mode: "insensitive" as const } } }] },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          title: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ patients, deals });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
