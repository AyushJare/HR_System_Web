import {
    NextRequest,
    NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import { getSession } from "@/lib/auth";

import { checkPermission } from "@/lib/permissions";

import {
    getWeeklyOffConfigForEmployeeType,
    isWeeklyOff,
} from "@/lib/attendanceUtils";

import {
    finalizeAttendanceForDate,
    getTodayIndiaDateString,
} from "@/lib/attendanceAutomation";

type WeeklyOffConfig = Record<string, number[]>;

function getDateStringUTC(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function isAttendanceStatus(status: string): boolean {
    return (
        status === "PRESENT" ||
        status === "ABSENT" ||
        status === "HALF_DAY" ||
        status === "ON_LEAVE"
    );
}

export async function GET(request: NextRequest) {
    console.log("ATTENDANCE SUMMARY ROUTE HIT");

    try {
        const session = await getSession(request);

        if (!session) {
            return NextResponse.json(
                {
                    error: "Unauthorized",
                },
                {
                    status: 401,
                }
            );
        }

        const requestedEmployeeId =
            request.nextUrl.searchParams.get(
                "employeeId"
            );

        const employeeId =
            requestedEmployeeId || session.sub;

        const yearParam =
            request.nextUrl.searchParams.get(
                "year"
            );

        const monthParam =
            request.nextUrl.searchParams.get(
                "month"
            );

        const now = new Date();

        const year = yearParam
            ? parseInt(yearParam, 10)
            : now.getUTCFullYear();

        const month = monthParam
            ? parseInt(monthParam, 10)
            : now.getUTCMonth() + 1;

        if (
            !Number.isInteger(year) ||
            year < 2020 ||
            year > 2100 ||
            !Number.isInteger(month) ||
            month < 1 ||
            month > 12
        ) {
            return NextResponse.json(
                {
                    error:
                        "Invalid year or month",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            session.role !== "ADMIN" &&
            employeeId !== session.sub
        ) {
            return NextResponse.json(
                {
                    error:
                        "You can only view your own attendance summary",
                },
                {
                    status: 403,
                }
            );
        }

        if (session.role !== "ADMIN") {
            const allowed =
                await checkPermission(
                    session.sub,
                    "Attendance",
                    "view"
                );

            if (!allowed) {
                return NextResponse.json(
                    {
                        error:
                            "You don't have permission to view Attendance",
                    },
                    {
                        status: 403,
                    }
                );
            }
        }

        const employee =
            await prisma.employee.findUnique({
                where: {
                    id: employeeId,
                },

                select: {
                    id: true,
                    employeeCode: true,
                    fullName: true,
                    employeeTypeId: true,
                },
            });

        if (!employee) {
            return NextResponse.json(
                {
                    error:
                        "Employee not found",
                },
                {
                    status: 404,
                }
            );
        }

        /*
         * ============================================================
         * DATE RANGE
         * ============================================================
         */

        const monthStart =
            new Date(
                Date.UTC(
                    year,
                    month - 1,
                    1
                )
            );

        const nextMonthStart =
            new Date(
                Date.UTC(
                    year,
                    month,
                    1
                )
            );

        const endDate =
            new Date(
                Date.UTC(
                    year,
                    month,
                    0
                )
            );

        const daysInMonth =
            endDate.getUTCDate();

        /*
         * ============================================================
         * SELF-HEAL COMPLETED ATTENDANCE
         * ============================================================
         *
         * Keep this consistent with the web attendance report.
         *
         * Completed working days without attendance are finalized
         * before the monthly summary is calculated.
         *
         * Today is intentionally NOT finalized.
         */

        const todayIndia =
            getTodayIndiaDateString();

        const datesToFinalize: string[] =
            [];

        for (
            let current =
                new Date(monthStart);
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

        for (
            const dateString of datesToFinalize
        ) {
            await finalizeAttendanceForDate(
                dateString
            );
        }

        /*
         * ============================================================
         * LOAD DATA
         * ============================================================
         *
         * Important:
         * Load ALL holidays for the month.
         *
         * A holiday with no employee-type assignments applies
         * to everyone. Filtering the Prisma relation directly
         * would incorrectly remove those holidays.
         */

        const [
            weeklyOffConfig,
            holidays,
            attendances,
        ] = await Promise.all([
            getWeeklyOffConfigForEmployeeType(
                employee.employeeTypeId
            ),

            prisma.holiday.findMany({
                where: {
                    date: {
                        gte: monthStart,
                        lt: nextMonthStart,
                    },
                },

                select: {
                    id: true,
                    name: true,
                    date: true,

                    employeeTypeAssignments: {
                        select: {
                            employeeTypeId: true,
                        },
                    },
                },

                orderBy: {
                    date: "asc",
                },
            }),

            prisma.attendance.findMany({
                where: {
                    employeeId,

                    date: {
                        gte: monthStart,
                        lt: nextMonthStart,
                    },

                    deletedAt: null,
                },

                select: {
                    id: true,
                    date: true,
                    status: true,
                    reason: true,
                    checkInTime: true,
                    checkOutTime: true,
                },

                orderBy: {
                    date: "asc",
                },
            }),
        ]);

        /*
         * ============================================================
         * EMPLOYEE-APPLICABLE HOLIDAYS
         * ============================================================
         *
         * Same logic as /api/reports/summary:
         *
         * - No assignments = holiday applies to everyone
         * - Assignments exist = holiday applies only to matching
         *   employee type
         */

        const holidayByDate =
            new Map<
                string,
                { name: string }
            >();

        for (
            const holiday of holidays
        ) {
            const assignments =
                holiday.employeeTypeAssignments;

            const appliesToEmployee =
                assignments.length === 0 ||
                (
                    employee.employeeTypeId !== null &&
                    assignments.some(
                        (
                            assignment
                        ) =>
                            assignment.employeeTypeId ===
                            employee.employeeTypeId
                    )
                );

            if (
                appliesToEmployee
            ) {
                holidayByDate.set(
                    getDateStringUTC(
                        holiday.date
                    ),
                    {
                        name:
                            holiday.name,
                    }
                );
            }
        }

        /*
         * ============================================================
         * ATTENDANCE BY DATE
         * ============================================================
         */

        const attendanceByDate =
            new Map<
                string,
                (typeof attendances)[number]
            >();

        for (
            const attendance of attendances
        ) {
            attendanceByDate.set(
                getDateStringUTC(
                    attendance.date
                ),
                attendance
            );
        }

        const todayAttendance =
            attendances.find(
                (
                    attendance
                ) =>
                    getDateStringUTC(
                        attendance.date
                    ) === todayIndia
            );

        /*
         * ============================================================
         * MONTHLY COUNTERS
         * ============================================================
         */

        let presentDays = 0;
        let absentDays = 0;
        let halfDays = 0;
        let onLeaveDays = 0;

        let weeklyOffDays = 0;
        let holidayDays = 0;

        const days = [];

        /*
         * Keep track of unique calendar off-days.
         *
         * If a holiday and weekly off happen on the same date,
         * it is only one non-working date for totalWorkingDays.
         */

        const offDateSet =
            new Set<string>();

        /*
         * ============================================================
         * BUILD DAILY CALENDAR
         * ============================================================
         */

        for (
            let day = 1;
            day <= daysInMonth;
            day++
        ) {
            const date =
                new Date(
                    Date.UTC(
                        year,
                        month - 1,
                        day
                    )
                );

            const dateStr =
                getDateStringUTC(
                    date
                );

            const dayOfWeek =
                date.getUTCDay();

            const attendance =
                attendanceByDate.get(
                    dateStr
                );

            const holiday =
                holidayByDate.get(
                    dateStr
                );

            /*
             * IMPORTANT:
             *
             * Use the SAME weekly-off utility as the web report.
             */
            const weeklyOff =
                isWeeklyOff(
                    date,
                    weeklyOffConfig
                );

            if (weeklyOff) {
                weeklyOffDays++;
                offDateSet.add(
                    dateStr
                );
            }

            if (holiday) {
                holidayDays++;
                offDateSet.add(
                    dateStr
                );
            }

            let status:
                | "FUTURE"
                | "WEEKLY_OFF"
                | "HOLIDAY"
                | "PRESENT"
                | "ABSENT"
                | "HALF_DAY"
                | "ON_LEAVE"
                | "NOT_MARKED";

            let reason:
                string | null = null;

            let holidayName:
                string | null = null;

            let timeIn:
                Date | null = null;

            let timeOut:
                Date | null = null;

            /*
             * ========================================================
             * CALENDAR PRECEDENCE
             * ========================================================
             *
             * Holiday / weekly off takes precedence for the
             * monthly calendar.
             *
             * Attendance records on these dates are NOT counted
             * toward Present / Absent / Half Day / Leave.
             *
             * This matches the web report.
             */

            if (holiday) {
                status = "HOLIDAY";

                reason = "HOLIDAY";

                holidayName =
                    holiday.name;

                if (attendance) {
                    timeIn =
                        attendance.checkInTime;

                    timeOut =
                        attendance.checkOutTime;
                }
            } else if (weeklyOff) {
                status =
                    "WEEKLY_OFF";

                reason =
                    "WEEKLY_OFF";

                if (attendance) {
                    timeIn =
                        attendance.checkInTime;

                    timeOut =
                        attendance.checkOutTime;
                }
            } else if (
                attendance &&
                isAttendanceStatus(
                    attendance.status
                )
            ) {
                status =
                    attendance.status as typeof status;

                reason =
                    attendance.reason ??
                    null;

                timeIn =
                    attendance.checkInTime;

                timeOut =
                    attendance.checkOutTime;

                if (
                    attendance.status ===
                    "PRESENT"
                ) {
                    presentDays++;
                } else if (
                    attendance.status ===
                    "HALF_DAY"
                ) {
                    halfDays++;
                } else if (
                    attendance.status ===
                    "ON_LEAVE"
                ) {
                    onLeaveDays++;
                } else if (
                    attendance.status ===
                    "ABSENT"
                ) {
                    absentDays++;
                }
            } else if (
                dateStr > todayIndia
            ) {
                status =
                    "FUTURE";
            } else {
                status =
                    "NOT_MARKED";
            }

            days.push({
                day,
                dateStr,
                dayOfWeek,
                status,
                timeIn,
                timeOut,
                reason,
                holidayName,
            });
        }

        /*
         * ============================================================
         * FINAL CALCULATIONS
         * ============================================================
         */

        const totalOffDays =
            offDateSet.size;

        const totalWorkingDays =
            Math.max(
                0,
                daysInMonth -
                totalOffDays
            );

        const attendancePercentage =
            totalWorkingDays > 0
                ? Math.round(
                    (
                        (
                            presentDays +
                            halfDays * 0.5
                        ) /
                        totalWorkingDays
                    ) * 100
                )
                : 0;

        /*
         * ============================================================
         * RESPONSE
         * ============================================================
         */

        return NextResponse.json({
            employee: {
                id: employee.id,
                code:
                    employee.employeeCode,
                name:
                    employee.fullName,
            },

            period: {
                year,
                month,

                monthName:
                    new Date(
                        Date.UTC(
                            year,
                            month - 1,
                            1
                        )
                    ).toLocaleString(
                        "default",
                        {
                            month:
                                "long",
                            timeZone:
                                "UTC",
                        }
                    ),

                daysInMonth,
            },

            attendance: {
                presentDays,
                halfDays,
                absentDays,
                onLeaveDays,
                weeklyOffDays,
                holidayDays,
            },

            days,

            todayAttendance:
                todayAttendance
                    ? {
                        id:
                            todayAttendance.id,

                        date:
                            todayIndia,

                        status:
                            todayAttendance.status,

                        timeIn:
                            todayAttendance.checkInTime,

                        timeOut:
                            todayAttendance.checkOutTime,
                    }
                    : null,

            calculations: {
                totalRecordedDays:
                    attendances.length,

                totalOffDays,

                totalWorkingDays,

                attendancePercentage,
            },

            offDates:
                days
                    .filter(
                        (day) =>
                            day.status ===
                            "WEEKLY_OFF" ||
                            day.status ===
                            "HOLIDAY"
                    )
                    .map(
                        (day) => ({
                            date:
                                day.dateStr,

                            reason:
                                day.status,

                            details:
                                day.status ===
                                    "HOLIDAY"
                                    ? day.holidayName
                                    : "Weekly Off",
                        })
                    ),

            summary: {
                message:
                    `${employee.fullName} worked ${presentDays + halfDays
                    } days out of ${totalWorkingDays
                    } working days in ${new Date(
                        Date.UTC(
                            year,
                            month - 1,
                            1
                        )
                    ).toLocaleString(
                        "default",
                        {
                            month:
                                "long",
                            year:
                                "numeric",
                            timeZone:
                                "UTC",
                        }
                    )}`,

                attendanceStatus:
                    attendancePercentage >=
                        75
                        ? "GOOD"
                        : attendancePercentage >=
                            50
                            ? "AVERAGE"
                            : "POOR",
            },
        });
    } catch (error) {
        console.error(
            "GET /api/attendance/summary error:",
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
            {
                status: 500,
            }
        );
    }
}