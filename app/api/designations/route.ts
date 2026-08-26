import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const designations = await prisma.designation.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(designations);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();

  const { name, description } = body;

  if (!name || name.trim() === "") {
    return NextResponse.json(
      { error: "Designation name is required" },
      { status: 400 }
    );
  }

  const existing = await prisma.designation.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Designation already exists" },
      { status: 409 }
    );
  }

  const designation = await prisma.designation.create({
    data: {
      name: name.trim(),
      description:
        typeof description === "string" &&
          description.trim() !== ""
          ? description.trim()
          : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "DESIGNATION_CREATED",
      entity: "Designation",
      entityId: designation.id,
    },
  });

  return NextResponse.json(
    designation,
    { status: 201 }
  );
}
