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
                status: true,
              },
            },
          },
        }
      );

    const summary =
      employees.map(
        (emp) => {
          const counts = {
            PRESENT: 0,
            ABSENT: 0,
            HALF_DAY: 0,
            ON_LEAVE: 0,
          };

          emp.attendances.forEach(
            (attendance) => {
              if (
                attendance.status ===
                "PRESENT" ||
                attendance.status ===
                "ABSENT" ||
                attendance.status ===
                "HALF_DAY" ||
                attendance.status ===
                "ON_LEAVE"
              ) {
                counts[
                  attendance.status
                ] += 1;
              }
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
              emp.attendances
                .length,
          };
        }
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