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

  const holidays = await prisma.holiday.findMany({
    orderBy: { date: "asc" },
  });

  return NextResponse.json(holidays);
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

  const { name, date, description } = body;

  if (!name || name.trim() === "" || !date) {
    return NextResponse.json(
      { error: "Holiday name and date are required" },
      { status: 400 }
    );
  }

  const holiday = await prisma.holiday.create({
    data: {
      name: name.trim(),
      description:
        typeof description === "string" &&
          description.trim() !== ""
          ? description.trim()
          : null,
      date: new Date(date),
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "HOLIDAY_CREATED",
      entity: "Holiday",
      entityId: holiday.id,
    },
  });

  return NextResponse.json(holiday, { status: 201 });
}