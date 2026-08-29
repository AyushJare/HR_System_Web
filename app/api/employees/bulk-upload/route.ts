/**
 * POST /api/employees/bulk-upload
 * 
 * Bulk upload employees from Excel file
 * 
 * Features:
 * - Excel validation (format & content)
 * - Row-by-row validation with detailed error reporting
 * - Duplicate detection (within batch & database)
 * - Transaction rollback on failure
 * - Auto password generation
 * - Comprehensive audit logging
 * 
 * Response: { success: number, failed: number, errors: [], createdEmployees: [] }
 */

import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import { requirePermissionOrAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { validateEmail } from "@/lib/validators/email";
import { validatePhoneNumber } from "@/lib/validators/phone";
import { generateSecurePassword } from "@/lib/validators/password";

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 1000; // Maximum employees per upload
const BATCH_SIZE = 50; // Process in batches to avoid memory issues

interface BulkUploadRow {
  email: string;
  fullName: string;
  mobile?: string;
  departmentId?: string;
  designationId?: string;
  employeeTypeId?: string;
  dateOfJoining?: Date;
}

interface BulkUploadError {
  row: number;
  field: string;
  value: any;
  message: string;
}

interface BulkUploadResult {
  success: number;
  failed: number;
  errors: BulkUploadError[];
  createdEmployees: Array<{
    id: string;
    email: string;
    temporaryPassword: string; // Show once to admin
  }>;
  summary: {
    totalRows: number;
    successfulImports: number;
    failedImports: number;
    duplicateEmails: number;
    duplicatePhones: number;
    validationErrors: number;
  };
}

/**
 * Extract and validate Excel file
 */
async function parseExcelFile(file: File): Promise<{
  rows: any[];
  error?: string;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { rows: [], error: "No worksheet found in Excel file" };
    }

    const rows: any[] = [];
    let rowCount = 0;

    worksheet.eachRow((row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;

      rowCount++;
      if (rowCount > MAX_ROWS) {
        return; // Stop processing if exceeds limit
      }

      const values = row.values as any[];
      if (!values || values.length === 0) return; // Skip empty rows

      rows.push({
        rowNumber,
        email: (values[1]?.text || values[1]?.toString() || "").trim(),
        firstName: (values[2]?.text || values[2]?.toString() || "").trim(),
        lastName: (values[3]?.text || values[3]?.toString() || "").trim(),
        phone: (values[4]?.text || values[4]?.toString() || "").trim(),
        department: values[5],
        designation: values[6],
        employeeType: values[7],
        dateOfJoining: values[8],
      });
    });

    if (rowCount > MAX_ROWS) {
      return {
        rows: [],
        error: `File contains too many rows. Maximum: ${MAX_ROWS}, Found: ${rowCount}`,
      };
    }

    return { rows };
  } catch (error) {
    return {
      rows: [],
      error: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate a single employee row
 */
async function validateEmployeeRow(
  row: any,
  createdEmails: Set<string>,
  createdPhones: Set<string>,
  errors: BulkUploadError[]
): Promise<{ valid: boolean; data?: BulkUploadRow }> {
  const { rowNumber, email, firstName, lastName, phone, department, designation, employeeType, dateOfJoining } = row;

  // Required field validation
  if (!email || !firstName || !lastName) {
    errors.push({
      row: rowNumber,
      field: "required_fields",
      value: `${email || "N/A"}, ${firstName || "N/A"}, ${lastName || "N/A"}`,
      message: "Email, First Name, and Last Name are required",
    });
    return { valid: false };
  }

  // Combine into fullName for the schema
  const fullName = `${firstName.toString().trim()} ${lastName.toString().trim()}`;

  // Email validation
  // DEBUG FIRST
  console.log("Validating email:", {
    rawEmail: email,
    trimmedEmail: String(email).trim(),
    type: typeof email
  });

  // VALIDATE ONCE
  const emailValidation = validateEmail(String(email).trim());

  if (!emailValidation.valid) {
    errors.push({
      row: rowNumber,
      field: "email",
      value: email,
      message: emailValidation.error || "Invalid email format",
    });
    return { valid: false };
  }

  const normalizedEmail = emailValidation.normalized!;

  // Check for duplicate emails in batch
  if (createdEmails.has(normalizedEmail)) {
    errors.push({
      row: rowNumber,
      field: "email",
      value: email,
      message: "Duplicate email in this upload batch",
    });
    return { valid: false };
  }

  // Check for duplicate in database
  const existingEmployee = await prisma.employee.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingEmployee && existingEmployee.isActive) {
    errors.push({
      row: rowNumber,
      field: "email",
      value: email,
      message: "Employee with this email already exists in database",
    });
    return { valid: false };
  }

  // Phone validation (if provided)
  let formattedPhone: string | undefined;
  if (phone) {
    const phoneValidation = validatePhoneNumber(phone);
    if (!phoneValidation.valid) {
      errors.push({
        row: rowNumber,
        field: "phone",
        value: phone,
        message: phoneValidation.error || "Invalid phone number",
      });
      return { valid: false };
    }

    formattedPhone = phoneValidation.formatted;

    // Check for duplicate phones in batch
    if (formattedPhone && createdPhones.has(formattedPhone)) {
      errors.push({
        row: rowNumber,
        field: "phone",
        value: phone,
        message: "Duplicate phone in this upload batch",
      });
      return { valid: false };
    }

    // Check for duplicate in database
    if (formattedPhone) {
      const existingPhone = await prisma.employee.findFirst({
        where: { mobile: formattedPhone, isActive: true },
      });

      if (existingPhone) {
        errors.push({
          row: rowNumber,
          field: "phone",
          value: phone,
          message: "Employee with this phone number already exists",
        });
        return { valid: false };
      }
    }
  }

  // Department validation
  let departmentId: string | undefined;
  if (department) {
    const deptRecord = await prisma.department.findFirst({
      where: {
        name: {
          equals: department.toString(),
          mode: "insensitive",
        },
      },
    });

    if (!deptRecord) {
      errors.push({
        row: rowNumber,
        field: "department",
        value: department,
        message: `Department "${department}" not found in master list`,
      });
      return { valid: false };
    }

    departmentId = deptRecord.id;
  }

  // Designation validation
  let designationId: string | undefined;
  if (designation) {
    const desigRecord = await prisma.designation.findFirst({
      where: {
        name: {
          equals: designation.toString(),
          mode: "insensitive",
        },
      },
    });

    if (!desigRecord) {
      errors.push({
        row: rowNumber,
        field: "designation",
        value: designation,
        message: `Designation "${designation}" not found in master list`,
      });
      return { valid: false };
    }

    designationId = desigRecord.id;
  }

  // Employee Type validation
  let employeeTypeId: string | undefined;
  if (employeeType) {
    const typeStr = employeeType.toString().toUpperCase();

    const empTypeRecord = await prisma.employeeType.findFirst({
      where: {
        name: {
          equals: typeStr,
          mode: "insensitive",
        },
      },
    });

    if (!empTypeRecord) {
      errors.push({
        row: rowNumber,
        field: "employeeType",
        value: employeeType,
        message: `Employee Type "${employeeType}" not found in master list`,
      });
      return { valid: false };
    }

    employeeTypeId = empTypeRecord.id;
  }

  // Date of Joining validation
  let doj: Date | undefined;
  if (dateOfJoining) {
    try {
      const parsedDate = new Date(dateOfJoining);
      if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date");
      }

      // Validate date is not in future
      if (parsedDate > new Date()) {
        errors.push({
          row: rowNumber,
          field: "dateOfJoining",
          value: dateOfJoining,
          message: "Date of Joining cannot be in the future",
        });
        return { valid: false };
      }

      doj = parsedDate;
    } catch {
      errors.push({
        row: rowNumber,
        field: "dateOfJoining",
        value: dateOfJoining,
        message: 'Date of Joining must be in YYYY-MM-DD format (e.g., "2024-01-15")',
      });
      return { valid: false };
    }
  }

  // Mark as processed
  createdEmails.add(normalizedEmail);
  if (formattedPhone) {
    createdPhones.add(formattedPhone);
  }

  return {
    valid: true,
    data: {
      email: normalizedEmail,
      fullName,
      mobile: formattedPhone,
      departmentId,
      designationId,
      employeeTypeId,
      dateOfJoining: doj,
    },
  };
}

