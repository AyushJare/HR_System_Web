import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { id: string };

type DayEntry = {
  day: number;
  dateStr: string;
  dayOfWeek: number;
  status: "FUTURE" | "WEEK_OFF" | "HOLIDAY" | "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "ON_LEAVE_SCHEDULED" | "NOT_MARKED"; timeIn: string | null;
  timeOut: string | null;
  reason: string | null;
  holidayName: string | null;
};

function isAttendanceStatus(
  status: string
): status is "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" {
  return (
    status === "PRESENT" ||
    status === "ABSENT" ||
    status === "HALF_DAY" ||
    status === "ON_LEAVE"
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 0));
  const daysInMonth = endDate.getUTCDate();

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const [employee, settings, holidays, attendances] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      select: {
        fullName: true,
        employeeCode: true,
        email: true,
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
    }),
    prisma.attendanceSettings.findFirst(),
    prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    }),
    prisma.attendance.findMany({
      where: { employeeId: id, date: { gte: startDate, lte: endDate } },
    }),
  ]);

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const weeklyOffDays = settings?.weeklyOffDays ?? [0];

  const holidayByDay = new Map<number, string>();
  holidays.forEach((h) => {
    holidayByDay.set(new Date(h.date).getUTCDate(), h.name);
  });

  const attendanceByDay = new Map<number, (typeof attendances)[number]>();
  attendances.forEach((a) => {
    attendanceByDay.set(new Date(a.date).getUTCDate(), a);
  });

  const days: DayEntry[] = [];
  const counts = {
    present: 0,
    absent: 0,
    halfDay: 0,
    onLeave: 0,
    weekOff: 0,
    holiday: 0,
    notMarked: 0,
  };

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, mon - 1, d));
    const dayOfWeek = dateObj.getUTCDay();
    const dateStr = dateObj.toISOString().slice(0, 10);
    const record = attendanceByDay.get(d);

    let status: DayEntry["status"];
    let timeIn: string | null = null;
    let timeOut: string | null = null;
    let reason: string | null = record?.reason ?? null;
    let holidayName: string | null = null;

    if (record && record.status === "ON_LEAVE") {
      // An approved leave always shows through, whether past or scheduled ahead
      status = dateObj > todayUTC ? "ON_LEAVE_SCHEDULED" : "ON_LEAVE";
      counts.onLeave++;
    } else if (dateObj > todayUTC) {
      status = "FUTURE";
    } else if (weeklyOffDays.includes(dayOfWeek)) {
      status = "WEEK_OFF";
      counts.weekOff++;
    } else if (holidayByDay.has(d)) {
      status = "HOLIDAY";
      holidayName = holidayByDay.get(d)!;
      counts.holiday++;
    } else if (record) {
      if (isAttendanceStatus(record.status)) {
        status = record.status;
      } else {
        status = "NOT_MARKED";
      }

      timeIn = record.checkInTime
        ? record.checkInTime.toISOString()
        : null;

      timeOut = record.checkOutTime
        ? record.checkOutTime.toISOString()
        : null;
      if (status === "PRESENT") counts.present++;
      if (status === "ABSENT") counts.absent++;
      if (status === "HALF_DAY") counts.halfDay++;
    } else {
      status = "NOT_MARKED";
      counts.notMarked++;
    }

    days.push({ day: d, dateStr, dayOfWeek, status, timeIn, timeOut, reason, holidayName });
  }

  return NextResponse.json({ employee, daysInMonth, days, counts });
}