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
 * - Reference data fetched from database
 * - Database-driven dropdowns for Department, Designation,
 *   Employee Type, User Type and Office
 * - Role dropdown from the existing UserRole enum values
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
    // FETCH MASTER DATA FROM DATABASE
    // =========================================================

    const [
        departments,
        designations,
        employeeTypes,
        userTypes,
        offices,
    ] = await Promise.all([
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

        prisma.userType.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: "asc",
            },
        }),

        prisma.office.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
    ]);

    // Existing Employee role values.
    // The current bulk-upload route creates employees with role "EMPLOYEE".
    const roles = [
        "ADMIN",
        "EMPLOYEE",
    ];

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
        "Role",
        "User Type",
        "Office",
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
            width: 25,
            alignment: { horizontal: "left" },
        },
        {
            width: 25,
            alignment: { horizontal: "left" },
        },
        {
            width: 22,
            alignment: { horizontal: "left" },
        },
        {
            width: 15,
            alignment: { horizontal: "left" },
        },
        {
            width: 25,
            alignment: { horizontal: "left" },
        },
        {
            width: 25,
            alignment: { horizontal: "left" },
        },
        {
            width: 18,
            alignment: { horizontal: "left" },
        },
    ];

    // =========================================================
    // SAMPLE DATA
    // =========================================================

    const sampleDepartment =
        departments.length > 0
            ? departments[0].name
            : "";

    const sampleDesignation =
        designations.length > 0
            ? designations[0].name
            : "";

    const sampleEmployeeType =
        employeeTypes.length > 0
            ? employeeTypes[0].name
            : "";

    const sampleUserType =
        userTypes.length > 0
            ? userTypes[0].name
            : "";

    const sampleOffice =
        offices.length > 0
            ? offices[0].name
            : "";

    const sampleRole =
        roles.length > 0
            ? roles[roles.length - 1]
            : "EMPLOYEE";

    const sampleRow = template.addRow([
        "employee001@company.com",
        "Rajesh",
        "Kumar",
        "9876543210",
        sampleDepartment,
        sampleDesignation,
        sampleEmployeeType,
        sampleRole,
        sampleUserType,
        sampleOffice,
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
    // SHEET 2: INSTRUCTIONS
    // =========================================================

    const instructions =
        workbook.addWorksheet(
            "Instructions"
        );

    instructions.columns = [
        {
            width: 110,
        },
    ];

    const addSection = (
        title: string,
        content: string[]
    ) => {
        const titleRow =
            instructions.addRow([
                title,
            ]);

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
            const row =
                instructions.addRow([
                    text,
                ]);

            row.alignment = {
                wrapText: true,
            };
        });

        instructions.addRow([""]);
    };

    addSection(
        "BULK UPLOAD INSTRUCTIONS",
        [
            "This template is designed for bulk uploading employee records. Follow the steps below to ensure successful import.",
        ]
    );

    addSection(
        "REQUIRED FIELDS (marked with *)",
        [
            "• Email: Unique email address for each employee (e.g., employee001@company.com)",
            "• First Name: Employee's first name",
            "• Last Name: Employee's last name",
            "",
            "All other fields are optional but recommended for complete employee records.",
        ]
    );

    addSection(
        "FIELD DESCRIPTIONS",
        [
            "• Email: Corporate email address (must be unique)",
            "• First Name: Given name of the employee",
            "• Last Name: Surname of the employee",
            "• Phone Number: 10-digit mobile number (e.g., 9876543210) - must start with 6, 7, 8, or 9 for India",
            "• Department: Select an existing Department from the database dropdown.",
            "• Designation: Select an existing Designation from the database dropdown.",
            "• Employee Type: Select an existing Employee Type from the database dropdown.",
            "• Role: Select an existing system role from the dropdown.",
            "• User Type: Select an existing User Type from the database dropdown.",
            "• Office: Select an existing Office from the database dropdown.",
            "• Date of Joining: Date in YYYY-MM-DD format (e.g., 2023-01-15), must not be in future",
            "",
            "Password: Do not enter a password in this template. A temporary password is automatically generated during bulk upload.",
        ]
    );

    addSection(
        "DATA ENTRY RULES",
        [
            "1. Do NOT modify the header row (row 1)",
            "2. Start entering data from row 3 (row 2 has a sample, which you should delete)",
            "3. Email addresses must be unique (no duplicates in batch or database)",
            "4. Phone numbers must be exactly 10 digits, all numbers (no spaces or special chars)",
            "5. Do NOT leave required fields empty (Email, First Name, Last Name)",
            "6. Use the Department, Designation, Employee Type, Role, User Type and Office dropdowns where available",
            "7. Department, Designation, Employee Type, User Type and Office values must exist in the system",
            "8. Role must be selected from the available Role dropdown",
            "9. Use YYYY-MM-DD format for dates (e.g., 2024-01-15)",
            "10. Do not add, remove or rename columns",
        ]
    );

    addSection(
        "BEFORE UPLOADING",
        [
            "✓ Review all entries for accuracy",
            "✓ Ensure no duplicate emails or phone numbers",
            "✓ Select Department from the available dropdown",
            "✓ Select Designation from the available dropdown",
            "✓ Select Employee Type from the available dropdown",
            "✓ Select Role from the available dropdown",
            "✓ Select User Type from the available dropdown",
            "✓ Select Office from the available dropdown",
            "✓ Delete the sample row (row 2)",
            "✓ Save the file as .xlsx format (Excel 2007 or newer)",
            "✓ Do not modify column headers or add new columns",
        ]
    );

    addSection(
        "UPLOAD PROCESS",
        [
            "1. Go to Admin Panel → Employees → Bulk Upload",
            "2. Click 'Choose File' and select this completed template",
            "3. Review the summary showing successful and failed records",
            "4. Failed records will show specific error messages with row numbers",
            "5. Fix errors and re-upload as needed",
            "6. Once uploaded, employees will appear in the system immediately",
        ]
    );

    addSection(
        "IMPORTANT NOTES",
        [
            "• A temporary password will be auto-generated for each new employee",
            "• The admin user uploading will receive a list of created employees with their temporary passwords",
            "• Passwords are not entered in the Excel template",
            "• All successful imports are logged for audit purposes",
            "• Failed rows will NOT be imported. Only rows with no validation errors are created",
            "• If duplicate email/phone is detected, that row will be skipped with an error message",
            "• Department, Designation, Employee Type, User Type and Office dropdown values are loaded from the current database when this template is downloaded",
        ]
    );

    addSection(
        "NEED HELP?",
        [
            "Contact your system administrator if you encounter issues.",
            "Common errors:",
            "  • 'Email already exists' - This email is already in the system",
            "  • 'Invalid phone number' - Must be 10 digits and start with 6, 7, 8, or 9",
            "  • 'Department not found' - Select a Department from the current dropdown values",
            "  • 'Designation not found' - Select a Designation from the current dropdown values",
            "  • 'Employee Type not found' - Select an Employee Type from the current dropdown values",
            "  • 'User Type not found' - Select a User Type from the current dropdown values",
            "  • 'Office not found' - Select an Office from the current dropdown values",
            "  • 'Invalid date' - Use YYYY-MM-DD format, no future dates allowed",
        ]
    );

    // =========================================================
    // SHEET 3: REFERENCE DATA
    // =========================================================

    const reference =
        workbook.addWorksheet(
            "Reference Data"
        );

    reference.columns = [
        { width: 30 },
        { width: 50 },
        { width: 20 },
    ];

    /*
     * The Reference Data sheet is populated directly from
     * PostgreSQL so that the Excel dropdowns always contain
     * the latest master data.
     */

    // =========================================================
    // DEPARTMENTS
    // =========================================================

    const departmentHeaderRow = 1;

    reference.addRow([
        "DEPARTMENTS",
        "",
        "",
    ]);

    const departmentStartRow = 2;

    departments.forEach(
        (dept: { id: string; name: string }) => {
            reference.addRow([
                dept.name,
                "",
                "",
            ]);
        }
    );

    const departmentEndRow =
        departments.length > 0
            ? departmentStartRow +
            departments.length -
            1
            : departmentStartRow;

    // =========================================================
    // DESIGNATIONS
    // =========================================================

    const designationHeaderRow =
        departmentEndRow + 2;

    reference.getCell(
        `A${designationHeaderRow}`
    ).value = "DESIGNATIONS";

    const designationStartRow =
        designationHeaderRow + 1;

    designations.forEach(
        (desig: { id: string; name: string }) => {
            reference.addRow([
                desig.name,
                "",
                "",
            ]);
        }
    );

    const designationEndRow =
        designations.length > 0
            ? designationStartRow +
            designations.length -
            1
            : designationStartRow;

    // =========================================================
    // EMPLOYEE TYPES
    // =========================================================

    const employeeTypeHeaderRow =
        designationEndRow + 2;

    reference.getCell(
        `A${employeeTypeHeaderRow}`
    ).value = "EMPLOYEE TYPES";

    const employeeTypeStartRow =
        employeeTypeHeaderRow + 1;

    employeeTypes.forEach(
        (employeeType: {
            id: string;
            name: string;
        }) => {
            reference.addRow([
                employeeType.name,
                "",
                "",
            ]);
        }
    );

    const employeeTypeEndRow =
        employeeTypes.length > 0
            ? employeeTypeStartRow +
            employeeTypes.length -
            1
            : employeeTypeStartRow;

    // =========================================================
    // ROLES
    // =========================================================

    const roleHeaderRow =
        employeeTypeEndRow + 2;

    reference.getCell(
        `A${roleHeaderRow}`
    ).value = "ROLES";

    const roleStartRow =
        roleHeaderRow + 1;

    roles.forEach((role) => {
        reference.addRow([
            role,
            "",
            "",
        ]);
    });

    const roleEndRow =
        roles.length > 0
            ? roleStartRow +
            roles.length -
            1
            : roleStartRow;

    // =========================================================
    // USER TYPES
    // =========================================================

    const userTypeHeaderRow =
        roleEndRow + 2;

    reference.getCell(
        `A${userTypeHeaderRow}`
    ).value = "USER TYPES";

    const userTypeStartRow =
        userTypeHeaderRow + 1;

    userTypes.forEach(
        (userType: {
            id: string;
            name: string;
        }) => {
            reference.addRow([
                userType.name,
                "",
                "",
            ]);
        }
    );

    const userTypeEndRow =
        userTypes.length > 0
            ? userTypeStartRow +
            userTypes.length -
            1
            : userTypeStartRow;

    // =========================================================
    // OFFICES
    // =========================================================

    const officeHeaderRow =
        userTypeEndRow + 2;

    reference.getCell(
        `A${officeHeaderRow}`
    ).value = "OFFICES";

    const officeStartRow =
        officeHeaderRow + 1;

    offices.forEach(
        (office: {
            id: string;
            name: string;
        }) => {
            reference.addRow([
                office.name,
                "",
                "",
            ]);
        }
    );

    const officeEndRow =
        offices.length > 0
            ? officeStartRow +
            offices.length -
            1
            : officeStartRow;

    // =========================================================
    // STYLE REFERENCE DATA HEADERS
    // =========================================================

    [
        departmentHeaderRow,
        designationHeaderRow,
        employeeTypeHeaderRow,
        roleHeaderRow,
        userTypeHeaderRow,
        officeHeaderRow,
    ].forEach((rowNumber) => {
        const row =
            reference.getRow(rowNumber);

        row.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
        };

        row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1F4E78" },
        };

        row.alignment = {
            horizontal: "left",
            vertical: "middle",
        };
    });

    // =========================================================
    // EXCEL NAMED RANGES
    // =========================================================

    /*
     * IMPORTANT:
     *
     * ExcelJS definedNames.add() uses:
     *
     *     add(location, name)
     *
     * The location is supplied first and the named range
     * name is supplied second.
     */

    if (departments.length > 0) {
        workbook.definedNames.add(
            `'Reference Data'!$A$${departmentStartRow}:$A$${departmentEndRow}`,
            "EmployeeDepartments"
        );
    }

    if (designations.length > 0) {
        workbook.definedNames.add(
            `'Reference Data'!$A$${designationStartRow}:$A$${designationEndRow}`,
            "EmployeeDesignations"
        );
    }

    if (employeeTypes.length > 0) {
        workbook.definedNames.add(
            `'Reference Data'!$A$${employeeTypeStartRow}:$A$${employeeTypeEndRow}`,
            "EmployeeTypes"
        );
    }

    if (roles.length > 0) {
        workbook.definedNames.add(
            `'Reference Data'!$A$${roleStartRow}:$A$${roleEndRow}`,
            "EmployeeRoles"
        );
    }

    if (userTypes.length > 0) {
        workbook.definedNames.add(
            `'Reference Data'!$A$${userTypeStartRow}:$A$${userTypeEndRow}`,
            "EmployeeUserTypes"
        );
    }

    if (offices.length > 0) {
        workbook.definedNames.add(
            `'Reference Data'!$A$${officeStartRow}:$A$${officeEndRow}`,
            "EmployeeOffices"
        );
    }

    // =========================================================
    // DATA VALIDATION RULES
    // =========================================================

    const dataStartRow = 3;
    const dataEndRow = 1000;

    /*
     * Apply validation directly to cells.
     *
     * This avoids the ExcelJS worksheet.dataValidations.add()
     * issue that can cause:
     *
     * "Cannot set properties of undefined (setting 'marked')"
     */

    for (
        let rowNumber = dataStartRow;
        rowNumber <= dataEndRow;
        rowNumber++
    ) {
        // =====================================================
        // COLUMN A: EMAIL VALIDATION
        // =====================================================

        template.getCell(
            `A${rowNumber}`
        ).dataValidation = {
            type: "textLength",
            operator: "greaterThan",
            formulae: [3],
            showErrorMessage: true,
            errorStyle: "warning",
            errorTitle: "Invalid Email",
            error:
                "Email must be at least 3 characters",
        };

        // =====================================================
        // COLUMN D: PHONE VALIDATION
        // =====================================================

        template.getCell(
            `D${rowNumber}`
        ).dataValidation = {
            type: "textLength",
            operator: "equal",
            formulae: [10],
            showErrorMessage: true,
            errorStyle: "warning",
            errorTitle:
                "Invalid Phone Number",
            error:
                "Phone number must be exactly 10 digits (e.g., 9876543210)",
        };

        // =====================================================
        // COLUMN E: DEPARTMENT DROPDOWN
        // =====================================================

        if (departments.length > 0) {
            template.getCell(
                `E${rowNumber}`
            ).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                    "=EmployeeDepartments",
                ],
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle:
                    "Invalid Department",
                error:
                    "Please select a Department from the dropdown.",
            };
        }

        // =====================================================
        // COLUMN F: DESIGNATION DROPDOWN
        // =====================================================

        if (designations.length > 0) {
            template.getCell(
                `F${rowNumber}`
            ).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                    "=EmployeeDesignations",
                ],
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle:
                    "Invalid Designation",
                error:
                    "Please select a Designation from the dropdown.",
            };
        }

        // =====================================================
        // COLUMN G: EMPLOYEE TYPE DROPDOWN
        // =====================================================

        if (employeeTypes.length > 0) {
            template.getCell(
                `G${rowNumber}`
            ).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                    "=EmployeeTypes",
                ],
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle:
                    "Invalid Employee Type",
                error:
                    "Please select an Employee Type from the dropdown.",
            };
        }

        // =====================================================
        // COLUMN H: ROLE DROPDOWN
        // =====================================================

        if (roles.length > 0) {
            template.getCell(
                `H${rowNumber}`
            ).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                    "=EmployeeRoles",
                ],
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle:
                    "Invalid Role",
                error:
                    "Please select a Role from the dropdown.",
            };
        }

        // =====================================================
        // COLUMN I: USER TYPE DROPDOWN
        // =====================================================

        if (userTypes.length > 0) {
            template.getCell(
                `I${rowNumber}`
            ).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                    "=EmployeeUserTypes",
                ],
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle:
                    "Invalid User Type",
                error:
                    "Please select a User Type from the dropdown.",
            };
        }

        // =====================================================
        // COLUMN J: OFFICE DROPDOWN
        // =====================================================

        if (offices.length > 0) {
            template.getCell(
                `J${rowNumber}`
            ).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                    "=EmployeeOffices",
                ],
                showErrorMessage: true,
                errorStyle: "stop",
                errorTitle:
                    "Invalid Office",
                error:
                    "Please select an Office from the dropdown.",
            };
        }

        // =====================================================
        // COLUMN K: DATE OF JOINING VALIDATION
        // =====================================================

        template.getCell(
            `K${rowNumber}`
        ).dataValidation = {
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
    // GENERATE XLSX FILE
    // =========================================================

    const buffer =
        await workbook.xlsx.writeBuffer();

    return Buffer.from(buffer);
}

/**
 * API Handler
 */
export async function GET(
    request: NextRequest
) {
    try {
        // Authentication check
        const auth =
            await requirePermissionOrAdmin(
                "Employee Export",
                "export"
            );

        if (!auth.ok) {
            return NextResponse.json(
                {
                    error: auth.error,
                },
                {
                    status: auth.status,
                }
            );
        }

        // Generate template
        const buffer =
            await generateEmployeeTemplate();

        // Return as downloadable Excel file
        return new NextResponse(
            buffer as any,
            {
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
            }
        );
    } catch (error) {
        console.error(
            "Template generation error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to generate template",
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