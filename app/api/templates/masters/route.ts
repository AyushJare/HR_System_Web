import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import ExcelJS from "exceljs";

export async function GET() {
    try {
        const auth = await requireAdmin();

        if (!auth.ok) {
            return NextResponse.json(
                { error: auth.error },
                { status: auth.status }
            );
        }

        const workbook = new ExcelJS.Workbook();

        // =========================================================
        // COMMON STYLES
        // =========================================================

        const headerStyle = {
            font: {
                bold: true,
                color: { argb: "FFFFFFFF" },
            },
            fill: {
                type: "pattern" as const,
                pattern: "solid" as const,
                fgColor: { argb: "2563EB" },
            },
            alignment: {
                vertical: "middle" as const,
                horizontal: "center" as const,
                wrapText: true,
            },
            border: {
                top: { style: "thin" as const, color: { argb: "CBD5E1" } },
                bottom: { style: "thin" as const, color: { argb: "CBD5E1" } },
                left: { style: "thin" as const, color: { argb: "CBD5E1" } },
                right: { style: "thin" as const, color: { argb: "CBD5E1" } },
            },
        };

        const styleHeader = (worksheet: ExcelJS.Worksheet) => {
            const headerRow = worksheet.getRow(1);

            headerRow.height = 25;

            headerRow.eachCell((cell) => {
                Object.assign(cell, headerStyle);
            });
        };

        const freezeHeader = (worksheet: ExcelJS.Worksheet) => {
            worksheet.views = [
                {
                    state: "frozen",
                    ySplit: 1,
                },
            ];
        };

        // =========================================================
        // SHEET 1: DEPARTMENTS
        // =========================================================

        const departments = workbook.addWorksheet("Departments");

        departments.columns = [
            {
                header: "Department Name",
                key: "name",
                width: 35,
            },
        ];

        styleHeader(departments);

        departments.addRow({
            name: "Engineering",
        });

        departments.addRow({
            name: "Human Resources",
        });

        departments.getCell("A2").font = {
            italic: true,
            color: { argb: "FF999999" },
        };

        departments.getCell("A2").note =
            "Sample row. Delete or replace this row before uploading.";

        for (let row = 2; row <= 1000; row++) {
            departments.getCell(`A${row}`).dataValidation = {
                type: "textLength",
                operator: "greaterThan",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Department Name Required",
                error: "Please enter a department name.",
            };
        }

        freezeHeader(departments);

        // =========================================================
        // SHEET 2: DESIGNATIONS
        // =========================================================

        const designations = workbook.addWorksheet("Designations");

        designations.columns = [
            {
                header: "Designation Name",
                key: "name",
                width: 35,
            },
        ];

        styleHeader(designations);

        designations.addRow({
            name: "Software Engineer",
        });

        designations.addRow({
            name: "HR Executive",
        });

        designations.getCell("A2").font = {
            italic: true,
            color: { argb: "FF999999" },
        };

        designations.getCell("A2").note =
            "Sample row. Delete or replace this row before uploading.";

        for (let row = 2; row <= 1000; row++) {
            designations.getCell(`A${row}`).dataValidation = {
                type: "textLength",
                operator: "greaterThan",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Designation Name Required",
                error: "Please enter a designation name.",
            };
        }

        freezeHeader(designations);

        // =========================================================
        // SHEET 3: EMPLOYEE TYPES
        // =========================================================

        const employeeTypes = workbook.addWorksheet("Employee Types");

        employeeTypes.columns = [
            {
                header: "Employee Type",
                key: "name",
                width: 25,
            },
            {
                header: "Notice Period (Days)",
                key: "noticePeriod",
                width: 25,
            },
        ];

        styleHeader(employeeTypes);

        employeeTypes.addRow({
            name: "PERMANENT",
            noticePeriod: 30,
        });

        employeeTypes.addRow({
            name: "CONTRACT",
            noticePeriod: 15,
        });

        employeeTypes.getCell("A2").font = {
            italic: true,
            color: { argb: "FF999999" },
        };

        employeeTypes.getCell("A2").note =
            "Sample row. Delete or replace this row before uploading.";

        for (let row = 2; row <= 1000; row++) {
            employeeTypes.getCell(`A${row}`).dataValidation = {
                type: "textLength",
                operator: "greaterThan",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Employee Type Required",
                error: "Please enter an employee type.",
            };

            employeeTypes.getCell(`B${row}`).dataValidation = {
                type: "whole",
                operator: "greaterThanOrEqual",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Invalid Notice Period",
                error: "Notice period must be 0 or greater.",
            };
        }

        freezeHeader(employeeTypes);

        // =========================================================
        // SHEET 4: HOLIDAYS
        // =========================================================

        const holidays = workbook.addWorksheet("Holidays");

        holidays.columns = [
            {
                header: "Festival Name",
                key: "name",
                width: 35,
            },
            {
                header: "Start Date",
                key: "startDate",
                width: 18,
            },
            {
                header: "End Date",
                key: "endDate",
                width: 18,
            },
        ];

        styleHeader(holidays);

        holidays.addRow({
            name: "Diwali",
            startDate: new Date(2026, 9, 20),
            endDate: new Date(2026, 9, 22),
        });

        holidays.addRow({
            name: "Christmas",
            startDate: new Date(2026, 11, 25),
            endDate: new Date(2026, 11, 25),
        });

        holidays.getCell("A2").font = {
            italic: true,
            color: { argb: "FF999999" },
        };

        holidays.getCell("A2").note =
            "Sample row. Delete or replace this row before uploading.";

        holidays.getColumn("B").numFmt = "yyyy-mm-dd";
        holidays.getColumn("C").numFmt = "yyyy-mm-dd";

        for (let row = 2; row <= 1000; row++) {
            holidays.getCell(`A${row}`).dataValidation = {
                type: "textLength",
                operator: "greaterThan",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Festival Name Required",
                error: "Please enter a festival name.",
            };

            holidays.getCell(`B${row}`).dataValidation = {
                type: "date",
                operator: "greaterThanOrEqual",
                formulae: [new Date(2000, 0, 1)],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Invalid Start Date",
                error: "Please enter a valid start date.",
            };

            holidays.getCell(`C${row}`).dataValidation = {
                type: "date",
                operator: "greaterThanOrEqual",
                formulae: [new Date(2000, 0, 1)],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Invalid End Date",
                error: "Please enter a valid end date.",
            };
        }

        freezeHeader(holidays);

        // =========================================================
        // SHEET 5: LEAVE TYPES
        // =========================================================

        const leaveTypes = workbook.addWorksheet("Leave Types");

        leaveTypes.columns = [
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

        styleHeader(leaveTypes);

        leaveTypes.addRow({
            name: "Casual Leave",
            code: "CL",
            defaultAnnualQuota: 12,
        });

        leaveTypes.addRow({
            name: "Sick Leave",
            code: "SL",
            defaultAnnualQuota: 12,
        });

        leaveTypes.getCell("A2").font = {
            italic: true,
            color: { argb: "FF999999" },
        };

        leaveTypes.getCell("A2").note =
            "Sample row. Delete or replace this row before uploading.";

        for (let row = 2; row <= 1000; row++) {
            leaveTypes.getCell(`A${row}`).dataValidation = {
                type: "textLength",
                operator: "greaterThan",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Leave Name Required",
                error: "Please enter a leave name.",
            };

            leaveTypes.getCell(`B${row}`).dataValidation = {
                type: "textLength",
                operator: "greaterThan",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Leave Code Required",
                error: "Please enter a leave code.",
            };

            leaveTypes.getCell(`C${row}`).dataValidation = {
                type: "whole",
                operator: "greaterThanOrEqual",
                formulae: [0],
                allowBlank: true,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Invalid Annual Quota",
                error: "Annual quota must be 0 or greater.",
            };
        }

        freezeHeader(leaveTypes);

        // =========================================================
        // SHEET 6: WEEKLY OFF
        // =========================================================

        const weeklyOff = workbook.addWorksheet("Weekly Off");

        weeklyOff.columns = [
            {
                header: "Day",
                key: "day",
                width: 25,
            },
            {
                header: "Weekly Off",
                key: "weeklyOff",
                width: 20,
            },
        ];

        styleHeader(weeklyOff);

        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];

        days.forEach((day) => {
            weeklyOff.addRow({
                day,
                weeklyOff: "NO",
            });
        });

        // Example default
        weeklyOff.getCell("B2").value = "YES";
        weeklyOff.getCell("B8").value = "YES";

        for (let row = 2; row <= 8; row++) {
            weeklyOff.getCell(`B${row}`).dataValidation = {
                type: "list",
                allowBlank: false,
                formulae: ['"YES,NO"'],
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Invalid Selection",
                error: "Please select YES or NO.",
            };
        }

        freezeHeader(weeklyOff);

        // =========================================================
        // SHEET 7: INSTRUCTIONS
        // =========================================================

        const instructions = workbook.addWorksheet("Instructions");

        instructions.columns = [
            {
                width: 100,
            },
        ];

        const addInstruction = (
            row: number,
            text: string,
            bold = false
        ) => {
            instructions.getCell(`A${row}`).value = text;

            instructions.getCell(`A${row}`).font = {
                bold,
                size: bold ? 14 : 11,
            };

            instructions.getCell(`A${row}`).alignment = {
                wrapText: true,
                vertical: "top",
            };
        };

        addInstruction(1, "MASTER DATA BULK UPLOAD INSTRUCTIONS", true);

        addInstruction(
            3,
            "This workbook allows you to upload multiple types of HR master data at once."
        );

        addInstruction(
            5,
            "1. Do not rename, delete, or add worksheets."
        );

        addInstruction(
            6,
            "2. Do not change the column headers."
        );

        addInstruction(
            7,
            "3. Enter your data below the existing headers."
        );

        addInstruction(
            8,
            "4. Sample rows are provided for reference. Delete or replace them before uploading."
        );

        addInstruction(
            9,
            "5. You may leave a sheet empty if you do not want to update that master."
        );

        addInstruction(
            10,
            "6. Department names and Designation names should be unique."
        );

        addInstruction(
            11,
            "7. Employee Type Notice Period must be a whole number greater than or equal to 0."
        );

        addInstruction(
            12,
            "8. Holiday dates must use YYYY-MM-DD format."
        );

        addInstruction(
            13,
            "9. Holiday End Date cannot be earlier than Start Date."
        );

        addInstruction(
            14,
            "10. Leave Type Code should be unique."
        );

        addInstruction(
            15,
            "11. Weekly Off must contain YES or NO."
        );

        addInstruction(
            16,
            "12. Save the completed workbook as .xlsx before uploading."
        );

        addInstruction(
            18,
            "IMPORTANT: The system will validate all entered master data before importing it."
        );

        addInstruction(
            19,
            "If validation errors are found, the system will show the sheet name, row number, field, and reason for the error."
        );

        instructions.getColumn("A").alignment = {
            wrapText: true,
        };

        // =========================================================
        // RESPONSE
        // =========================================================

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                "Content-Disposition":
                    'attachment; filename="HR_Master_Bulk_Upload_Template.xlsx"',

                "Content-Length": buffer.byteLength.toString(),

                "Cache-Control":
                    "no-cache, no-store, must-revalidate",
            },
        });
    } catch (error) {
        console.error("Master template generation error:", error);

        return NextResponse.json(
            {
                error: "Failed to generate master template",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            { status: 500 }
        );
    }
}