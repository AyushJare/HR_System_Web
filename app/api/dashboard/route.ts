import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";
import {
  getWeeklyOffConfigForEmployeeType,
  isWeeklyOff,
} from "@/lib/attendanceUtils";

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

  const [
    activeEmployees,
    todayAttendance,
    pendingApprovals,
    upcomingHolidays,
    recentLogs,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        employeeTypeId: true,
      },
    }),

    prisma.attendance.findMany({
      where: {
        date: todayUTC,
      },
      select: {
        status: true,
        employeeId: true,
      },
    }),

    prisma.approval.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      include: {
        actor: {
          select: {
            fullName: true,
            employeeCode: true,
          },
        },
      },
    }),

    prisma.holiday.findMany({
      where: {
        date: {
          gte: todayUTC,
        },
      },
      orderBy: {
        date: "asc",
      },
      take: 5,
    }),

    prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      include: {
        employee: {
          select: {
            fullName: true,
          },
        },
      },
    }),
  ]);

  /*
   * ==========================================================
   * EMPLOYEE-TYPE-AWARE WEEKLY OFF / HOLIDAY CHECK
   * ==========================================================
   *
   * Different employee types can have different weekly offs.
   *
   * Example:
   * - Office employee -> 2nd / 4th Saturday OFF
   * - Peon -> Saturday is a working day
   *
   * Therefore the dashboard cannot use one global weekly-off
   * value for the entire company.
   * ==========================================================
   */

  const employeeWorkStatus = new Map<
    string,
    {
      isWeekOff: boolean;
      isHoliday: boolean;
    }
  >();

  let workingEmployeeCount = 0;
  let weekOffEmployeeCount = 0;
  let holidayEmployeeCount = 0;

  for (const employee of activeEmployees) {
    const weeklyOffConfig =
      await getWeeklyOffConfigForEmployeeType(
        employee.employeeTypeId
      );

    const employeeIsWeekOff =
      isWeeklyOff(
        todayUTC,
        weeklyOffConfig
      );

    const employeeIsHoliday =
      employee.employeeTypeId
        ? !!(await prisma.holiday.findFirst({
          where: {
            date: todayUTC,
            employeeTypeAssignments: {
              some: {
                employeeTypeId:
                  employee.employeeTypeId,
              },
            },
          },
          select: {
            id: true,
          },
        }))
        : false;

    employeeWorkStatus.set(
      employee.id,
      {
        isWeekOff: employeeIsWeekOff,
        isHoliday: employeeIsHoliday,
      }
    );

    if (employeeIsWeekOff) {
      weekOffEmployeeCount++;
    } else if (employeeIsHoliday) {
      holidayEmployeeCount++;
    } else {
      workingEmployeeCount++;
    }
  }

  /*
   * ==========================================================
   * TODAY STATUS
   * ==========================================================
   *
   * Keep the existing single todayStatus response field.
   *
   * If nobody is working today, report WEEK_OFF / HOLIDAY.
   * If at least one employee is working, report WORKING_DAY.
   *
   * This allows mixed employee-type schedules without treating
   * the entire company as being off.
   * ==========================================================
   */

  let todayStatus:
    | "WEEK_OFF"
    | "HOLIDAY"
    | "WORKING_DAY" = "WORKING_DAY";

  if (workingEmployeeCount === 0) {
    if (
      weekOffEmployeeCount > 0 &&
      holidayEmployeeCount === 0
    ) {
      todayStatus = "WEEK_OFF";
    } else if (
      holidayEmployeeCount > 0 &&
      weekOffEmployeeCount === 0
    ) {
      todayStatus = "HOLIDAY";
    } else {
      todayStatus = "WEEK_OFF";
    }
  }

  /*
   * ==========================================================
   * TODAY HOLIDAY NAME
   * ==========================================================
   *
   * Keep the existing field.
   *
   * Only show a holiday name when the holiday applies to at
   * least one active employee.
   * ==========================================================
   */

  let todayHolidayName: string | null = null;

  if (holidayEmployeeCount > 0) {
    const applicableHoliday =
      await prisma.holiday.findFirst({
        where: {
          date: todayUTC,
        },
        select: {
          name: true,
        },
      });

    todayHolidayName =
      applicableHoliday?.name ?? null;
  }

  /*
   * ==========================================================
   * ATTENDANCE COUNTS
   * ==========================================================
   *
   * Count attendance only for employees whose day is a
   * working day.
   *
   * Employees who are on their own weekly off / holiday are
   * excluded from PRESENT / ABSENT / HALF_DAY / ON_LEAVE /
   * NOT_MARKED calculations.
   * ==========================================================
   */

  const counts = {
    present: 0,
    absent: 0,
    halfDay: 0,
    onLeave: 0,
    notMarked: 0,
  };

  const markedIds = new Set<string>();

  todayAttendance.forEach((attendance) => {
    const workStatus =
      employeeWorkStatus.get(
        attendance.employeeId
      );

    if (
      !workStatus ||
      workStatus.isWeekOff ||
      workStatus.isHoliday
    ) {
      return;
    }

    markedIds.add(
      attendance.employeeId
    );

    if (
      attendance.status ===
      "PRESENT"
    ) {
      counts.present++;
    }

    if (
      attendance.status ===
      "ABSENT"
    ) {
      counts.absent++;
    }

    if (
      attendance.status ===
      "HALF_DAY"
    ) {
      counts.halfDay++;
    }

    if (
      attendance.status ===
      "ON_LEAVE"
    ) {
      counts.onLeave++;
    }
  });

  counts.notMarked =
    workingEmployeeCount -
    markedIds.size;

  /*
   * ==========================================================
   * PENDING APPROVAL COUNT
   * ==========================================================
   */

  const pendingApprovalsCount =
    await prisma.approval.count({
      where: {
        status: "PENDING",
      },
    });

  /*
   * ==========================================================
   * RESPONSE
   * ==========================================================
   */

  return NextResponse.json({
    activeEmployeeCount:
      activeEmployees.length,

    todayStatus,

    todayHolidayName,

    counts,

    pendingApprovalsCount,

    pendingApprovals,

    upcomingHolidays,

    recentLogs,
  });
}