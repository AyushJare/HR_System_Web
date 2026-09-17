import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  requirePermissionOrAdmin,
} from "@/lib/auth";

import {
  finalizeAttendanceForDate,
} from "@/lib/attendanceAutomation";

import {
  getWeeklyOffConfigForEmployeeType,
  isWeeklyOff,
} from "@/lib/attendanceUtils";

function getTodayIndiaDateString(): string {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function isValidMonth(
  value: string
): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(
    value
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await requirePermissionOrAdmin(
        "Attendance Summary Report",
        "view"
      );

    if (!auth.ok) {
      return NextResponse.json(
        {
          error:
            auth.error,
        },
        {
          status:
            auth.status,
        }
      );
    }

    const month =
      request.nextUrl.searchParams.get(
        "month"
      );

    if (!month) {
      return NextResponse.json(
        {
          error:
            "month is required (YYYY-MM)",
        },
        { status: 400 }
      );
    }

    if (
      !isValidMonth(month)
    ) {
      return NextResponse.json(
        {
          error:
            "month must be in YYYY-MM format",
        },
        { status: 400 }
      );
    }

    const [
      year,
      mon,
    ] =
      month
        .split("-")
        .map(Number);

    const startDate =
      new Date(
        Date.UTC(
          year,
          mon - 1,
          1
        )
      );

    const endDate =
      new Date(
        Date.UTC(
          year,
          mon,
          0
        )
      );

    /*
     * ============================================================
     * SELF-HEAL REPORT DATA
     * ============================================================
     *
     * Finalize every completed date in this month.
     *
     * This means even if the daily cron fails, opening Reports
     * will correct completed days.
     *
     * Today is NOT finalized.
     */
    const todayIndia =
      getTodayIndiaDateString();

    const datesToFinalize: string[] =
      [];

    for (
      let current =
        new Date(startDate);
      current <= endDate;
      current.setUTCDate(
        current.getUTCDate() + 1
      )
    ) {
      const dateString =
        current
          .toISOString()
          .split("T")[0];

      if (
        dateString <
        todayIndia
      ) {
        datesToFinalize.push(
          dateString
        );
      }
    }

    /*
     * Process sequentially rather than firing hundreds
     * of simultaneous database operations.
     */
    for (const dateString of datesToFinalize) {
      await finalizeAttendanceForDate(
        dateString
      );
    }

    /*
     * ============================================================
     * LOAD REPORT
     * ============================================================
     */

    const [
      employees,
      holidays,
    ] =
      await Promise.all([
        prisma.employee.findMany(
          {
            where: {
              isActive: true,
            },

            orderBy: {
              employeeCode:
                "asc",
            },

            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              employeeTypeId: true,

              department: {
                select: {
                  name: true,
                },
              },

              attendances: {
                where: {
                  date: {
                    gte:
                      startDate,
                    lte:
                      endDate,
                  },

                  deletedAt:
                    null,
                },

                select: {
                  date: true,
                  status: true,
                },
              },
            },
          }
        ),

        prisma.holiday.findMany({
          where: {
            date: {
              gte:
                startDate,
              lte:
                endDate,
            },
          },

          include: {
            employeeTypeAssignments: {
              select: {
                employeeTypeId:
                  true,
              },
            },
          },
        }),
      ]);

    const summary =
      await Promise.all(
        employees.map(
          async (emp) => {
            const counts = {
              PRESENT: 0,
              ABSENT: 0,
              HALF_DAY: 0,
              ON_LEAVE: 0,
            };

            /*
             * Get the weekly-off configuration for this
             * employee's employee type.
             */
            const weeklyOffConfig =
              await getWeeklyOffConfigForEmployeeType(
                emp.employeeTypeId
              );

            /*
             * Build the set of holidays that actually
             * apply to this employee.
             *
             * No employee-type assignments means the
             * holiday applies to everyone.
             */
            const holidayDays =
              new Set<number>();

            holidays.forEach(
              (holiday) => {
                const assignments =
                  holiday.employeeTypeAssignments;

                const appliesToEmployee =
                  assignments.length ===
                  0 ||
                  (
                    emp.employeeTypeId !==
                    null &&
                    assignments.some(
                      (assignment) =>
                        assignment.employeeTypeId ===
                        emp.employeeTypeId
                    )
                  );

                if (
                  appliesToEmployee
                ) {
                  holidayDays.add(
                    new Date(
                      holiday.date
                    ).getUTCDate()
                  );
                }
              }
            );

            /*
             * Count only actual working-day
             * attendance records.
             *
             * If an attendance record exists on a
             * weekly-off or holiday, it must NOT be
             * counted as Present/Absent/etc. in the
             * monthly summary.
             *
             * The detailed attendance report follows
             * the same calendar precedence.
             */
            emp.attendances.forEach(
              (attendance) => {
                if (
                  attendance.status !==
                  "PRESENT" &&
                  attendance.status !==
                  "ABSENT" &&
                  attendance.status !==
                  "HALF_DAY" &&
                  attendance.status !==
                  "ON_LEAVE"
                ) {
                  return;
                }

                const attendanceDate =
                  new Date(
                    attendance.date
                  );

                const isOffDay =
                  isWeeklyOff(
                    attendanceDate,
                    weeklyOffConfig
                  );

                const isHoliday =
                  holidayDays.has(
                    attendanceDate.getUTCDate()
                  );

                /*
                 * If an actual attendance record exists,
                 * count it even when the date is a weekly
                 * off or holiday.
                 *
                 * Clock-in is currently allowed on those
                 * dates, so Reports Summary must match the
                 * actual attendance record.
                 */
                if (
                  isOffDay ||
                  isHoliday
                ) {
                  counts[
                    attendance.status
                  ] += 1;

                  return;
                }

                counts[
                  attendance.status
                ] += 1;
              }
            );

            return {
              employeeId:
                emp.id,

              employeeCode:
                emp.employeeCode,

              fullName:
                emp.fullName,

              department:
                emp.department?.name ??
                "-",

              present:
                counts.PRESENT,

              absent:
                counts.ABSENT,

              halfDay:
                counts.HALF_DAY,

              onLeave:
                counts.ON_LEAVE,

              totalMarked:
                counts.PRESENT +
                counts.ABSENT +
                counts.HALF_DAY +
                counts.ON_LEAVE,
            };
          }
        )
      );

    return NextResponse.json(
      summary
    );
  } catch (error) {
    console.error(
      "GET /api/reports/summary error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load attendance summary",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}