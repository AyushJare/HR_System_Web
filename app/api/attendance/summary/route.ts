import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import {
    getWeeklyOffSettings,
    isWeeklyOff,
    getOffDatesForMonth,
} from "@/lib/attendanceUtils";

export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const employeeId =
            request.nextUrl.searchParams.get("employeeId") || session.sub;
        const yearParam = request.nextUrl.searchParams.get("year");
        const monthParam = request.nextUrl.searchParams.get("month");

        const now = new Date();
        const year = yearParam ? parseInt(yearParam) : now.getFullYear();
        const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

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
            },
        });

        if (!employee) {
            return NextResponse.json(
                { error: "Employee not found" },
                { status: 404 }
            );
        }

        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);

        const weeklyOffConfig = await getWeeklyOffSettings();
        const offDates = await getOffDatesForMonth(year, month);

        const attendances = await prisma.attendance.findMany({
            where: {
                employeeId,
                date: {
                    gte: monthStart,
                    lte: monthEnd,
                },
                deletedAt: null,
            },
            select: {
                id: true,
                date: true,
                status: true,
                checkInTime: true,
                checkOutTime: true,
            },
            orderBy: {
                date: "asc",
            },
        });

        let presentDays = 0;
        let absentDays = 0;
        let halfDays = 0;
        let onLeaveDays = 0;
        let weeklyOffDays = 0;
        let holidayDays = 0;

        const daysInMonth = monthEnd.getDate();
        const processedDates = new Set<string>();

        for (const att of attendances) {
            const dateStr = att.date.toISOString().split("T")[0];
            processedDates.add(dateStr);

            if (att.status === "PRESENT") {
                presentDays++;
            } else if (att.status === "HALF_DAY") {
                halfDays++;
            } else if (att.status === "ON_LEAVE") {
                onLeaveDays++;
            } else if (att.status === "WEEKLY_OFF") {
                weeklyOffDays++;
            } else if (att.status === "ABSENT") {
                const isDateWeeklyOff = isWeeklyOff(att.date, weeklyOffConfig);

                if (isDateWeeklyOff) {
                    weeklyOffDays++;
                } else {
                    absentDays++;
                }
            }
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dateStr = date.toISOString().split("T")[0];

            if (processedDates.has(dateStr)) {
                continue;
            }

            const offInfo = offDates.find(
                (off) => off.date.toISOString().split("T")[0] === dateStr
            );

            if (offInfo) {
                if (offInfo.reason === "WEEKLY_OFF") {
                    weeklyOffDays++;
                } else if (offInfo.reason === "HOLIDAY") {
                    holidayDays++;
                }
            } else {
                absentDays++;
            }
        }

        const totalOffDays = weeklyOffDays + holidayDays;
        const totalWorkingDays = daysInMonth - totalOffDays;

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
                monthName: new Date(year, month - 1, 1).toLocaleString("default", {
                    month: "long",
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

            calculations: {
                totalRecordedDays: attendances.length,
                totalOffDays,
                totalWorkingDays,
                attendancePercentage,
            },

            offDates: offDates.map((off) => ({
                date: off.date.toISOString().split("T")[0],
                reason: off.reason,
                details: off.details,
            })),

            summary: {
                message: `${employee.fullName} worked ${presentDays + halfDays} days out of ${totalWorkingDays} working days in ${new Date(year, month - 1, 1).toLocaleString("default", { month: "long", year: "numeric" })}`,
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