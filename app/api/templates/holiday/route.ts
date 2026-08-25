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

        const worksheet = workbook.addWorksheet("Holidays");

        // =========================================================
        // COLUMNS
        // =========================================================

        worksheet.columns = [
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

        // =========================================================
        // HEADER
        // =========================================================

        const headerRow = worksheet.getRow(1);

        headerRow.height = 25;

        headerRow.eachCell((cell) => {
            cell.font = {
                bold: true,
                color: { argb: "FFFFFFFF" },
            };

            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "2563EB" },
            };

            cell.alignment = {
                vertical: "middle",
                horizontal: "center",
            };

            cell.border = {
                top: { style: "thin", color: { argb: "CBD5E1" } },
                bottom: { style: "thin", color: { argb: "CBD5E1" } },
                left: { style: "thin", color: { argb: "CBD5E1" } },
                right: { style: "thin", color: { argb: "CBD5E1" } },
            };
        });

        // =========================================================
        // SAMPLE DATA
        // =========================================================

        worksheet.addRow({
            name: "Diwali",
            startDate: new Date(2026, 9, 20),
            endDate: new Date(2026, 9, 22),
        });

        worksheet.addRow({
            name: "Christmas",
            startDate: new Date(2026, 11, 25),
            endDate: new Date(2026, 11, 25),
        });

        worksheet.getColumn("B").numFmt = "yyyy-mm-dd";
        worksheet.getColumn("C").numFmt = "yyyy-mm-dd";

        // =========================================================
        // DATA VALIDATION
        // =========================================================

        for (let row = 2; row <= 1000; row++) {
            worksheet.getCell(`A${row}`).dataValidation = {
                type: "textLength",
                operator: "greaterThan",
                formulae: [0],
                allowBlank: false,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Festival Name Required",
                error: "Please enter a festival name.",
            };

            worksheet.getCell(`B${row}`).dataValidation = {
                type: "date",
                operator: "greaterThanOrEqual",
                formulae: [new Date(2000, 0, 1)],
                allowBlank: false,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Invalid Start Date",
                error: "Please enter a valid start date.",
            };

            worksheet.getCell(`C${row}`).dataValidation = {
                type: "date",
                operator: "greaterThanOrEqual",
                formulae: [new Date(2000, 0, 1)],
                allowBlank: false,
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle: "Invalid End Date",
                error: "Please enter a valid end date.",
            };
        }

        // =========================================================
        // INSTRUCTIONS SHEET
        // =========================================================

        const instructions = workbook.addWorksheet("Instructions");

        instructions.columns = [
            {
                width: 90,
            },
        ];

        instructions.getCell("A1").value = "Holiday Bulk Upload Instructions";

        instructions.getCell("A1").font = {
            bold: true,
            size: 16,
        };

        instructions.getCell("A3").value =
            "1. Enter the festival/holiday name.";

        instructions.getCell("A4").value =
            "2. Enter the Start Date in YYYY-MM-DD format.";

        instructions.getCell("A5").value =
            "3. Enter the End Date in YYYY-MM-DD format.";

        instructions.getCell("A6").value =
            "4. If Start Date and End Date are the same, one holiday will be created.";

        instructions.getCell("A7").value =
            "5. If the dates are different, a holiday will be created for every day between them.";

        instructions.getCell("A8").value =
            "6. End Date cannot be earlier than Start Date.";

        instructions.getCell("A9").value =
            "7. Do not change the column names.";

        instructions.getCell("A10").value =
            "8. Save the file as .xlsx before uploading.";

        // =========================================================
        // FREEZE HEADER
        // =========================================================

        worksheet.views = [
            {
                state: "frozen",
                ySplit: 1,
            },
        ];

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
                    'attachment; filename="holiday_template.xlsx"',
            },
        });
    } catch (error) {
        console.error("Holiday template generation error:", error);

        return NextResponse.json(
            {
                error: "Failed to generate holiday template",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            { status: 500 }
        );
    }
}