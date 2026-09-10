import {
    NextRequest,
    NextResponse,
} from "next/server";

import ExcelJS from "exceljs";

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

function styleHeader(
    worksheet: ExcelJS.Worksheet
) {
    const header =
        worksheet.getRow(1);

    header.font = {
        bold: true,
        color: {
            argb: "FFFFFFFF",
        },
    };

    header.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
            argb: "FF0F172A",
        },
    };

    header.alignment = {
        vertical: "middle",
        horizontal: "center",
    };
}

export async function GET(
    request: NextRequest
) {
    try {
        const auth =
            await requirePermissionOrAdmin(
                "Reports",
                "export"
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
         * SELF-HEAL REPORT DATA
         * ============================================================
         *
         * Finalize every completed date in this month.
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
                                date: true,
                                status: true,
                                checkInTime: true,
                                checkOutTime: true,
                            },
                        },
                    },
                }
            );

        /*
         * ============================================================
         * ATTENDANCE SUMMARY DATA
         * ============================================================
         */

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

        /*
         * ============================================================
         * CONSOLIDATED DATA
         * ============================================================
         */

        const statusCode: Record<
            string,
            string
        > = {
            PRESENT: "P",
            ABSENT: "A",
            HALF_DAY: "H",
            ON_LEAVE: "L",
        };

        /*
         * Format attendance time in India time.
         */
        const formatExportTime = (
            value: Date | null
        ): string => {
            if (!value) {
                return "--:--";
            }

            return new Intl.DateTimeFormat(
                "en-IN",
                {
                    timeZone:
                        "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                }
            ).format(value);
        };

        /*
         * Calculate total worked duration.
         */
        const calculateWorkedDuration = (
            checkIn: Date | null,
            checkOut: Date | null
        ): string => {
            if (
                !checkIn ||
                !checkOut
            ) {
                return "--";
            }

            const durationMs =
                checkOut.getTime() -
                checkIn.getTime();

            if (
                durationMs < 0
            ) {
                return "--";
            }

            const totalMinutes =
                Math.floor(
                    durationMs /
                    (1000 * 60)
                );

            const hours =
                Math.floor(
                    totalMinutes / 60
                );

            const minutes =
                totalMinutes % 60;

            return `${hours}h ${String(
                minutes
            ).padStart(2, "0")}m`;
        };

        const consolidatedRows =
            employees.map(
                (emp) => {
                    const dayMap:
                        Record<
                            number,
                            string
                        > = {};

                    const attendanceTimes:
                        Record<
                            number,
                            {
                                checkIn:
                                Date | null;
                                checkOut:
                                Date | null;
                            }
                        > = {};

                    emp.attendances.forEach(
                        (attendance) => {
                            const day =
                                new Date(
                                    attendance.date
                                ).getUTCDate();

                            dayMap[day] =
                                statusCode[
                                attendance.status
                                ] ?? "-";

                            attendanceTimes[
                                day
                            ] = {
                                checkIn:
                                    attendance.checkInTime ??
                                    null,

                                checkOut:
                                    attendance.checkOutTime ??
                                    null,
                            };
                        }
                    );

                    const days: string[] =
                        [];

                    const times: Record<
                        number,
                        {
                            checkIn:
                            Date | null;
                            checkOut:
                            Date | null;
                        }
                    > = {};

                    for (
                        let day = 1;
                        day <=
                        daysInMonth;
                        day++
                    ) {
                        days.push(
                            dayMap[day] ??
                            "-"
                        );

                        times[day] =
                            attendanceTimes[
                            day
                            ] ?? {
                                checkIn:
                                    null,
                                checkOut:
                                    null,
                            };
                    }

                    return {
                        employeeId:
                            emp.id,

                        employeeCode:
                            emp.employeeCode,

                        fullName:
                            emp.fullName,

                        days,

                        times,
                    };
                }
            );

        /*
         * ============================================================
         * CREATE EXCEL WORKBOOK
         * ============================================================
         */

        const workbook =
            new ExcelJS.Workbook();

        workbook.creator =
            "HR System";

        workbook.created =
            new Date();

        /*
         * ============================================================
         * SHEET 1 — ATTENDANCE SUMMARY
         * ============================================================
         */

        const summarySheet =
            workbook.addWorksheet(
                "Attendance Summary"
            );

        summarySheet.columns = [
            {
                header:
                    "Employee Code",
                key:
                    "employeeCode",
                width: 18,
            },
            {
                header:
                    "Employee",
                key:
                    "fullName",
                width: 35,
            },
            {
                header:
                    "Department",
                key:
                    "department",
                width: 30,
            },
            {
                header:
                    "Present",
                key:
                    "present",
                width: 12,
            },
            {
                header:
                    "Absent",
                key:
                    "absent",
                width: 12,
            },
            {
                header:
                    "Half Day",
                key:
                    "halfDay",
                width: 12,
            },
            {
                header:
                    "On Leave",
                key:
                    "onLeave",
                width: 12,
            },
            {
                header:
                    "Total Marked",
                key:
                    "totalMarked",
                width: 15,
            },
        ];

        for (
            const row of summary
        ) {
            summarySheet.addRow({
                employeeCode:
                    row.employeeCode,

                fullName:
                    row.fullName,

                department:
                    row.department,

                present:
                    row.present,

                absent:
                    row.absent,

                halfDay:
                    row.halfDay,

                onLeave:
                    row.onLeave,

                totalMarked:
                    row.totalMarked,
            });
        }

        styleHeader(
            summarySheet
        );

        summarySheet.views = [
            {
                state:
                    "frozen",
                ySplit: 1,
            },
        ];

        /*
         * ============================================================
         * SHEET 2 — CONSOLIDATED REPORT
         * ============================================================
         */

        const consolidatedSheet =
            workbook.addWorksheet(
                "Consolidated Report"
            );

        const consolidatedColumns = [
            {
                header:
                    "Employee Code",
                key:
                    "employeeCode",
                width: 18,
            },
            {
                header:
                    "Employee",
                key:
                    "fullName",
                width: 35,
            },
        ];

        for (
            let day = 1;
            day <=
            daysInMonth;
            day++
        ) {
            consolidatedColumns.push({
                header:
                    String(day),
                key:
                    `day${day}`,
                width: 24,
            });
        }

        consolidatedSheet.columns =
            consolidatedColumns;

        for (
            const row of consolidatedRows
        ) {
            const excelRow: Record<
                string,
                string | number
            > = {
                employeeCode:
                    row.employeeCode,

                fullName:
                    row.fullName,
            };

            row.days.forEach(
                (code, index) => {
                    const day =
                        index + 1;

                    const time =
                        row.times[day];

                    const showTime =
                        code === "P" ||
                        code === "H";

                    if (
                        showTime
                    ) {
                        const checkIn =
                            formatExportTime(
                                time.checkIn
                            );

                        const checkOut =
                            formatExportTime(
                                time.checkOut
                            );

                        const workedFor =
                            calculateWorkedDuration(
                                time.checkIn,
                                time.checkOut
                            );

                        excelRow[
                            `day${day}`
                        ] =
                            `${code}\nClock In: ${checkIn}\nClock Out: ${checkOut}\nWorked for ${workedFor}`;
                    } else {
                        excelRow[
                            `day${day}`
                        ] = code;
                    }
                }
            );

            const addedRow =
                consolidatedSheet.addRow(
                    excelRow
                );

            addedRow.eachCell(
                (
                    cell,
                    columnNumber
                ) => {
                    if (
                        columnNumber >
                        2
                    ) {
                        cell.alignment = {
                            vertical:
                                "middle",

                            horizontal:
                                "center",

                            wrapText:
                                true,
                        };
                    }
                }
            );

            addedRow.height =
                72;
        }

        styleHeader(
            consolidatedSheet
        );

        consolidatedSheet.views = [
            {
                state:
                    "frozen",
                xSplit: 2,
                ySplit: 1,
            },
        ];

        /*
         * ============================================================
         * DOWNLOAD
         * ============================================================
         */

        const buffer =
            await workbook.xlsx.writeBuffer();

        return new NextResponse(
            buffer,
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                    "Content-Disposition":
                        'attachment; filename="report.xlsx"',
                },
            }
        );
    } catch (error) {
        console.error(
            "GET /api/reports/export error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to export report",

                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown server error",
            },
            { status: 500 }
        );
    }
}