import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

type Params = { id: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requirePermissionOrAdmin("Approvals", "edit");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const decision = body?.decision;

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json(
      { error: "decision must be APPROVED or REJECTED" },
      { status: 400 }
    );
  }

  const existing = await prisma.approval.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json(
      { error: "Approval not found" },
      { status: 404 }
    );
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "This request has already been actioned" },
      { status: 409 }
    );
  }

  const updated = await prisma.approval.update({
    where: { id },
    data: {
      status: decision,
      remarks: body?.remarks ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: decision === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      entity: "Approval",
      entityId: id,
    },
  });

  return NextResponse.json(updated);
}