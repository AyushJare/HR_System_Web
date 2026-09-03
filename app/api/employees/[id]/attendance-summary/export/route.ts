import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isWeeklyOff } from "@/lib/attendanceUtils";

type Params = {
    id: string;
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

function formatTime(
    value: Date | null
): string {
    if (!value) return "";

    return value.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export async function GET(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<Params>;
    }
) {
    try {
        const { id } = await params;

        /*
         * ==========================================================
         * AUTHENTICATION
         * ==========================================================
         */

        const session = await getSession();

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

        /*
         * ==========================================================
         * PERMISSION
         * ==========================================================
         */

        if (session.role !== "ADMIN") {
            const employeeAllowed =
                await import("@/lib/permissions").then(
                    ({ checkPermission }) =>
                        checkPermission(
                            session.sub,
                            "Employee Attendance Summary",
                            "export"
                        )
                );

            if (!employeeAllowed) {
                return NextResponse.json(
                    {
                        error:
                            "You don't have permission to export employee attendance summary",
                    },
                    {
                        status: 403,
                    }
                );
            }
        }

        /*
         * ==========================================================
         * MONTH VALIDATION
         * ==========================================================
         */

        const month =
            request.nextUrl.searchParams.get(
                "month"
            );

        if (!month) {
            return NextResponse.json(
                {
                    error: "month is required (YYYY-MM)",
                },
                {
                    status: 400,
                }
            );
        }

        const monthMatch =
            /^(\d{4})-(\d{2})$/.exec(month);

        if (!monthMatch) {
            return NextResponse.json(
                {
                    error:
                        "Invalid month format. Expected YYYY-MM",
                },
                {
                    status: 400,
                }
            );
        }

        const year = Number(monthMatch[1]);
        const monthNumber =
            Number(monthMatch[2]);

        if (
            monthNumber < 1 ||
            monthNumber > 12
        ) {
            return NextResponse.json(
                {
                    error: "Invalid month",
                },
                {
                    status: 400,
                }
            );
        }

        const startDate = new Date(
            Date.UTC(
                year,
                monthNumber - 1,
                1
            )
        );

        const endDate = new Date(
            Date.UTC(
                year,
                monthNumber,
                0
            )
        );

        const daysInMonth =
            endDate.getUTCDate();

        /*
         * ==========================================================
         * FETCH DATA
         * ==========================================================
         */

        const [
            employee,
            settings,
            holidays,
            attendances,
        ] = await Promise.all([
            prisma.employee.findUnique({
                where: {
                    id,
                },
                select: {
                    fullName: true,
                    employeeCode: true,
                    email: true,
                    department: {
                        select: {
                            name: true,
                        },
                    },
                    designation: {
                        select: {
                            name: true,
                        },
                    },
                },
            }),

            prisma.attendanceSettings.findFirst(),

            prisma.holiday.findMany({
                where: {
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            }),

            prisma.attendance.findMany({
                where: {
                    employeeId: id,
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: {
                    date: "asc",
                },
            }),
        ]);

        if (!employee) {
            return NextResponse.json(
                {
                    error: "Employee not found",
                },
                {
                    status: 404,
                }
            );
        }

        /*
         * ==========================================================
         * WEEKLY OFF CONFIG
         * ==========================================================
         */

        let weeklyOffConfig: Record<
            string,
            number[]
        > = {
            "0": [],
            "1": [],
            "2": [],
            "3": [],
            "4": [],
            "5": [],
            "6": [],
        };

        if (settings?.weeklyOffDays) {
            if (
                typeof settings.weeklyOffDays ===
                "object" &&
                !Array.isArray(
                    settings.weeklyOffDays
                )
            ) {
                weeklyOffConfig =
                    settings.weeklyOffDays as Record<
                        string,
                        number[]
                    >;
            } else if (
                Array.isArray(
                    settings.weeklyOffDays
                )
            ) {
                const oldDaysArray =
                    settings.weeklyOffDays as number[];

                for (const day of oldDaysArray) {
                    weeklyOffConfig[
                        day.toString()
                    ] = [1, 2, 3, 4, 5];
                }
            }
        }

        /*
         * ==========================================================
         * LOOKUP MAPS
         * ==========================================================
         */

        const holidayByDay =
            new Map<number, string>();

        holidays.forEach((holiday) => {
            holidayByDay.set(
                new Date(
                    holiday.date
                ).getUTCDate(),
                holiday.name
            );
        });

        const attendanceByDay =
            new Map<
                number,
                (typeof attendances)[number]
            >();

        attendances.forEach((attendance) => {
            attendanceByDay.set(
                new Date(
                    attendance.date
                ).getUTCDate(),
                attendance
            );
        });

        /*
         * ==========================================================
         * TODAY
         * ==========================================================
         */

        const indiaToday =
            new Intl.DateTimeFormat(
                "en-CA",
                {
                    timeZone:
                        "Asia/Kolkata",
                }
            ).format(new Date());

        const [
            todayYear,
            todayMonth,
            todayDay,
        ] = indiaToday
            .split("-")
            .map(Number);

        const todayUTC = new Date(
            Date.UTC(
                todayYear,
                todayMonth - 1,
                todayDay
            )
        );

        /*
         * ==========================================================
         * CREATE WORKBOOK
         * ==========================================================
         */

        const workbook =
            new ExcelJS.Workbook();

        const worksheet =
            workbook.addWorksheet(
                "Attendance Summary"
            );

        /*
         * Employee information
         */

        worksheet.addRow([
            "Employee Code",
            employee.employeeCode,
        ]);

        worksheet.addRow([
            "Employee Name",
            employee.fullName,
        ]);

        worksheet.addRow([
            "Email",
            employee.email,
        ]);

        worksheet.addRow([
            "Department",
            employee.department?.name ?? "",
        ]);

        worksheet.addRow([
            "Designation",
            employee.designation?.name ?? "",
        ]);

        worksheet.addRow([
            "Month",
            month,
        ]);

        worksheet.addRow([]);

        /*
         * ==========================================================
         * TABLE HEADERS
         * ==========================================================
         */

        const headerRow =
            worksheet.addRow([
                "Date",
                "Day",
                "Status",
                "Time In",
                "Time Out",
                "Note",
            ]);

        headerRow.font = {
            bold: true,
            color: {
                argb: "FFFFFFFF",
            },
        };

        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
                argb: "FF1F4E78",
            },
        };

        headerRow.alignment = {
            horizontal: "center",
            vertical: "middle",
        };

        /*
         * ==========================================================
         * ATTENDANCE ROWS
         * ==========================================================
         */

        const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];

        for (
            let day = 1;
            day <= daysInMonth;
            day++
        ) {
            const dateObj = new Date(
                Date.UTC(
                    year,
                    monthNumber - 1,
                    day
                )
            );

            const dayOfWeek =
                dateObj.getUTCDay();

            const dateStr =
                dateObj
                    .toISOString()
                    .slice(0, 10);

            const record =
                attendanceByDay.get(day);

            let status = "NOT_MARKED";
            let timeIn = "";
            let timeOut = "";
            let note = "";

            if (
                record &&
                record.status ===
                "ON_LEAVE"
            ) {
                status = "ON_LEAVE";
                note = record.reason ?? "";
            } else if (
                dateObj > todayUTC
            ) {
                status = "FUTURE";
            } else if (
                isWeeklyOff(
                    dateObj,
                    weeklyOffConfig
                )
            ) {
                status = "WEEK_OFF";
            } else if (
                holidayByDay.has(day)
            ) {
                status = "HOLIDAY";
                note =
                    holidayByDay.get(day) ?? "";
            } else if (record) {
                status = isAttendanceStatus(
                    record.status
                )
                    ? record.status
                    : "NOT_MARKED";

                timeIn = formatTime(
                    record.checkInTime
                );

                timeOut = formatTime(
                    record.checkOutTime
                );

                note = record.reason ?? "";
            }

            worksheet.addRow([
                dateStr,
                dayNames[dayOfWeek],
                status,
                timeIn,
                timeOut,
                note,
            ]);
        }

        /*
         * ==========================================================
         * COLUMN WIDTHS
         * ==========================================================
         */

        worksheet.columns = [
            {
                width: 15,
            },
            {
                width: 16,
            },
            {
                width: 20,
            },
            {
                width: 15,
            },
            {
                width: 15,
            },
            {
                width: 40,
            },
        ];

        /*
         * ==========================================================
         * FREEZE TABLE HEADER
         * ==========================================================
         */

        worksheet.views = [
            {
                state: "frozen",
                ySplit: 7,
            },
        ];

        /*
         * ==========================================================
         * GENERATE FILE
         * ==========================================================
         */

        const buffer =
            await workbook.xlsx.writeBuffer();

        const safeName =
            employee.fullName
                .replace(
                    /[^a-zA-Z0-9-_]+/g,
                    "_"
                )
                .replace(
                    /^_+|_+$/g,
                    ""
                ) || "employee";

        const filename =
            `${safeName}_Attendance_Summary_${month}.xlsx`;

        /*
         * ==========================================================
         * RESPONSE
         * ==========================================================
         */

        return new NextResponse(
            Buffer.from(buffer),
            {
                headers: {
                    "Content-Type":
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                    "Content-Disposition":
                        `attachment; filename="${filename}"`,

                    "Content-Length":
                        buffer.byteLength.toString(),

                    "Cache-Control":
                        "no-cache, no-store, must-revalidate",
                },
            }
        );
    } catch (error) {
        console.error(
            "GET /api/employees/[id]/attendance-summary/export error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to export attendance summary",
            },
            {
                status: 500,
            }
        );
    }
}