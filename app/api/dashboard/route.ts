import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requirePermissionOrAdmin("Dashboard", "view");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dayOfWeek = todayUTC.getUTCDay();

  const [settings, todayHoliday, activeEmployeeCount, todayAttendance, pendingApprovals, upcomingHolidays, recentLogs] =
    await Promise.all([
      prisma.attendanceSettings.findFirst(),
      prisma.holiday.findFirst({ where: { date: todayUTC } }),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.attendance.findMany({
        where: { date: todayUTC },
        select: { status: true, employeeId: true },
      }),
      prisma.approval.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { actor: { select: { fullName: true, employeeCode: true } } },
      }),
      prisma.holiday.findMany({
        where: { date: { gte: todayUTC } },
        orderBy: { date: "asc" },
        take: 5,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { employee: { select: { fullName: true } } },
      }),
    ]);

  const weeklyOffDays = settings?.weeklyOffDays ?? [0];
  const isWeekOff = weeklyOffDays.includes(dayOfWeek);
  const isHoliday = !!todayHoliday;

  const counts = { present: 0, absent: 0, halfDay: 0, onLeave: 0, notMarked: 0 };
  if (!isWeekOff && !isHoliday) {
    const markedIds = new Set<string>();
    todayAttendance.forEach((a) => {
      markedIds.add(a.employeeId);
      if (a.status === "PRESENT") counts.present++;
      if (a.status === "ABSENT") counts.absent++;
      if (a.status === "HALF_DAY") counts.halfDay++;
      if (a.status === "ON_LEAVE") counts.onLeave++;
    });
    counts.notMarked = activeEmployeeCount - markedIds.size;
  }

  const pendingApprovalsCount = await prisma.approval.count({ where: { status: "PENDING" } });

  return NextResponse.json({
    activeEmployeeCount,
    todayStatus: isWeekOff ? "WEEK_OFF" : isHoliday ? "HOLIDAY" : "WORKING_DAY",
    todayHolidayName: todayHoliday?.name ?? null,
    counts,
    pendingApprovalsCount,
    pendingApprovals,
    upcomingHolidays,
    recentLogs,
  });
}