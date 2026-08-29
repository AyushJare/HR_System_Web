import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";
import ExcelJS from "exceljs";

type UploadError = {
    row: number;
    field: string;
    message: string;
};

function normalizeDate(date: Date): Date {
    return new Date(
        Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        )
    );
}

function parseExcelDate(value: unknown): Date | null {
    if (!value) {
        return null;
    }

    // ExcelJS Date
    if (value instanceof Date && !isNaN(value.getTime())) {
        return normalizeDate(value);
    }

    // Excel serial number
    if (typeof value === "number") {
        const excelEpoch = Date.UTC(1899, 11, 30);

        const date = new Date(
            excelEpoch + value * 24 * 60 * 60 * 1000
        );

        if (!isNaN(date.getTime())) {
            return normalizeDate(date);
        }

        return null;
    }

    // String date
    if (typeof value === "string") {
        const text = value.trim();

        if (!text) {
            return null;
        }

        // YYYY-MM-DD
        const match = text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );

        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);

            const date = new Date(
                Date.UTC(year, month - 1, day)
            );

            if (
                date.getUTCFullYear() === year &&
                date.getUTCMonth() === month - 1 &&
                date.getUTCDate() === day
            ) {
                return date;
            }

            return null;
        }

        const parsed = new Date(text);

        if (!isNaN(parsed.getTime())) {
            return normalizeDate(parsed);
        }
    }

    return null;
}

function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
    try {
        // =========================================================
        // AUTH
        // =========================================================

        const auth = await requirePermissionOrAdmin("Holiday Bulk Upload", "import");
        if (!auth.ok) {
            return NextResponse.json(
                { error: auth.error },
                { status: auth.status }
            );
        }

        // =========================================================
        // FILE
        // =========================================================

        const formData = await request.formData();

        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: "Excel file is required" },
                { status: 400 }
            );
        }

        if (!file.name.toLowerCase().endsWith(".xlsx")) {
            return NextResponse.json(
                { error: "Only .xlsx files are allowed" },
                { status: 400 }
            );
        }

        // =========================================================
        // READ WORKBOOK
        // =========================================================

        const buffer = await file.arrayBuffer();

        const workbook = new ExcelJS.Workbook();

        await workbook.xlsx.load(buffer);

        const worksheet = workbook.getWorksheet("Holidays");

        if (!worksheet) {
            return NextResponse.json(
                {
                    error:
                        'The Excel file must contain a sheet named "Holidays".',
                },
                { status: 400 }
            );
        }

        // =========================================================
        // HEADER VALIDATION
        // =========================================================

        const expectedHeaders = [
            "Festival Name",
            "Start Date",
            "End Date",
        ];

        const headerRow = worksheet.getRow(1);

        const actualHeaders = [
            headerRow.getCell(1).value,
            headerRow.getCell(2).value,
            headerRow.getCell(3).value,
        ].map((value) =>
            String(value ?? "").trim()
        );

        const headersMatch = expectedHeaders.every(
            (header, index) =>
                actualHeaders[index] === header
        );

        if (!headersMatch) {
            return NextResponse.json(
                {
                    error:
                        "Invalid template. Please use the downloaded holiday template.",
                    expectedHeaders,
                },
                { status: 400 }
            );
        }

        // =========================================================
        // PROCESS ROWS
        // =========================================================

        const errors: UploadError[] = [];

        let success = 0;
        let failed = 0;

        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);

            const nameValue = row.getCell(1).value;
            const startDateValue = row.getCell(2).value;
            const endDateValue = row.getCell(3).value;

            // Skip completely empty rows
            if (
                !nameValue &&
                !startDateValue &&
                !endDateValue
            ) {
                continue;
            }

            const name = String(nameValue ?? "").trim();

            // =======================================================
            // NAME VALIDATION
            // =======================================================

            if (!name) {
                errors.push({
                    row: rowNumber,
                    field: "Festival Name",
                    message: "Festival name is required.",
                });

                failed++;
                continue;
            }

            // =======================================================
            // DATE VALIDATION
            // =======================================================

            const startDate =
                parseExcelDate(startDateValue);

            const endDate =
                parseExcelDate(endDateValue);

            if (!startDate) {
                errors.push({
                    row: rowNumber,
                    field: "Start Date",
                    message:
                        "Start Date is missing or invalid.",
                });

                failed++;
                continue;
            }

            if (!endDate) {
                errors.push({
                    row: rowNumber,
                    field: "End Date",
                    message:
                        "End Date is missing or invalid.",
                });

                failed++;
                continue;
            }

            // =======================================================
            // DATE RANGE VALIDATION
            // =======================================================

            if (endDate < startDate) {
                errors.push({
                    row: rowNumber,
                    field: "End Date",
                    message:
                        "End Date cannot be earlier than Start Date.",
                });

                failed++;
                continue;
            }

            // =======================================================
            // CREATE EVERY DAY IN RANGE
            // =======================================================

            let currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                const holidayDate = new Date(currentDate);

                // Check if exact holiday already exists
                const existing = await prisma.holiday.findFirst({
                    where: {
                        name,
                        date: holidayDate,
                    },
                });

                if (!existing) {
                    const holiday =
                        await prisma.holiday.create({
                            data: {
                                name,
                                date: holidayDate,
                            },
                        });

                    await prisma.auditLog.create({
                        data: {
                            employeeId: auth.session.sub,
                            action: "HOLIDAY_CREATED",
                            entity: "Holiday",
                            entityId: holiday.id,
                            metadata: {
                                source: "BULK_UPLOAD",
                                festivalName: name,
                                date: formatDate(holidayDate),
                                startDate: formatDate(startDate),
                                endDate: formatDate(endDate),
                            },
                        },
                    });

                    success++;
                }

                currentDate.setUTCDate(
                    currentDate.getUTCDate() + 1
                );
            }
        }

        return NextResponse.json({
            success,
            failed,
            errors,
            message: `Holiday upload completed. ${success} holiday day(s) created.`,
        });
    } catch (error) {
        console.error(
            "Holiday bulk upload error:",
            error
        );

        return NextResponse.json(
            {
                error: "Holiday bulk upload failed",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            { status: 500 }
        );
    }
}