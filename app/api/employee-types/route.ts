import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const employeeTypes = await prisma.employeeType.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(employeeTypes);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
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

  const existing = await prisma.employeeType.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Employee type already exists" },
      { status: 409 }
    );
  }

  const employeeType = await prisma.employeeType.create({
    data: {
      name: name.trim(),
      noticePeriod: typeof noticePeriod === "number" ? noticePeriod : 30,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "EMPLOYEE_TYPE_CREATED",
      entity: "EmployeeType",
      entityId: employeeType.id,
    },
  });

  return NextResponse.json(employeeType, { status: 201 });
}