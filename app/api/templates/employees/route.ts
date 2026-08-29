/**
 * GET /api/templates/employees
 *
 * Download Excel template for bulk employee upload
 *
 * Features:
 * - Pre-formatted headers
 * - Data validation rules (dropdowns)
 * - Sample data for reference
 * - Instructions in separate sheet
 * - Professional styling
 */

import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import { requirePermissionOrAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Generate Excel template
 */
async function generateEmployeeTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // =========================================================
    // SHEET 1: TEMPLATE
    // =========================================================

    const template = workbook.addWorksheet("Employees");

    // Headers
    const headers = [
        "Email*",
        "First Name*",
        "Last Name*",
        "Phone Number",
        "Department",
        "Designation",
        "Employee Type",
        "Date of Joining",
    ];

    const headerRow = template.addRow(headers);

    // Style header row
    headerRow.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11,
    };

    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F4E78" },
    };

    headerRow.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
    };

    headerRow.height = 25;

    // Set column widths
    template.columns = [
        {
            width: 25,
            alignment: { horizontal: "left" },
        },
        {
            width: 15,
            alignment: { horizontal: "left" },
        },
        {
            width: 15,
            alignment: { horizontal: "left" },
        },
        {
            width: 18,
            alignment: { horizontal: "left" },
        },
        {
            width: 20,
            alignment: { horizontal: "left" },
        },
        {
            width: 20,
            alignment: { horizontal: "left" },
        },
        {
            width: 18,
            alignment: { horizontal: "left" },
        },
        {
            width: 18,
            alignment: { horizontal: "left" },
        },
    ];

    // Add sample data row
    const sampleRow = template.addRow([
        "employee001@company.com",
        "Rajesh",
        "Kumar",
        "9876543210",
        "Information Technology",
        "Senior Developer",
        "PERMANENT",
        "2023-01-15",
    ]);

    sampleRow.font = {
        italic: true,
        color: { argb: "FF999999" },
    };

    sampleRow.getCell(1).note =
        "This is a sample row. Please delete before uploading.";

    // Add empty rows for data entry
    for (let i = 0; i < 10; i++) {
        const row = template.addRow([]);
        row.height = 20;
    }

    // =========================================================
    // DATA VALIDATION RULES
    // =========================================================

    // =========================================================
    // DATA VALIDATION RULES
    // =========================================================

    const dataStartRow = 3;
    const dataEndRow = 1000;

    // Apply validation directly to cells.
    // This avoids the ExcelJS worksheet.dataValidations.add()
    // issue that can cause:
    // "Cannot set properties of undefined (setting 'marked')"

    for (let rowNumber = dataStartRow; rowNumber <= dataEndRow; rowNumber++) {
        // Column A: Email validation
        template.getCell(`A${rowNumber}`).dataValidation = {
            type: "textLength",
            operator: "greaterThan",
            formulae: [3],
            showErrorMessage: true,
            errorStyle: "warning",
            errorTitle: "Invalid Email",
            error: "Email must be at least 3 characters",
        };

        // Column D: Phone validation
        template.getCell(`D${rowNumber}`).dataValidation = {
            type: "textLength",
            operator: "equal",
            formulae: [10],
            showErrorMessage: true,
            errorStyle: "warning",
            errorTitle: "Invalid Phone Number",
            error:
                "Phone number must be exactly 10 digits (e.g., 9876543210)",
        };

        // Column G: Employee Type dropdown
        template.getCell(`G${rowNumber}`).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"PERMANENT,TEMPORARY,CONTRACT"'],
            showErrorMessage: true,
            errorStyle: "stop",
            errorTitle: "Invalid Selection",
            error:
                "Please select from: PERMANENT, TEMPORARY, or CONTRACT",
        };

        // Column H: Date of Joining validation
        template.getCell(`H${rowNumber}`).dataValidation = {
            type: "date",
            operator: "lessThanOrEqual",
            formulae: ["TODAY()"],
            showErrorMessage: true,
            errorStyle: "warning",
            errorTitle: "Invalid Date",
            error:
                "Date of Joining must not be in the future",
        };
    }

    // =========================================================
    // FREEZE HEADER ROW
    // =========================================================

    template.views = [
        {
            state: "frozen",
            ySplit: 1,
            activeCell: "A2",
        },
    ];

    // =========================================================
    // SHEET 2: INSTRUCTIONS
    // =========================================================

    const instructions = workbook.addWorksheet("Instructions");

    instructions.columns = [
        {
            width: 100,
        },
    ];

    const addSection = (title: string, content: string[]) => {
        const titleRow = instructions.addRow([title]);

        titleRow.font = {
            bold: true,
            size: 14,
            color: { argb: "FF1F4E78" },
        };

        titleRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFCCCCCC" },
        };

        content.forEach((text) => {
            const row = instructions.addRow([text]);

            row.alignment = {
                wrapText: true,
            };
        });

        instructions.addRow([""]);
    };

    addSection("BULK UPLOAD INSTRUCTIONS", [
        "This template is designed for bulk uploading employee records. Follow the steps below to ensure successful import.",
    ]);

    addSection("REQUIRED FIELDS (marked with *)", [
        "• Email: Unique email address for each employee (e.g., employee001@company.com)",
        "• First Name: Employee's first name",
        "• Last Name: Employee's last name",
        "",
        "All other fields are optional but recommended for complete employee records.",
    ]);

    addSection("FIELD DESCRIPTIONS", [
        "• Email: Corporate email address (must be unique)",
        "• First Name: Given name of the employee",
        "• Last Name: Surname of the employee",
        "• Phone Number: 10-digit mobile number (e.g., 9876543210) - must start with 9 for India",
        "• Department: Must match an existing department in the system",
        "• Designation: Must match an existing designation in the system",
        "• Employee Type: Select from dropdown - PERMANENT, TEMPORARY, or CONTRACT",
        "• Date of Joining: Date in YYYY-MM-DD format (e.g., 2023-01-15), must not be in future",
    ]);

    addSection("DATA ENTRY RULES", [
        "1. Do NOT modify the header row (row 1)",
        "2. Start entering data from row 3 (row 2 has a sample, which you should delete)",
        "3. Email addresses must be unique (no duplicates in batch or database)",
        "4. Phone numbers must be exactly 10 digits, all numbers (no spaces or special chars)",
        "5. Do NOT leave required fields empty (Email, First Name, Last Name)",
        "6. Department and Designation must exactly match existing master data",
        "7. Use YYYY-MM-DD format for dates (e.g., 2024-01-15)",
    ]);

    addSection("BEFORE UPLOADING", [
        "✓ Review all entries for accuracy",
        "✓ Ensure no duplicate emails or phone numbers",
        "✓ Verify Department and Designation names are spelled correctly",
        "✓ Delete the sample row (row 2)",
        "✓ Save the file as .xlsx format (Excel 2007 or newer)",
        "✓ Do not modify column headers or add new columns",
    ]);

    addSection("UPLOAD PROCESS", [
        "1. Go to Admin Panel → Employees → Bulk Upload",
        "2. Click 'Choose File' and select this completed template",
        "3. Review the summary showing successful and failed records",
        "4. Failed records will show specific error messages with row numbers",
        "5. Fix errors and re-upload as needed",
        "6. Once uploaded, employees will appear in the system immediately",
    ]);

    addSection("IMPORTANT NOTES", [
        "• A temporary password will be auto-generated for each new employee",
        "• The admin user uploading will receive a list of created employees with their passwords",
        "• All successful imports are logged for audit purposes",
        "• Failed rows will NOT be imported. Only rows with no validation errors are created",
        "• If duplicate email/phone is detected, that row will be skipped with an error message",
    ]);

    addSection("NEED HELP?", [
        "Contact your system administrator if you encounter issues.",
        "Common errors:",
        "  • 'Email already exists' - This email is already in the system",
        "  • 'Invalid phone number' - Must be 10 digits and start with 9",
        "  • 'Department not found' - Check spelling of department name",
        "  • 'Invalid date' - Use YYYY-MM-DD format, no future dates allowed",
    ]);

    // =========================================================
    // SHEET 3: REFERENCE DATA
    // =========================================================

    const reference = workbook.addWorksheet("Reference Data");

    reference.columns = [
        { width: 25 },
        { width: 50 },
        { width: 20 },
    ];

    // Fetch departments, designations, employee types
    const [departments, designations, employeeTypes] =
        await Promise.all([
            prisma.department.findMany({
                select: {
                    id: true,
                    name: true,
                },
                orderBy: {
                    name: "asc",
                },
            }),

            prisma.designation.findMany({
                select: {
                    id: true,
                    name: true,
                },
                orderBy: {
                    name: "asc",
                },
            }),

            prisma.employeeType.findMany({
                select: {
                    id: true,
                    name: true,
                },
                orderBy: {
                    name: "asc",
                },
            }),
        ]);

    let currentRow = 1;

    // Departments
    reference.addRow([
        "DEPARTMENTS",
        "",
        "",
    ]);

    currentRow++;

    departments.forEach(
        (dept: { id: string; name: string }) => {
            reference.addRow([
                dept.name,
                "",
                "",
            ]);
        }
    );

    currentRow += departments.length + 2;

    // Designations
    reference.addRow([
        "DESIGNATIONS",
        "",
        "",
    ]);

    currentRow++;

    designations.forEach(
        (desig: { id: string; name: string }) => {
            reference.addRow([
                desig.name,
                "",
                "",
            ]);
        }
    );

    currentRow += designations.length + 2;

    // Employee Types
    reference.addRow([
        "EMPLOYEE TYPES",
        "",
        "",
    ]);

    currentRow++;

    // Keep this aligned with the Employee Type dropdown
    ["PERMANENT", "TEMPORARY", "CONTRACT"].forEach(
        (type) => {
            reference.addRow([
                type,
                "",
                "",
            ]);
        }
    );

    // =========================================================
    // GENERATE XLSX FILE
    // =========================================================

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.from(buffer);
}

/**
 * API Handler
 */
export async function GET(request: NextRequest) {
    try {
        // Authentication check
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

        // Generate template
        const buffer = await generateEmployeeTemplate();

        // Return as downloadable Excel file
        return new NextResponse(buffer as any, {
            headers: {
                "Content-Disposition":
                    "attachment; filename=employee_bulk_upload_template.xlsx",

                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                "Content-Length":
                    buffer.byteLength.toString(),

                "Cache-Control":
                    "no-cache, no-store, must-revalidate",
            },
        });
    } catch (error) {
        console.error(
            "Template generation error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to generate template",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            {
                status: 500,
            }
        );
    }
}