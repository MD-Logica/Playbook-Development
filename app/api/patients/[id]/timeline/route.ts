import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practice = await requirePractice();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const typeFilter = searchParams.get("type") || "";

    const patient = await prisma.patient.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const activityWhere: any = {
      patientId: id,
      practiceId: practice.id,
    };

    if (typeFilter) {
      activityWhere.type = typeFilter;
    }

    const [activities, appointments, quotes, invoices] = await Promise.all([
      prisma.activity.findMany({
        where: activityWhere,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      !typeFilter || typeFilter === "APPOINTMENT"
        ? prisma.appointment.findMany({
            where: { patientId: id, practiceId: practice.id, deletedAt: null },
            orderBy: { startTime: "desc" },
            include: {
              provider: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      !typeFilter || typeFilter === "QUOTE"
        ? prisma.quote.findMany({
            where: { patientId: id, practiceId: practice.id, deletedAt: null },
            orderBy: { createdAt: "desc" },
            include: {
              coordinator: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      !typeFilter || typeFilter === "INVOICE"
        ? prisma.invoice.findMany({
            where: { patientId: id, practiceId: practice.id, deletedAt: null },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    type TimelineItem = {
      id: string;
      type: string;
      title: string;
      body: string | null;
      date: Date;
      user: string | null;
      metadata: any;
    };

    const timeline: TimelineItem[] = [];

    for (const a of activities) {
      timeline.push({
        id: a.id,
        type: a.type,
        title: a.type === "NOTE" ? "Note" : a.type === "CALL" ? "Call" : a.type === "EMAIL" ? "Email" : a.type === "SMS" ? "SMS" : a.type === "STAGE_CHANGE" ? "Stage Change" : a.type,
        body: a.body,
        date: a.createdAt,
        user: a.user && (a.user.firstName || a.user.lastName) ? `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim() : null,
        metadata: a.metadata,
      });
    }

    for (const appt of appointments) {
      timeline.push({
        id: appt.id,
        type: "APPOINTMENT",
        title: appt.title,
        body: `${appt.appointmentCategory} - ${appt.status}`,
        date: appt.startTime,
        user: appt.provider && (appt.provider.firstName || appt.provider.lastName) ? `${appt.provider.firstName || ""} ${appt.provider.lastName || ""}`.trim() : null,
        metadata: { status: appt.status, appointmentCategory: appt.appointmentCategory },
      });
    }

    for (const q of quotes) {
      timeline.push({
        id: q.id,
        type: "QUOTE",
        title: `Quote - $${Number(q.total).toLocaleString()}`,
        body: `Status: ${q.status}`,
        date: q.createdAt,
        user: q.coordinator && (q.coordinator.firstName || q.coordinator.lastName) ? `${q.coordinator.firstName || ""} ${q.coordinator.lastName || ""}`.trim() : null,
        metadata: { status: q.status, total: Number(q.total) },
      });
    }

    for (const inv of invoices) {
      timeline.push({
        id: inv.id,
        type: "INVOICE",
        title: `Invoice ${inv.invoiceNumber || ""} - $${Number(inv.total).toLocaleString()}`,
        body: `Status: ${inv.status}`,
        date: inv.createdAt,
        user: null,
        metadata: { status: inv.status, total: Number(inv.total), balanceDue: Number(inv.balanceDue) },
      });
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = timeline.length;
    const paginated = timeline.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      items: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("No practice found")) {
      return NextResponse.json({ error: "No practice found" }, { status: 404 });
    }
    console.error("GET /api/patients/[id]/timeline error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
