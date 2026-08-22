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
  const { name } = body;

  if (!name || name.trim() === "") {
    return NextResponse.json(
      { error: "Designation name is required" },
      { status: 400 }
    );
  }

  const designation = await prisma.designation.update({
    where: { id },
    data: { name: name.trim() },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "DESIGNATION_UPDATED",
      entity: "Designation",
      entityId: id,
    },
  });

  return NextResponse.json(designation);
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

  const designation = await prisma.designation.findUnique({ where: { id } });
  if (!designation) {
    return NextResponse.json(
      { error: "Designation not found" },
      { status: 404 }
    );
  }

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "DESIGNATION_DELETED",
      entity: "Designation",
      entityId: id,
      metadata: { deletedName: designation.name },
    },
  });

  await prisma.designation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}