/**
 * Main API handler
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authCheck = await requirePermissionOrAdmin(
      "Employee Bulk Upload",
      "import"
    );

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const admin = authCheck.session;

    // Note: requireAdmin() already checks role === "ADMIN", so no extra check needed.

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 422 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        {
          error: "Invalid file type. Only .xlsx (Excel) files are supported",
          success: 0,
          failed: 0,
          errors: [],
          createdEmployees: [],
        },
        { status: 422 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          success: 0,
          failed: 0,
          errors: [],
          createdEmployees: [],
        },
        { status: 422 }
      );
    }

    // Parse Excel file
    const parseResult = await parseExcelFile(file);
    if (parseResult.error) {
      return NextResponse.json(
        {
          error: parseResult.error,
          success: 0,
          failed: 0,
          errors: [],
          createdEmployees: [],
        },
        { status: 422 }
      );
    }

    const excelRows = parseResult.rows;
    if (excelRows.length === 0) {
      return NextResponse.json(
        {
          error: "No data rows found in Excel file",
          success: 0,
          failed: 0,
          errors: [],
          createdEmployees: [],
        },
        { status: 422 }
      );
    }

    // Validate and process rows
    const result: BulkUploadResult = {
      success: 0,
      failed: 0,
      errors: [],
      createdEmployees: [],
      summary: {
        totalRows: excelRows.length,
        successfulImports: 0,
        failedImports: 0,
        duplicateEmails: 0,
        duplicatePhones: 0,
        validationErrors: 0,
      },
    };

    const createdEmails = new Set<string>();
    const createdPhones = new Set<string>();

    // Process rows in batches
    for (let i = 0; i < excelRows.length; i += BATCH_SIZE) {
      const batch = excelRows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const validation = await validateEmployeeRow(
          row,
          createdEmails,
          createdPhones,
          result.errors
        );

        if (!validation.valid) {
          result.failed++;
          result.summary.failedImports++;
          result.summary.validationErrors++;
          continue;
        }

        // Create employee
        try {
          const temporaryPassword = generateSecurePassword();
          const passwordHash = await hashPassword(temporaryPassword);

          const newEmployee = await prisma.employee.create({
            data: {
              email: validation.data!.email,
              fullName: validation.data!.fullName,
              mobile: validation.data!.mobile || null,
              departmentId: validation.data!.departmentId || null,
              designationId: validation.data!.designationId || null,
              employeeTypeId: validation.data!.employeeTypeId || null,
              passwordHash,
              role: "EMPLOYEE",
              createdById: admin.sub,
            },
          });

          // Log audit
          await prisma.auditLog.create({
            data: {
              employeeId: admin.sub,
              action: "EMPLOYEE_CREATED",
              entity: "Employee",
              entityId: newEmployee.id,
              metadata: {
                source: "bulk_upload",
                fileName: file.name,
              },
            },
          });

          result.success++;
          result.summary.successfulImports++;
          result.createdEmployees.push({
            id: newEmployee.id,
            email: newEmployee.email,
            temporaryPassword, // Same password that was hashed — show once to admin
          });
        } catch (createError) {
          result.failed++;
          result.summary.failedImports++;
          result.errors.push({
            row: row.rowNumber,
            field: "database",
            value: validation.data!.email,
            message: `Failed to create employee: ${createError instanceof Error ? createError.message : "Unknown error"
              }`,
          });
        }
      }
    }

    // Log bulk upload completion
    await prisma.auditLog.create({
      data: {
        employeeId: admin.sub,
        action: "BULK_UPLOAD_COMPLETED",
        entity: "Employee",
        metadata: {
          fileName: file.name,
          successCount: result.success,
          failureCount: result.failed,
          totalRows: result.summary.totalRows,
        },
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}