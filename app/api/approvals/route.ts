import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requirePermissionOrAdmin("Approvals", "view");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const approvals = await prisma.approval.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      actor: {
        select: {
          fullName: true,
          employeeCode: true,
        },
      },
    },
  });

  return NextResponse.json(approvals);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermissionOrAdmin("Approvals", "edit");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const { type, actorId, details } = body ?? {};

  if (!type || !actorId || !details) {
    return NextResponse.json(
      { error: "type, actorId and details are required" },
      { status: 400 }
    );
  }

  if (type !== "LEAVE" && type !== "ATTENDANCE_CORRECTION") {
    return NextResponse.json(
      { error: "Invalid request type" },
      { status: 400 }
    );
  }

  const approval = await prisma.approval.create({
    data: {
      type,
      actorId,
      status: "PENDING",
      details,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "APPROVAL_REQUESTED",
      entity: "Approval",
      entityId: approval.id,
      metadata: { type, actorId },
    },
  });

  return NextResponse.json(approval, { status: 201 });
}