import { NextResponse } from "next/server";
import * as ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET() {
    try {
        /*
         * ==========================================================
         * PERMISSION
         * ==========================================================
         */

        const auth = await requirePermissionOrAdmin(
            "Employee Export",
            "export"
        );

        if (!auth.ok) {
            return NextResponse.json(
                { error: auth.error },
                { status: auth.status }
            );
        }

        /*
         * ==========================================================
         * FETCH EMPLOYEES
         * ==========================================================
         */

        const employees =
            await prisma.employee.findMany({
                orderBy: {
                    createdAt: "desc",
                },

                select: {
                    employeeCode: true,
                    fullName: true,
                    email: true,
                    mobile: true,
                    gender: true,
                    role: true,
                    isActive: true,
                    createdAt: true,

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

                    employeeType: {
                        select: {
                            name: true,
                        },
                    },
                },
            });

        /*
         * ==========================================================
         * CREATE EXCEL WORKBOOK
         * ==========================================================
         */

        const workbook =
            new ExcelJS.Workbook();

        const worksheet =
            workbook.addWorksheet("Employees");

        /*
         * ==========================================================
         * HEADERS
         * ==========================================================
         */

        worksheet.columns = [
            {
                header: "Employee Code",
                key: "employeeCode",
                width: 18,
            },
            {
                header: "Full Name",
                key: "fullName",
                width: 28,
            },
            {
                header: "Email",
                key: "email",
                width: 32,
            },
            {
                header: "Mobile",
                key: "mobile",
                width: 18,
            },
            {
                header: "Gender",
                key: "gender",
                width: 14,
            },
            {
                header: "Department",
                key: "department",
                width: 25,
            },
            {
                header: "Designation",
                key: "designation",
                width: 25,
            },
            {
                header: "Employee Type",
                key: "employeeType",
                width: 20,
            },
            {
                header: "Role",
                key: "role",
                width: 14,
            },
            {
                header: "Status",
                key: "status",
                width: 14,
            },
            {
                header: "Created At",
                key: "createdAt",
                width: 22,
            },
        ];

        /*
         * ==========================================================
         * HEADER STYLE
         * ==========================================================
         */

        const headerRow =
            worksheet.getRow(1);

        headerRow.font = {
            bold: true,
            color: {
                argb: "FFFFFFFF",
            },
            size: 11,
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
            wrapText: true,
        };

        headerRow.height = 25;

        /*
         * ==========================================================
         * ADD EMPLOYEE DATA
         * ==========================================================
         */

        for (const employee of employees) {
            worksheet.addRow({
                employeeCode:
                    employee.employeeCode,

                fullName:
                    employee.fullName,

                email:
                    employee.email,

                mobile:
                    employee.mobile ?? "",

                gender:
                    employee.gender ?? "",

                department:
                    employee.department?.name ?? "",

                designation:
                    employee.designation?.name ?? "",

                employeeType:
                    employee.employeeType?.name ?? "",

                role:
                    employee.role,

                status:
                    employee.isActive
                        ? "Active"
                        : "Inactive",

                createdAt:
                    employee.createdAt.toISOString(),
            });
        }

        /*
         * ==========================================================
         * FREEZE HEADER
         * ==========================================================
         */

        worksheet.views = [
            {
                state: "frozen",
                ySplit: 1,
            },
        ];

        /*
         * ==========================================================
         * AUTO FILTER
         * ==========================================================
         */

        if (employees.length > 0) {
            worksheet.autoFilter = {
                from: "A1",
                to: `K${employees.length + 1}`,
            };
        }

        /*
         * ==========================================================
         * GENERATE XLSX
         * ==========================================================
         */

        const buffer =
            await workbook.xlsx.writeBuffer();

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
                        'attachment; filename="employees.xlsx"',

                    "Content-Length":
                        buffer.byteLength.toString(),

                    "Cache-Control":
                        "no-cache, no-store, must-revalidate",
                },
            }
        );
    } catch (error) {
        console.error(
            "GET /api/employees/export error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to export employees",
            },
            {
                status: 500,
            }
        );
    }
}