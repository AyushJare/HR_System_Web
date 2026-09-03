import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";
import { isWeeklyOff, getWeekNumberOfMonth } from "@/lib/attendanceUtils";

export async function GET() {
  const auth = await requirePermissionOrAdmin("Dashboard", "view");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const indiaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const [year, month, day] = indiaToday
    .split("-")
    .map(Number);

  const todayUTC = new Date(
    Date.UTC(year, month - 1, day)
  );

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

  // Handle both old and new format for backward compatibility
  let weeklyOffConfig: Record<string, number[]> = {
    "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": []
  };

  if (settings?.weeklyOffDays) {
    if (typeof settings.weeklyOffDays === "object" && !Array.isArray(settings.weeklyOffDays)) {
      // New format (object)
      weeklyOffConfig = settings.weeklyOffDays as Record<string, number[]>;
    } else if (Array.isArray(settings.weeklyOffDays)) {
      // Old format (array) - convert to new format
      const oldDaysArray = settings.weeklyOffDays as number[];
      for (const day of oldDaysArray) {
        weeklyOffConfig[day.toString()] = [1, 2, 3, 4, 5];
      }
    }
  }

  const isWeekOff = isWeeklyOff(todayUTC, weeklyOffConfig);
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