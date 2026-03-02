import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePractice, requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const practice = await requirePractice();
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const providerId = searchParams.get("providerId");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const where: any = {
      practiceId: practice.id,
      deletedAt: null,
      startTime: { lt: new Date(endDate) },
      endTime: { gt: new Date(startDate) },
    };

    if (providerId && providerId !== "all") {
      where.providerId = providerId;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true, durationMins: true, bufferMins: true } },
        subcategory: { select: { id: true, name: true } },
        attendees: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json(appointments);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, practice } = await requireUser();
    const body = await req.json();

    const {
      patientId,
      opportunityId,
      providerId,
      appointmentTypeId,
      subcategoryId,
      appointmentCategory,
      title,
      isInternal,
      startTime,
      endTime,
      bufferMins,
      location,
      notes,
      roomName,
      blockTypeId,
      attendeeIds,
      recurrence,
    } = body;

    if (!providerId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "providerId, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    if (!isInternal && !patientId) {
      return NextResponse.json(
        { error: "patientId is required for non-internal appointments" },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const buffer = bufferMins || 0;

    const bufferEnd = new Date(end.getTime() + buffer * 60 * 1000);

    const overlapping = await prisma.appointment.findFirst({
      where: {
        practiceId: practice.id,
        providerId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        AND: [
          { startTime: { lt: bufferEnd } },
          { endTime: { gt: start } },
        ],
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        configuredType: { select: { name: true } },
      },
    });

    let conflict = false;
    let conflictMessage = "";

    if (overlapping) {
      conflict = true;
      const patientName = overlapping.patient
        ? `${overlapping.patient.firstName} ${overlapping.patient.lastName}`
        : overlapping.title;
      const typeName = overlapping.configuredType?.name || overlapping.appointmentCategory;
      const overlapStart = overlapping.startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      const overlapEnd = overlapping.endTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      conflictMessage = `Provider has an overlapping appointment: ${patientName} - ${typeName} (${overlapStart} - ${overlapEnd})`;
    }

    const resolvedCategory = appointmentCategory || "OTHER";

    if (isInternal && recurrence) {
      const { frequency, customDays, endType, endAfter, endDate: recEndDate } = recurrence;
      const dates: Date[] = [];
      const baseStart = new Date(startTime);
      const durationMs = new Date(endTime).getTime() - baseStart.getTime();
      const current = new Date(baseStart);
      const maxOccurrences = Math.min(endType === "after" ? endAfter : 52, 52);
      const endDateLimit = endType === "date" && recEndDate ? new Date(recEndDate) : null;

      while (dates.length < maxOccurrences) {
        if (endDateLimit && current > endDateLimit) break;
        const dayOfWeek = current.getDay();
        const include =
          frequency === "DAILY" ||
          (frequency === "WEEKLY" && current.getTime() !== baseStart.getTime() ? dayOfWeek === baseStart.getDay() : true) ||
          (frequency === "CUSTOM" && customDays.includes(dayOfWeek));
        if (include || dates.length === 0) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
        if (dates.length >= maxOccurrences) break;
      }

      const appointments = await prisma.$transaction(
        dates.map((d) => {
          const s = new Date(d);
          const e = new Date(s.getTime() + durationMs);
          return prisma.appointment.create({
            data: {
              practiceId: practice.id,
              providerId,
              createdById: user.id,
              blockTypeId: blockTypeId || null,
              title: title || "Internal Block",
              isInternal: true,
              startTime: s,
              endTime: e,
              bufferMins: buffer,
              appointmentCategory: "OTHER",
              status: "CONFIRMED",
              notes: notes || null,
              roomName: roomName || null,
            },
          });
        })
      );

      if (attendeeIds && attendeeIds.length > 0) {
        await prisma.appointmentAttendee.createMany({
          data: appointments.flatMap((appt: any) =>
            attendeeIds.map((userId: string) => ({
              appointmentId: appt.id,
              userId,
              isPrimary: false,
            }))
          ),
        });
      }

      return NextResponse.json({ appointments, count: appointments.length }, { status: 201 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        practiceId: practice.id,
        patientId: patientId || null,
        opportunityId: opportunityId || null,
        providerId,
        createdById: user.id,
        appointmentTypeId: appointmentTypeId || null,
        subcategoryId: subcategoryId || null,
        blockTypeId: blockTypeId || null,
        appointmentCategory: resolvedCategory,
        title: title || (isInternal ? "Internal Block" : "Appointment"),
        isInternal: isInternal || false,
        startTime: start,
        endTime: end,
        bufferMins: buffer,
        status: "CONFIRMED",
        location: location || null,
        notes: notes || null,
        roomName: roomName || null,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true, durationMins: true, bufferMins: true } },
        subcategory: { select: { id: true, name: true } },
        attendees: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (attendeeIds && attendeeIds.length > 0) {
      await prisma.appointmentAttendee.createMany({
        data: attendeeIds.map((userId: string) => ({
          appointmentId: appointment.id,
          userId,
          isPrimary: false,
        })),
      });
    }

    if (patientId) {
      await prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId,
          opportunityId: opportunityId || null,
          userId: user.id,
          type: "APPOINTMENT",
          body: `Appointment created: ${appointment.title}`,
          metadata: {
            action: "appointment_created",
            appointmentId: appointment.id,
            patientId,
            providerId,
            appointmentTypeId: appointmentTypeId || null,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            createdBy: user.id,
          },
        },
      });
    }

    return NextResponse.json({ ...appointment, conflict, conflictMessage }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/appointments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
