import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { toDateOnlyUTC } from "@/lib/dateOnly";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const date = toDateOnlyUTC(dateParam);

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: "asc" },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      attendances: {
        where: { date },
        select: {
          id: true,
          timeIn: true,
          timeOut: true,
          status: true,
          reason: true,
        },
      },
    },
  });

  const result = employees.map((emp) => ({
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    fullName: emp.fullName,
    attendance: emp.attendances[0] || null,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { employeeId, date, timeIn, timeOut, status, reason } = body;

  if (!employeeId || !date) {
    return NextResponse.json(
      { error: "employeeId and date are required" },
      { status: 400 }
    );
  }

  const attendanceDate = toDateOnlyUTC(date);

  const attendance = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId,
        date: attendanceDate,
      },
    },
    update: {
      timeIn: timeIn ? new Date(`${date}T${timeIn}:00`) : null,
      timeOut: timeOut ? new Date(`${date}T${timeOut}:00`) : null,
      status: status || "PRESENT",
      reason: reason || null,
    },
    create: {
      employeeId,
      date: attendanceDate,
      timeIn: timeIn ? new Date(`${date}T${timeIn}:00`) : null,
      timeOut: timeOut ? new Date(`${date}T${timeOut}:00`) : null,
      status: status || "PRESENT",
      reason: reason || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "ATTENDANCE_MARKED",
      entity: "Attendance",
      entityId: attendance.id,
      metadata: { forEmployeeId: employeeId, date, status: status || "PRESENT" },
    },
  });

  return NextResponse.json(attendance);
}