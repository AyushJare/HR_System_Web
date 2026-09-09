import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getWeeklyOffSettings } from "@/lib/attendanceUtils";
import { getTodayIndiaDateString } from "@/lib/attendanceAutomation";

type WeeklyOffConfig = Record<string, number[]>;

const EMPTY_WEEKLY_OFF_CONFIG: WeeklyOffConfig = {
    "0": [],
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": [],
};

function normalizeWeeklyOffConfig(value: unknown): WeeklyOffConfig {
    const config: WeeklyOffConfig = { ...EMPTY_WEEKLY_OFF_CONFIG };

    if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const day of Object.keys(config)) {
            const weeks = (value as Record<string, unknown>)[day];
            if (Array.isArray(weeks)) {
                config[day] = weeks.filter(
                    (week): week is number =>
                        typeof week === "number" &&
                        Number.isInteger(week) &&
                        week >= 1 &&
                        week <= 5
                );
            }
        }
        return config;
    }

    if (Array.isArray(value)) {
        for (const day of value) {
            if (
                typeof day === "number" &&
                Number.isInteger(day) &&
                day >= 0 &&
                day <= 6
            ) {
                config[day.toString()] = [1, 2, 3, 4, 5];
            }
        }
    }

    return config;
}

function getDateStringUTC(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function getWeekNumberOfMonth(date: Date): number {
    return Math.ceil(date.getUTCDate() / 7);
}

function isConfiguredWeeklyOff(
    date: Date,
    weeklyOffConfig: WeeklyOffConfig
): boolean {
    const dayOfWeek = date.getUTCDay();
    const weekOfMonth = getWeekNumberOfMonth(date);
    const offWeeks = weeklyOffConfig[dayOfWeek.toString()] || [];
    return offWeeks.includes(weekOfMonth);
}

function isAttendanceStatus(status: string): boolean {
    return (
        status === "PRESENT" ||
        status === "WORKED" ||
        status === "ABSENT" ||
        status === "HALF_DAY" ||
        status === "ON_LEAVE" ||
        status === "WEEKLY_OFF"
    );
}

export async function GET(request: NextRequest) {
    console.log("ATTENDANCE SUMMARY ROUTE HIT");

    try {
        const session = await getSession(request);

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requestedEmployeeId =
            request.nextUrl.searchParams.get("employeeId");
        const employeeId = requestedEmployeeId || session.sub;

        const yearParam = request.nextUrl.searchParams.get("year");
        const monthParam = request.nextUrl.searchParams.get("month");

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
                { error: "Invalid year or month" },
                { status: 400 }
            );
        }

        if (session.role !== "ADMIN" && employeeId !== session.sub) {
            return NextResponse.json(
                { error: "You can only view your own attendance summary" },
                { status: 403 }
            );
        }

        if (session.role !== "ADMIN") {
            const allowed = await checkPermission(
                session.sub,
                "Attendance",
                "view"
            );

            if (!allowed) {
                return NextResponse.json(
                    { error: "You don't have permission to view Attendance" },
                    { status: 403 }
                );
            }
        }

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                employeeCode: true,
                fullName: true,
                employeeTypeId: true,
            },
        });

        if (!employee) {
            return NextResponse.json(
                { error: "Employee not found" },
                { status: 404 }
            );
        }

        // Attendance and holiday dates are treated as date-only values.
        // UTC keeps the requested calendar day stable across server timezones.
        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const nextMonthStart = new Date(Date.UTC(year, month, 1));
        const daysInMonth = new Date(
            Date.UTC(year, month, 0)
        ).getUTCDate();

        const [weeklyOffSettings, holidays, attendances] = await Promise.all([
            getWeeklyOffSettings(),
            prisma.holiday.findMany({
                where: {
                    date: {
                        gte: monthStart,
                        lt: nextMonthStart,
                    },
                    employeeTypeAssignments: employee.employeeTypeId
                        ? {
                            some: {
                                employeeTypeId: employee.employeeTypeId,
                            },
                        }
                        : undefined,
                },
                select: {
                    id: true,
                    name: true,
                    date: true,
                },
                orderBy: { date: "asc" },
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
                orderBy: { date: "asc" },
            }),
        ]);

        const weeklyOffConfig = normalizeWeeklyOffConfig(weeklyOffSettings);

        const holidayByDate = new Map<string, { name: string }>();
        for (const holiday of holidays) {
            holidayByDate.set(getDateStringUTC(holiday.date), {
                name: holiday.name,
            });
        }

        const attendanceByDate = new Map<
            string,
            (typeof attendances)[number]
        >();
        for (const attendance of attendances) {
            attendanceByDate.set(
                getDateStringUTC(attendance.date),
                attendance
            );
        }

        const todayIndia = getTodayIndiaDateString();
        const todayAttendance = attendances.find(
            (attendance) => getDateStringUTC(attendance.date) === todayIndia
        );

        let presentDays = 0;
        let absentDays = 0;
        let halfDays = 0;
        let onLeaveDays = 0;

        // Weekly-off and holiday totals are calendar totals. They are counted
        // independently, matching the existing web attendance report behavior.
        // Therefore a holiday that falls on a weekly-off can contribute to both
        // totals while the daily calendar shows the holiday status.
        let weeklyOffDays = 0;
        let holidayDays = 0;

        const days = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(year, month - 1, day));
            const dateStr = getDateStringUTC(date);
            const dayOfWeek = date.getUTCDay();

            const attendance = attendanceByDate.get(dateStr);
            const holiday = holidayByDate.get(dateStr);
            const weeklyOff = isConfiguredWeeklyOff(
                date,
                weeklyOffConfig
            );

            // Count calendar-level off days independently, regardless of whether
            // another off reason exists on the same date.
            if (weeklyOff) weeklyOffDays++;
            if (holiday) holidayDays++;

            let status:
                | "FUTURE"
                | "WEEKLY_OFF"
                | "HOLIDAY"
                | "PRESENT"
                | "WORKED"
                | "ABSENT"
                | "HALF_DAY"
                | "ON_LEAVE";

            let reason: string | null = null;
            let holidayName: string | null = null;
            let timeIn: Date | null = null;
            let timeOut: Date | null = null;

            // A real attendance/leave record always wins over automatic calendar
            // status. This preserves today's WORKED behavior.
            if (attendance && isAttendanceStatus(attendance.status)) {
                status = attendance.status as typeof status;
                reason = attendance.reason ?? null;
                timeIn = attendance.checkInTime;
                timeOut = attendance.checkOutTime;

                if (
                    attendance.status === "PRESENT" ||
                    attendance.status === "WORKED"
                ) {
                    presentDays++;
                } else if (attendance.status === "HALF_DAY") {
                    halfDays++;
                } else if (attendance.status === "ON_LEAVE") {
                    onLeaveDays++;
                } else if (attendance.status === "ABSENT") {
                    // Explicit ABSENT on a configured off day is not treated as
                    // an absence in the monthly report.
                    if (weeklyOff) {
                        status = "WEEKLY_OFF";
                        reason = "WEEKLY_OFF";
                    } else if (holiday) {
                        status = "HOLIDAY";
                        reason = "HOLIDAY";
                        holidayName = holiday.name;
                    } else {
                        absentDays++;
                    }
                }
            } else if (holiday) {
                // Holiday takes visual precedence over weekly off when both apply.
                status = "HOLIDAY";
                reason = "HOLIDAY";
                holidayName = holiday.name;
            } else if (weeklyOff) {
                status = "WEEKLY_OFF";
                reason = "WEEKLY_OFF";
            } else if (dateStr > todayIndia) {
                // Future working days are neither absent nor working days yet.
                status = "FUTURE";
            } else {
                status = "ABSENT";
                absentDays++;
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

        const totalOffDays = weeklyOffDays + holidayDays;
        const totalWorkingDays = Math.max(0, daysInMonth - totalOffDays);

        const attendancePercentage =
            totalWorkingDays > 0
                ? Math.round(
                    ((presentDays + halfDays * 0.5) /
                        totalWorkingDays) *
                    100
                )
                : 0;

        return NextResponse.json({
            employee: {
                id: employee.id,
                code: employee.employeeCode,
                name: employee.fullName,
            },
            period: {
                year,
                month,
                monthName: new Date(
                    Date.UTC(year, month - 1, 1)
                ).toLocaleString("default", {
                    month: "long",
                    timeZone: "UTC",
                }),
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
            todayAttendance: todayAttendance
                ? {
                    id: todayAttendance.id,
                    date: todayIndia,
                    status: todayAttendance.status,
                    timeIn: todayAttendance.checkInTime,
                    timeOut: todayAttendance.checkOutTime,
                }
                : null,
            calculations: {
                totalRecordedDays: attendances.length,
                totalOffDays,
                totalWorkingDays,
                attendancePercentage,
            },
            offDates: days
                .filter(
                    (day) =>
                        day.status === "WEEKLY_OFF" ||
                        day.status === "HOLIDAY"
                )
                .map((day) => ({
                    date: day.dateStr,
                    reason: day.status,
                    details:
                        day.status === "HOLIDAY"
                            ? day.holidayName
                            : "Weekly Off",
                })),
            summary: {
                message: `${employee.fullName} worked ${presentDays + halfDays} days out of ${totalWorkingDays} working days in ${new Date(
                    Date.UTC(year, month - 1, 1)
                ).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                })}`,
                attendanceStatus:
                    attendancePercentage >= 75
                        ? "GOOD"
                        : attendancePercentage >= 50
                            ? "AVERAGE"
                            : "POOR",
            },
        });
    } catch (error) {
        console.error("GET /api/attendance/summary error:", error);

        return NextResponse.json(
            {
                error: "Failed to load attendance summary",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown server error",
            },
            { status: 500 }
        );
    }
}
