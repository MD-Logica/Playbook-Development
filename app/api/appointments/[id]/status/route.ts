import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const VALID_FORWARD_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["ROOMED", "CANCELLED", "NO_SHOW"],
  ROOMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["ENDED", "CANCELLED", "NO_SHOW"],
  ENDED: ["CHECKED_OUT", "CANCELLED", "NO_SHOW"],
};

const TERMINAL_STATUSES = ["CHECKED_OUT", "CANCELLED", "NO_SHOW"];

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
    const { status, reason } = body;

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const currentStatus = appointment.status;

    if (TERMINAL_STATUSES.includes(currentStatus)) {
      return NextResponse.json(
        { error: `Cannot change status from terminal status ${currentStatus}` },
        { status: 400 }
      );
    }

    const allowedTransitions = VALID_FORWARD_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        { error: `Invalid transition from ${currentStatus} to ${status}` },
        { status: 400 }
      );
    }

    const data: any = { status };
    const now = new Date();

    switch (status) {
      case "CHECKED_IN":
        data.checkedInAt = now;
        break;
      case "ROOMED":
        data.roomedAt = now;
        break;
      case "IN_PROGRESS":
        break;
      case "ENDED":
        data.appointmentEndedAt = now;
        break;
      case "CHECKED_OUT":
        data.checkedOutAt = now;
        break;
      case "CANCELLED":
        data.cancelledAt = now;
        if (reason) data.cancelReason = reason;
        break;
      case "NO_SHOW":
        data.noShowAt = now;
        break;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        configuredType: { select: { id: true, name: true, color: true } },
      },
    });

    let activityBody = `Appointment status changed: ${currentStatus} → ${status}`;
    let metadata: any = {
      action: "appointment_status_changed",
      appointmentId: id,
      fromStatus: currentStatus,
      toStatus: status,
      changedBy: user.id,
    };

    if (status === "CANCELLED") {
      activityBody = `Appointment cancelled${reason ? `: ${reason}` : ""}`;
      metadata = {
        action: "appointment_cancelled",
        appointmentId: id,
        reason: reason || null,
        cancelledBy: user.id,
      };
    } else if (status === "NO_SHOW") {
      activityBody = `Patient marked as no-show`;
      metadata = {
        action: "appointment_no_show",
        appointmentId: id,
        markedBy: user.id,
      };
    }

    if (appointment.patientId) {
      await prisma.activity.create({
        data: {
          practiceId: practice.id,
          patientId: appointment.patientId,
          opportunityId: appointment.opportunityId,
          userId: user.id,
          type: "APPOINTMENT",
          body: activityBody,
          metadata,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/appointments/[id]/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
