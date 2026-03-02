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

    const where: any = {
      practiceId: practice.id,
      deletedAt: null,
      status: { not: "VOID" },
    };

    if (statusFilter.length > 0) {
      where.status = { in: statusFilter };
    }
    if (coordinatorId) {
      where.coordinatorId = coordinatorId;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { patient: { firstName: { contains: search, mode: "insensitive" } } },
        { patient: { lastName: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (dateFrom) {
      where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
    }

    const overdueWhere: any = {
      ...where,
      status: { in: ["SENT", "PARTIALLY_PAID"] },
      dueDate: { lt: new Date() },
    };
    if (statusFilter.length > 0) {
      const overdueStatuses = statusFilter.filter((s: string) => s === "SENT" || s === "PARTIALLY_PAID");
      if (overdueStatuses.length === 0) {
        overdueWhere.status = { in: [] };
      } else {
        overdueWhere.status = { in: overdueStatuses };
      }
    }

    const [invoices, payments, overdueCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          total: true,
          amountPaid: true,
          balanceDue: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          practiceId: practice.id,
          invoice: where,
        },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: overdueWhere,
      }),
    ]);

    let totalInvoiced = 0;
    let outstandingBalance = 0;
    for (const inv of invoices) {
      totalInvoiced += Number(inv.total);
      outstandingBalance += Number(inv.balanceDue);
    }

    const amountCollected = Number(payments._sum.amount || 0);

    return NextResponse.json({
      totalInvoiced,
      amountCollected,
      outstandingBalance,
      overdue: overdueCount,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/invoices/kpis error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
