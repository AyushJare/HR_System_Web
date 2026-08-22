import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const approvals = await prisma.approval.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { fullName: true, employeeCode: true } },
    },
  });

  return NextResponse.json(approvals);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { type, actorId, details, remarks } = body;

  if (!type || !actorId) {
    return NextResponse.json(
      { error: "type and actorId are required" },
      { status: 400 }
    );
  }

  if (type !== "LEAVE" && type !== "ATTENDANCE_CORRECTION") {
    return NextResponse.json(
      { error: "type must be LEAVE or ATTENDANCE_CORRECTION" },
      { status: 400 }
    );
  }

  if (type === "LEAVE" && !details?.leaveTypeId) {
    return NextResponse.json(
      { error: "leaveTypeId is required for leave requests" },
      { status: 400 }
    );
  }

  const approval = await prisma.approval.create({
    data: {
      type,
      actorId,
      details: details || null,
      remarks: remarks || null,
    },
    include: {
      actor: { select: { fullName: true, employeeCode: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "APPROVAL_REQUESTED",
      entity: "Approval",
      entityId: approval.id,
      metadata: { type, forEmployeeId: actorId },
    },
  });

  return NextResponse.json(approval, { status: 201 });
}