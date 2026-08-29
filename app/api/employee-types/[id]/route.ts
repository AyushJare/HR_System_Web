import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

type Params = { id: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requirePermissionOrAdmin("Employee Types", "edit");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { name, noticePeriod } = body;

  if (!name || name.trim() === "") {
    return NextResponse.json(
      { error: "Employee type name is required" },
      { status: 400 }
    );
  }

  const employeeType = await prisma.employeeType.update({
    where: { id },
    data: {
      name: name.trim(),
      noticePeriod: typeof noticePeriod === "number" ? noticePeriod : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "EMPLOYEE_TYPE_UPDATED",
      entity: "EmployeeType",
      entityId: id,
    },
  });

  return NextResponse.json(employeeType);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requirePermissionOrAdmin("Employee Types", "delete");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const employeeType = await prisma.employeeType.findUnique({ where: { id } });
  if (!employeeType) {
    return NextResponse.json({ error: "Employee type not found" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "EMPLOYEE_TYPE_DELETED",
      entity: "EmployeeType",
      entityId: id,
      metadata: { deletedName: employeeType.name },
    },
  });

  await prisma.employeeType.delete({ where: { id } });
  return NextResponse.json({ success: true });
}