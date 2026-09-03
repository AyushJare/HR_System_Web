import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET() {
    try {
        const auth = await requirePermissionOrAdmin(
            "Holidays",
            "export"
        );

        if (!auth.ok) {
            return NextResponse.json(
                { error: auth.error },
                { status: auth.status }
            );
        }

        const holidays = await prisma.holiday.findMany({
            orderBy: { date: "asc" },
        });

        const workbook = new ExcelJS.Workbook();

        workbook.creator = "HR System";
        workbook.created = new Date();

        const worksheet =
            workbook.addWorksheet("Holidays");

        worksheet.columns = [
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
            worksheet.addRow({
                name: holiday.name,
                date: holiday.date,
                description: holiday.description ?? "",
            });
        }

        worksheet.getColumn("B").numFmt =
            "yyyy-mm-dd";

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

        worksheet.views = [
            {
                state: "frozen",
                ySplit: 1,
            },
        ];

        const buffer =
            await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition":
                    'attachment; filename="holidays.xlsx"',
            },
        });
    } catch (error) {
        console.error(
            "GET /api/holidays/export error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to export holidays",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            { status: 500 }
        );
    }
}