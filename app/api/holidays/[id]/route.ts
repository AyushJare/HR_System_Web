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
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const holiday = await prisma.holiday.findUnique({
    where: { id },
  });

  if (!holiday) {
    return NextResponse.json(
      { error: "Holiday not found" },
      { status: 404 }
    );
  }

  const body = await request.json();

  const name = body.name?.trim();
  const date = body.date;
  const description = body.description;

  if (!name || !date) {
    return NextResponse.json(
      { error: "Holiday name and date are required" },
      { status: 400 }
    );
  }

  try {
    const updatedHoliday = await prisma.holiday.update({
      where: { id },
      data: {
        name,
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
        action: "HOLIDAY_UPDATED",
        entity: "Holiday",
        entityId: id,
        metadata: {
          oldName: holiday.name,
          oldDate: holiday.date,
          oldDescription: holiday.description,
          newName: updatedHoliday.name,
          newDate: updatedHoliday.date,
          newDescription: updatedHoliday.description,
        },
      },
    });

    return NextResponse.json(updatedHoliday);
  } catch (error) {
    // Duplicate holiday: same name + same date
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: `A holiday named "${name}" already exists on ${date}.`,
        },
        { status: 409 }
      );
    }

    console.error("Holiday update error:", error);

    return NextResponse.json(
      { error: "Failed to update holiday" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requireAdmin();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const holiday = await prisma.holiday.findUnique({
    where: { id },
  });

  if (!holiday) {
    return NextResponse.json(
      { error: "Holiday not found" },
      { status: 404 }
    );
  }

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "HOLIDAY_DELETED",
      entity: "Holiday",
      entityId: id,
      metadata: {
        deletedName: holiday.name,
      },
    },
  });

  await prisma.holiday.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
  });
}