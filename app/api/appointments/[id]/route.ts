import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { practice } = await requireUser();
    const { id } = await params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true, durationMins: true, bufferMins: true } },
        subcategory: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, practice } = await requireUser();
    const { id } = await params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

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
    } = body;

    const data: any = {};
    if (patientId !== undefined) data.patientId = patientId || null;
    if (opportunityId !== undefined) data.opportunityId = opportunityId || null;
    if (providerId !== undefined) data.providerId = providerId;
    if (appointmentTypeId !== undefined) data.appointmentTypeId = appointmentTypeId || null;
    if (subcategoryId !== undefined) data.subcategoryId = subcategoryId || null;
    if (appointmentCategory !== undefined) data.appointmentCategory = appointmentCategory;
    if (title !== undefined) data.title = title;
    if (isInternal !== undefined) data.isInternal = isInternal;
    if (startTime !== undefined) data.startTime = new Date(startTime);
    if (endTime !== undefined) data.endTime = new Date(endTime);
    if (bufferMins !== undefined) data.bufferMins = bufferMins;
    if (location !== undefined) data.location = location || null;
    if (notes !== undefined) data.notes = notes || null;
    if (roomName !== undefined) data.roomName = roomName || null;

    const startTimeChanged = startTime && new Date(startTime).getTime() !== appointment.startTime.getTime();

    const updated = await prisma.appointment.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true, durationMins: true, bufferMins: true } },
        subcategory: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
    });

    if (appointment.patientId) {
      if (startTimeChanged) {
        await prisma.activity.create({
          data: {
            practiceId: practice.id,
            patientId: appointment.patientId,
            opportunityId: appointment.opportunityId,
            userId: user.id,
            type: "APPOINTMENT",
            body: `Appointment rescheduled`,
            metadata: {
              action: "appointment_rescheduled",
              appointmentId: id,
              fromTime: appointment.startTime.toISOString(),
              toTime: new Date(startTime).toISOString(),
              movedBy: user.id,
            },
          },
        });
      } else {
        const changes: { field: string; oldValue: any; newValue: any }[] = [];
        if (providerId !== undefined && providerId !== appointment.providerId) {
          changes.push({ field: "providerId", oldValue: appointment.providerId, newValue: providerId });
        }
        if (endTime !== undefined && new Date(endTime).getTime() !== appointment.endTime.getTime()) {
          changes.push({ field: "endTime", oldValue: appointment.endTime.toISOString(), newValue: new Date(endTime).toISOString() });
        }
        if (notes !== undefined && notes !== appointment.notes) {
          changes.push({ field: "notes", oldValue: appointment.notes, newValue: notes });
        }
        if (roomName !== undefined && roomName !== appointment.roomName) {
          changes.push({ field: "roomName", oldValue: appointment.roomName, newValue: roomName });
        }
        if (appointmentTypeId !== undefined && appointmentTypeId !== appointment.appointmentTypeId) {
          changes.push({ field: "appointmentTypeId", oldValue: appointment.appointmentTypeId, newValue: appointmentTypeId });
        }

        if (changes.length > 0) {
          await prisma.activity.create({
            data: {
              practiceId: practice.id,
              patientId: appointment.patientId,
              opportunityId: appointment.opportunityId,
              userId: user.id,
              type: "APPOINTMENT",
              body: `Appointment updated`,
              metadata: {
                action: "appointment_updated",
                appointmentId: id,
                changes,
              },
            },
          });
        }
      }
    }

    let conflict = false;
    let conflictMessage = "";

    if (providerId || startTime || endTime) {
      const checkProviderId = providerId || appointment.providerId;
      const checkStart = startTime ? new Date(startTime) : appointment.startTime;
      const checkEnd = endTime ? new Date(endTime) : appointment.endTime;
      const checkBuffer = bufferMins !== undefined ? bufferMins : appointment.bufferMins;
      const bufferEnd = new Date(checkEnd.getTime() + checkBuffer * 60 * 1000);

      const overlapping = await prisma.appointment.findFirst({
        where: {
          practiceId: practice.id,
          providerId: checkProviderId,
          id: { not: id },
          deletedAt: null,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          AND: [
            { startTime: { lt: bufferEnd } },
            { endTime: { gt: checkStart } },
          ],
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          configuredType: { select: { name: true } },
        },
      });

      if (overlapping) {
        conflict = true;
        const patientName = overlapping.patient
          ? `${overlapping.patient.firstName} ${overlapping.patient.lastName}`
          : overlapping.title;
        const typeName = overlapping.configuredType?.name || overlapping.appointmentCategory;
        conflictMessage = `Provider has an overlapping appointment: ${patientName} - ${typeName}`;
      }
    }

    return NextResponse.json({ ...updated, conflict, conflictMessage });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, practice } = await requireAdmin();
    const { id } = await params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, practiceId: practice.id, deletedAt: null },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    await prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (appointment.patientId) {
      await prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId: appointment.patientId,
          opportunityId: appointment.opportunityId,
          userId: user.id,
          type: "APPOINTMENT",
          body: `Appointment deleted`,
          metadata: {
            action: "appointment_deleted",
            appointmentId: id,
            deletedBy: user.id,
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return NextResponse.json({ error: error.message }, { status: error.message === "Admin access required" ? 403 : 401 });
    }
    console.error("DELETE /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
