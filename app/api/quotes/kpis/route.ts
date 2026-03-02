import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { practice } = await requireUser();
    const url = new URL(req.url);

    const statusFilter = url.searchParams.getAll("status");
    const coordinatorId = url.searchParams.get("coordinatorId");
    const search = url.searchParams.get("search");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const baseWhere: any = {
      practiceId: practice.id,
      deletedAt: null,
    };

    if (statusFilter.length > 0) {
      baseWhere.status = { in: statusFilter };
    }
    if (coordinatorId) {
      baseWhere.coordinatorId = coordinatorId;
    }
    if (search) {
      baseWhere.OR = [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { patient: { firstName: { contains: search, mode: "insensitive" } } },
        { patient: { lastName: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (dateFrom) {
      baseWhere.createdAt = { ...baseWhere.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      baseWhere.createdAt = { ...baseWhere.createdAt, lte: new Date(dateTo) };
    }

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const activeWhere = {
      ...baseWhere,
      status: baseWhere.status
        ? { in: (Array.isArray(baseWhere.status.in) ? baseWhere.status.in : [baseWhere.status]).filter((s: string) => s === "DRAFT" || s === "SENT") }
        : { in: ["DRAFT", "SENT"] },
    };

    const hasStatusFilter = statusFilter.length > 0;
    const activeDraftSentIncluded = !hasStatusFilter || statusFilter.some(s => s === "DRAFT" || s === "SENT");

    const [activeQuotes, matchingQuotes, expiringSoon] = await Promise.all([
      activeDraftSentIncluded
        ? prisma.quote.findMany({
            where: {
              ...baseWhere,
              status: hasStatusFilter
                ? { in: statusFilter.filter(s => s === "DRAFT" || s === "SENT") }
                : { in: ["DRAFT", "SENT"] },
            },
            select: { total: true },
          })
        : Promise.resolve([]),

      prisma.quote.findMany({
        where: baseWhere,
        select: { opportunityId: true, status: true },
      }),

      activeDraftSentIncluded
        ? prisma.quote.count({
            where: {
              ...baseWhere,
              status: hasStatusFilter
                ? { in: statusFilter.filter(s => s === "DRAFT" || s === "SENT") }
                : { in: ["DRAFT", "SENT"] },
              expirationDate: {
                not: null,
                lte: sevenDaysFromNow,
                gte: new Date(),
              },
            },
          })
        : Promise.resolve(0),
    ]);

    const totalActiveQuotes = activeQuotes.length;
    const totalValueQuoted = activeQuotes.reduce((sum, q) => sum + Number(q.total), 0);

    const dealMap = new Map<string, Set<string>>();
    for (const q of matchingQuotes) {
      if (!q.opportunityId) continue;
      if (!dealMap.has(q.opportunityId)) {
        dealMap.set(q.opportunityId, new Set());
      }
      dealMap.get(q.opportunityId)!.add(q.status);
    }

    const dealsWithQuotes = dealMap.size;
    let dealsWithConverted = 0;
    for (const statuses of dealMap.values()) {
      if (statuses.has("CONVERTED")) {
        dealsWithConverted++;
      }
    }

    let acceptanceRate: number | null = null;
    if (dealsWithQuotes > 0) {
      acceptanceRate = parseFloat(((dealsWithConverted / dealsWithQuotes) * 100).toFixed(1));
    }

    return NextResponse.json({
      totalActiveQuotes,
      totalValueQuoted,
      acceptanceRate,
      expiringSoon,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/quotes/kpis error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
