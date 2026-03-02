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
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortDir = (url.searchParams.get("sortDir") || "desc") as "asc" | "desc";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const where: any = {
      practiceId: practice.id,
      deletedAt: null,
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

    const orderBy: any = {};
    const validSortFields = ["createdAt", "total", "balanceDue", "invoiceNumber", "status", "dueDate"];
    if (validSortFields.includes(sortBy)) {
      orderBy[sortBy] = sortDir;
    } else {
      orderBy.createdAt = "desc";
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          opportunity: { select: { id: true, title: true, pipelineId: true } },
          coordinator: { select: { id: true, firstName: true, lastName: true } },
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              productService: { select: { id: true, name: true, itemType: true, taxable: true } },
              provider: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          payments: {
            orderBy: { paymentDate: "desc" },
            include: {
              recorder: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          quote: { select: { id: true, quoteNumber: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ invoices, total, page, limit });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/invoices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
