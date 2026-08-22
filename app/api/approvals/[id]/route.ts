import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { toDateOnlyUTC } from "@/lib/dateOnly";
import { getOrCreateLeaveBalance } from "@/lib/leaveBalance";

type Params = { id: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { decision, remarks } = body;

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json(
      { error: "decision must be APPROVED or REJECTED" },
      { status: 400 }
    );
  }

  const approval = await prisma.approval.findUnique({ where: { id } });
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (approval.status !== "PENDING") {
    return NextResponse.json(
      { error: "This request has already been decided" },
      { status: 409 }
    );
  }

  const details = approval.details as {
    date?: string;
    reason?: string;
    leaveTypeId?: string;
    timeIn?: string;
    timeOut?: string;
    status?: string;
  } | null;

  // Balance check happens BEFORE anything is written, and only blocks LEAVE approvals
  if (decision === "APPROVED" && approval.type === "LEAVE" && details?.leaveTypeId && details?.date) {
    const year = new Date(details.date).getUTCFullYear();
    const balance = await getOrCreateLeaveBalance(approval.actorId, details.leaveTypeId, year);

    if (balance.allocated - balance.used < 1) {
      return NextResponse.json(
        { error: `Insufficient leave balance. ${balance.used}/${balance.allocated} already used this year.` },
        { status: 409 }
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.approval.update({
      where: { id },
      data: { status: decision, remarks: remarks || approval.remarks },
    });

    if (decision === "APPROVED" && approval.type === "LEAVE" && details?.date) {
      const leaveDate = toDateOnlyUTC(details.date);

      await tx.attendance.upsert({
        where: {
          employeeId_date: { employeeId: approval.actorId, date: leaveDate },
        },
        update: { status: "ON_LEAVE" },
        create: { employeeId: approval.actorId, date: leaveDate, status: "ON_LEAVE" },
      });

      if (details.leaveTypeId) {
        const year = leaveDate.getUTCFullYear();
        const balance = await getOrCreateLeaveBalance(approval.actorId, details.leaveTypeId, year);
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { used: { increment: 1 } },
        });
      }
    }

    if (decision === "APPROVED" && approval.type === "ATTENDANCE_CORRECTION" && details?.date) {
      const correctionDate = toDateOnlyUTC(details.date);

      await tx.attendance.upsert({
        where: {
          employeeId_date: { employeeId: approval.actorId, date: correctionDate },
        },
        update: {
          timeIn: details.timeIn ? new Date(`${details.date}T${details.timeIn}:00`) : undefined,
          timeOut: details.timeOut ? new Date(`${details.date}T${details.timeOut}:00`) : undefined,
          status: (details.status as "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE") || undefined,
        },
        create: {
          employeeId: approval.actorId,
          date: correctionDate,
          timeIn: details.timeIn ? new Date(`${details.date}T${details.timeIn}:00`) : null,
          timeOut: details.timeOut ? new Date(`${details.date}T${details.timeOut}:00`) : null,
          status: (details.status as "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE") || "PRESENT",
        },
      });
    }

    return updated;
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: decision === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      entity: "Approval",
      entityId: id,
      metadata: { type: approval.type, forEmployeeId: approval.actorId },
    },
  });

  return NextResponse.json(result);
}