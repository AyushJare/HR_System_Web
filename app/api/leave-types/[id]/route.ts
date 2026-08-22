import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

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
  const { name, code, defaultAnnualQuota } = body;

  const leaveType = await prisma.leaveType.update({
    where: { id },
    data: {
      name: name?.trim(),
      code: code?.trim().toUpperCase(),
      defaultAnnualQuota: typeof defaultAnnualQuota === "number" ? defaultAnnualQuota : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "LEAVE_TYPE_UPDATED",
      entity: "LeaveType",
      entityId: id,
    },
  });

  return NextResponse.json(leaveType);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const leaveType = await prisma.leaveType.findUnique({ where: { id } });
  if (!leaveType) {
    return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "LEAVE_TYPE_DELETED",
      entity: "LeaveType",
      entityId: id,
      metadata: { deletedName: leaveType.name },
    },
  });

  await prisma.leaveType.delete({ where: { id } });

  return NextResponse.json({ success: true });
}