import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const practice = await requirePractice();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const sortBy = searchParams.get("sortBy") || "lastName";
    const sortDir = searchParams.get("sortDir") || "asc";
    const offset = (page - 1) * limit;

    const where: any = {
      practiceId: practice.id,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const orderBy: any = {};
    if (sortBy === "name") {
      orderBy.lastName = sortDir;
    } else if (sortBy === "createdAt") {
      orderBy.createdAt = sortDir;
    } else {
      orderBy[sortBy] = sortDir;
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          opportunities: {
            where: { deletedAt: null },
            select: {
              id: true,
              value: true,
              isWon: true,
              stage: { select: { name: true, color: true } },
            },
          },
          appointments: {
            where: {
              deletedAt: null,
              startTime: { gte: new Date() },
            },
            orderBy: { startTime: "asc" },
            take: 1,
            select: { id: true, startTime: true, title: true },
          },
          invoices: {
            where: { deletedAt: null, status: "PAID" },
            select: { total: true },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    const enriched = patients.map((p) => {
      const lifetimeValue = p.invoices.reduce(
        (sum, inv) => sum + Number(inv.total),
        0
      );
      const activeOpportunities = p.opportunities.filter((o) => !o.isWon).length;
      const nextAppointment = p.appointments[0] || null;

      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        status: p.status,
        isVip: p.isVip,
        tags: p.tags,
        dateOfBirth: p.dateOfBirth,
        createdAt: p.createdAt,
        lifetimeValue,
        activeOpportunities,
        totalOpportunities: p.opportunities.length,
        nextAppointment,
      };
    });

    return NextResponse.json({
      patients: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found") || error.message?.includes("No organization context found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/patients error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
