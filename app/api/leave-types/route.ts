import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requirePermissionOrAdmin("Leave Types", "view");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const leaveTypes = await prisma.leaveType.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(leaveTypes);
}

export async function POST(request: Request) {
  const auth = await requirePermissionOrAdmin("Leave Types", "add");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { name, code, defaultAnnualQuota } = body;

  if (!name || !code) {
    return NextResponse.json(
      { error: "name and code are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.leaveType.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { code: { equals: code, mode: "insensitive" } },
      ],
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A leave type with this name or code already exists" },
      { status: 409 }
    );
  }

  const leaveType = await prisma.leaveType.create({
    data: {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      defaultAnnualQuota: typeof defaultAnnualQuota === "number" ? defaultAnnualQuota : 12,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "LEAVE_TYPE_CREATED",
      entity: "LeaveType",
      entityId: leaveType.id,
    },
  });

  return NextResponse.json(leaveType, { status: 201 });
}