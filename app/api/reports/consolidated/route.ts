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
        "Consolidated Report",
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

    const daysInMonth =
      endDate.getUTCDate();

    /*
     * ============================================================
     * SELF-HEAL COMPLETED DATES
     * ============================================================
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

    for (const dateString of datesToFinalize) {
      await finalizeAttendanceForDate(
        dateString
      );
    }

    /*
     * ============================================================
     * LOAD DATA
     * ============================================================
     */

    const employees =
      await prisma.employee.findMany(
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
                checkInTime: true,
                checkOutTime: true,
              },
            },
          },
        }
      );

    const holidays =
      await prisma.holiday.findMany(
        {
          where: {
            date: {
              gte:
                startDate,
              lte:
                endDate,
            },
          },

          select: {
            date: true,

            employeeTypeAssignments: {
              select: {
                employeeTypeId: true,
              },
            },
          },
        }
      );

    const statusCode: Record<
      string,
      string
    > = {
      PRESENT: "P",
      ABSENT: "A",
      HALF_DAY: "H",
      ON_LEAVE: "L",
      WEEKLY_OFF: "WO",
    };

    const rows =
      await Promise.all(
        employees.map(
          async (emp) => {
            const dayMap: Record<number, string> = {};

            const attendanceTimes: Record<
              number,
              {
                checkIn: string | null;
                checkOut: string | null;
              }
            > = {};

            emp.attendances.forEach((attendance) => {
              const day =
                new Date(
                  attendance.date
                ).getUTCDate();

              dayMap[day] =
                statusCode[
                attendance.status
                ] ?? "-";

              attendanceTimes[day] = {
                checkIn:
                  attendance.checkInTime
                    ? attendance.checkInTime.toISOString()
                    : null,

                checkOut:
                  attendance.checkOutTime
                    ? attendance.checkOutTime.toISOString()
                    : null,
              };
            });

            /*
             * ======================================================
             * EMPLOYEE-TYPE WEEKLY OFF CONFIG
             * ======================================================
             *
             * Each employee gets the weekly-off configuration
             * belonging to their employee type.
             *
             * Example:
             * Office employee -> 2nd / 4th Saturday OFF
             * Peon            -> Saturday can remain WORKING DAY
             * ======================================================
             */

            const weeklyOffConfig =
              await getWeeklyOffConfigForEmployeeType(
                emp.employeeTypeId
              );

            const days: string[] = [];

            for (
              let day = 1;
              day <= daysInMonth;
              day++
            ) {
              const date = new Date(
                Date.UTC(
                  year,
                  mon - 1,
                  day
                )
              );

              const holiday =
                holidays.find(
                  (item) =>
                    new Date(
                      item.date
                    ).getUTCDate() ===
                    day &&
                    item.employeeTypeAssignments.some(
                      (assignment) =>
                        assignment.employeeTypeId ===
                        emp.employeeTypeId
                    )
                );

              /*
               * If an attendance record exists, always use the
               * actual attendance status.
               *
               * This means an employee who clocks in on a
               * holiday or weekly off will be shown as P
               * instead of H or WO.
               */
              if (dayMap[day]) {
                days.push(
                  dayMap[day]
                );
              } else if (
                holiday
              ) {
                days.push(
                  "H"
                );
              } else if (
                isWeeklyOff(
                  date,
                  weeklyOffConfig
                )
              ) {
                days.push(
                  "WO"
                );
              } else {
                days.push(
                  "-"
                );
              }
            }

            return {
              employeeId:
                emp.id,

              employeeCode:
                emp.employeeCode,

              fullName:
                emp.fullName,

              days,

              attendanceTimes,
            };
          }
        )
      );

    return NextResponse.json({
      daysInMonth,
      rows,
    });
  } catch (error) {
    console.error(
      "GET /api/reports/consolidated error:",
      error
    );
    return NextResponse.json(
      {
        error:
          "Failed to load consolidated report",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}