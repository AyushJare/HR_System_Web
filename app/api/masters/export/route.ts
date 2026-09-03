import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET() {
    try {
        const auth = await requirePermissionOrAdmin(
            "Masters",
            "export"
        );

        if (!auth.ok) {
            return NextResponse.json(
                { error: auth.error },
                { status: auth.status }
            );
        }

        const [
            departments,
            designations,
            employeeTypes,
            holidays,
            leaveTypes,
            attendanceSettings,
        ] = await Promise.all([
            prisma.department.findMany({
                orderBy: { name: "asc" },
            }),

            prisma.designation.findMany({
                orderBy: { name: "asc" },
            }),

            prisma.employeeType.findMany({
                orderBy: { name: "asc" },
            }),

            prisma.holiday.findMany({
                orderBy: { date: "asc" },
            }),

            prisma.leaveType.findMany({
                orderBy: { name: "asc" },
            }),

            prisma.attendanceSettings.findFirst(),
        ]);

        const workbook = new ExcelJS.Workbook();

        workbook.creator = "HR System";
        workbook.created = new Date();

        function styleHeader(
            worksheet: ExcelJS.Worksheet
        ) {
            const header = worksheet.getRow(1);

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

        // =========================================================
        // DEPARTMENTS
        // =========================================================

        const departmentSheet =
            workbook.addWorksheet("Departments");

        departmentSheet.columns = [
            {
                header: "Department",
                key: "name",
                width: 30,
            },
        ];

        for (const department of departments) {
            departmentSheet.addRow({
                name: department.name,
            });
        }

        styleHeader(departmentSheet);
        departmentSheet.views = [{ state: "frozen", ySplit: 1 }];

        // =========================================================
        // DESIGNATIONS
        // =========================================================

        const designationSheet =
            workbook.addWorksheet("Designations");

        designationSheet.columns = [
            {
                header: "Designation",
                key: "name",
                width: 30,
            },
        ];

        for (const designation of designations) {
            designationSheet.addRow({
                name: designation.name,
            });
        }

        styleHeader(designationSheet);
        designationSheet.views = [{ state: "frozen", ySplit: 1 }];

        // =========================================================
        // EMPLOYEE TYPES
        // =========================================================

        const employeeTypeSheet =
            workbook.addWorksheet("Employee Types");

        employeeTypeSheet.columns = [
            {
                header: "Employee Type",
                key: "name",
                width: 30,
            },
            {
                header: "Notice Period (Days)",
                key: "noticePeriod",
                width: 25,
            },
        ];

        for (const employeeType of employeeTypes) {
            employeeTypeSheet.addRow({
                name: employeeType.name,
                noticePeriod: employeeType.noticePeriod,
            });
        }

        styleHeader(employeeTypeSheet);
        employeeTypeSheet.views = [{ state: "frozen", ySplit: 1 }];

        // =========================================================
        // HOLIDAYS
        // =========================================================

        const holidaySheet =
            workbook.addWorksheet("Holidays");

        holidaySheet.columns = [
            {
                header: "Festival Name",
                key: "name",
                width: 35,
            },
            {
                header: "Date",
                key: "date",
                width: 18,
            },
            {
                header: "Description",
                key: "description",
                width: 40,
            },
        ];

        for (const holiday of holidays) {
            holidaySheet.addRow({
                name: holiday.name,
                date: holiday.date,
                description: holiday.description ?? "",
            });
        }

        holidaySheet.getColumn("B").numFmt =
            "yyyy-mm-dd";

        styleHeader(holidaySheet);

        holidaySheet.views = [
            { state: "frozen", ySplit: 1 },
        ];
        // =========================================================
        // LEAVE TYPES
        // =========================================================

        const leaveTypeSheet =
            workbook.addWorksheet("Leave Types");

        leaveTypeSheet.columns = [
            {
                header: "Leave Name",
                key: "name",
                width: 30,
            },
            {
                header: "Code",
                key: "code",
                width: 15,
            },
            {
                header: "Default Annual Quota",
                key: "defaultAnnualQuota",
                width: 25,
            },
        ];

        for (const leaveType of leaveTypes) {
            leaveTypeSheet.addRow({
                name: leaveType.name,
                code: leaveType.code,
                defaultAnnualQuota:
                    leaveType.defaultAnnualQuota,
            });
        }

        styleHeader(leaveTypeSheet);
        leaveTypeSheet.views = [{ state: "frozen", ySplit: 1 }];

        // =========================================================
        // WEEKLY OFF
        // =========================================================

        const weeklyOffSheet =
            workbook.addWorksheet("Weekly Off");

        weeklyOffSheet.columns = [
            {
                header: "Day",
                key: "day",
                width: 20,
            },
            {
                header: "Weeks",
                key: "weeks",
                width: 30,
            },
        ];

        const weeklyOffDays =
            attendanceSettings?.weeklyOffDays;

        if (
            weeklyOffDays &&
            typeof weeklyOffDays === "object"
        ) {
            const dayNames = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ];

            for (let day = 0; day < 7; day++) {
                const weeks =
                    (
                        weeklyOffDays as Record<
                            string,
                            unknown
                        >
                    )[String(day)];

                if (Array.isArray(weeks)) {
                    weeklyOffSheet.addRow({
                        day: dayNames[day],
                        weeks: weeks.join(", "),
                    });
                }
            }
        }

        styleHeader(weeklyOffSheet);
        weeklyOffSheet.views = [{ state: "frozen", ySplit: 1 }];

        // =========================================================
        // GENERATE FILE
        // =========================================================

        const buffer =
            await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                "Content-Disposition":
                    'attachment; filename="masters.xlsx"',
            },
        });
    } catch (error) {
        console.error(
            "GET /api/masters/export error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to export master data",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            { status: 500 }
        );
    }
}