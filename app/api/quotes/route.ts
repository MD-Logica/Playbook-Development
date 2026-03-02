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
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
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
    const validSortFields = ["createdAt", "total", "expirationDate", "quoteNumber", "status"];
    if (validSortFields.includes(sortBy)) {
      orderBy[sortBy] = sortDir;
    } else {
      orderBy.createdAt = "desc";
    }

    const quotes = await prisma.quote.findMany({
      where,
      orderBy,
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
      },
    });

    return NextResponse.json(quotes);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/quotes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { practice, user } = await requireUser();
    const body = await req.json();

    const {
      title,
      opportunityId,
      patientId,
      coordinatorId,
      expirationDate,
      depositType,
      depositValue,
      quoteLevelDiscountType,
      quoteLevelDiscountValue,
      internalNotes,
      patientNotes,
      showComponents,
      lineItems,
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: "Patient is required" }, { status: 400 });
    }
    if (!expirationDate) {
      return NextResponse.json({ error: "Expiration date is required" }, { status: 400 });
    }
    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
    }

    const lastQuote = await prisma.quote.findFirst({
      where: { practiceId: practice.id, quoteNumber: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { quoteNumber: true },
    });

    let nextNum = 1;
    if (lastQuote?.quoteNumber) {
      const match = lastQuote.quoteNumber.match(/Q-\d{4}-(\d{4})/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const year = new Date().getFullYear();
    const quoteNumber = `Q-${year}-${String(nextNum).padStart(4, "0")}`;

    const taxRate = practice.defaultTaxRate ? Number(practice.defaultTaxRate) : 0;

    let subtotal = 0;
    const processedItems = lineItems.map((li: any, idx: number) => {
      let lineTotal = 0;
      const qty = Number(li.quantity || 1);
      const unitPrice = Number(li.unitPrice || 0);
      const hours = li.hours ? Number(li.hours) : null;

      if (hours !== null) {
        lineTotal = hours * unitPrice;
      } else {
        lineTotal = qty * unitPrice;
      }

      let discountAmt = 0;
      if (li.discountType && li.discountValue) {
        if (li.discountType === "FIXED") {
          discountAmt = Number(li.discountValue);
        } else {
          discountAmt = lineTotal * (Number(li.discountValue) / 100);
        }
      }
      lineTotal -= discountAmt;

      subtotal += lineTotal;

      return {
        productServiceId: li.productServiceId || null,
        name: li.name || "",
        description: li.description || null,
        quantity: qty,
        unitPrice: unitPrice,
        hours: hours,
        providerId: li.providerId || null,
        discountType: li.discountType || null,
        discountValue: li.discountValue ? Number(li.discountValue) : null,
        sortOrder: idx,
        taxable: li.taxable ?? false,
      };
    });

    let quoteLevelDiscount = 0;
    if (quoteLevelDiscountType && quoteLevelDiscountValue) {
      if (quoteLevelDiscountType === "FIXED") {
        quoteLevelDiscount = Number(quoteLevelDiscountValue);
      } else {
        quoteLevelDiscount = subtotal * (Number(quoteLevelDiscountValue) / 100);
      }
    }

    const afterDiscount = subtotal - quoteLevelDiscount;

    let taxableTotal = 0;
    for (const li of processedItems) {
      if (li.taxable) {
        let lineTotal = 0;
        if (li.hours !== null) {
          lineTotal = li.hours * li.unitPrice;
        } else {
          lineTotal = li.quantity * li.unitPrice;
        }
        let discAmt = 0;
        if (li.discountType && li.discountValue) {
          if (li.discountType === "FIXED") discAmt = li.discountValue;
          else discAmt = lineTotal * (li.discountValue / 100);
        }
        taxableTotal += lineTotal - discAmt;
      }
    }

    if (quoteLevelDiscount > 0 && subtotal > 0) {
      const discountRatio = quoteLevelDiscount / subtotal;
      taxableTotal = taxableTotal * (1 - discountRatio);
    }

    const taxAmount = taxableTotal * (taxRate / 100);
    const total = afterDiscount + taxAmount;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        title: title || null,
        practiceId: practice.id,
        patientId,
        opportunityId: opportunityId || null,
        coordinatorId: coordinatorId || user.id,
        status: "DRAFT",
        subtotal,
        discountAmount: quoteLevelDiscount,
        taxAmount,
        total,
        depositType: depositType || "PERCENTAGE",
        depositValue: depositValue ?? 20,
        quoteLevelDiscountType: quoteLevelDiscountType || null,
        quoteLevelDiscountValue: quoteLevelDiscountValue ? Number(quoteLevelDiscountValue) : null,
        expirationDate: new Date(expirationDate),
        internalNotes: internalNotes || null,
        patientNotes: patientNotes || null,
        showComponents: showComponents ?? false,
        lineItems: {
          create: processedItems.map(({ taxable: _taxable, ...item }: any) => item),
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, title: true } },
        coordinator: { select: { id: true, firstName: true, lastName: true } },
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            productService: { select: { id: true, name: true, itemType: true, taxable: true } },
            provider: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (opportunityId) {
      await prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId,
          userId: user.id,
          type: "NOTE",
          body: `Quote ${quoteNumber} created`,
          metadata: {
            action: "quote_created",
            quoteId: quote.id,
            quoteNumber,
            opportunityId,
            total,
          },
        },
      });
    }

    return NextResponse.json(quote, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/quotes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
