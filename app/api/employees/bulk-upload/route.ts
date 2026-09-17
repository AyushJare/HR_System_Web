/**
 * POST /api/employees/bulk-upload
 *
 * Bulk upload employees from an Excel (.xlsx) file.
 *
 * Duplicate handling
 * ------------------
 * Duplicates are resolved in three layers, cheapest first:
 *
 *   1. In-batch   - a row is compared against every earlier row in the same
 *                   file. A row registers its email/phone as "seen" as soon as
 *                   the value is well-formed, regardless of whether the row
 *                   later fails for another reason. This guarantees a repeated
 *                   value is always reported as a batch duplicate exactly once.
 *
 *   2. Pre-loaded - existing emails and phones are fetched in a small number of
 *                   batched queries before the write loop, instead of one query
 *                   per row. This is an optimisation, not a guarantee.
 *
 *   3. Constraint - the database unique constraint is the authority. A P2002
 *                   raised by create() is translated into the same user-facing
 *                   duplicate error. This closes the window between the
 *                   pre-load and the write, so a row can never be reported as
 *                   "already exists" while also being inserted.
 *
 * Response: { success, failed, errors[], createdEmployees[], summary }
 */

import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import { requirePermissionOrAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { validatePhoneNumber } from "@/lib/validators/phone";
import { generateSecurePassword } from "@/lib/validators/password";

// ===========================================================================
// CONFIGURATION
// ===========================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 1000; // Maximum employees per upload

/**
 * Maximum number of values placed in a single `IN (...)` clause when
 * pre-loading existing employees. Keeps the generated SQL well within
 * parameter limits on every supported database.
 */
const LOOKUP_CHUNK_SIZE = 500;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ===========================================================================
// TYPES
// ===========================================================================

interface BulkUploadRow {
  email: string;
  fullName: string;
  mobile?: string;
  departmentId?: string;
  designationId?: string;
  employeeTypeId?: string;
  userTypeId?: string;
  officeId?: string;
  role?: "ADMIN" | "EMPLOYEE";
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
    temporaryPassword: string;
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
 * Why a row was rejected. Drives the summary counters so that each failure is
 * attributed to exactly one category.
 */
type FailureKind = "DUPLICATE_EMAIL" | "DUPLICATE_PHONE" | "VALIDATION";

type ValidationOutcome =
  | { valid: true; data: BulkUploadRow }
  | { valid: false; reason: FailureKind };

/**
 * Master data loaded once for the entire upload.
 */
interface MasterData {
  departments: Map<string, string>;
  designations: Map<string, string>;
  employeeTypes: Map<string, string>;
  userTypes: Map<string, string>;
  offices: Map<string, string>;
}

/**
 * Emails and phones already present in the database, pre-loaded in bulk.
 */
interface ExistingRecords {
  emails: Set<string>;
  phones: Set<string>;
}

/**
 * Values already consumed by earlier rows of the same file.
 */
interface SeenValues {
  emails: Set<string>;
  phones: Set<string>;
}

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Normalize master-data names for reliable matching.
 */
function normalizeMasterName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Normalize an email for comparison and storage.
 */
function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Split an array into fixed-size chunks.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

/**
 * Prisma raises P2002 when a unique constraint is violated. The failing
 * column(s) are reported in `meta.target`.
 */
function asUniqueConstraintError(
  error: unknown
): { target: string[] } | null {
  if (
    typeof error !== "object" ||
    error === null ||
    (error as { code?: unknown }).code !== "P2002"
  ) {
    return null;
  }

  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;

  if (Array.isArray(target)) {
    return { target: target.map(String) };
  }

  if (typeof target === "string") {
    return { target: [target] };
  }

  return { target: [] };
}

/**
 * Safely extract text from an ExcelJS cell value.
 */
function getExcelCellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const cellValue = value as {
      text?: unknown;
      result?: unknown;
    };

    if (cellValue.text !== undefined && cellValue.text !== null) {
      return String(cellValue.text).trim();
    }

    if (cellValue.result !== undefined && cellValue.result !== null) {
      return String(cellValue.result).trim();
    }
  }

  return String(value).trim();
}

/**
 * Build a date with no time component from its calendar parts, rejecting
 * values that JavaScript would silently roll over (e.g. 2023-02-31).
 */
function buildCalendarDate(
  year: number,
  month: number,
  day: number
): Date | undefined {
  const date = new Date(year, month - 1, day);

  const isExact =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isExact ? date : undefined;
}

/**
 * Parse an Excel date safely.
 *
 * Supports JavaScript Date values, Excel serial dates, YYYY-MM-DD,
 * YYYY/MM/DD, MM/DD/YYYY, and other date strings JavaScript recognises.
 * The result never carries a time component.
 */
function parseExcelDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  // -------------------------------------------------------------------------
  // JAVASCRIPT DATE
  // -------------------------------------------------------------------------

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  // -------------------------------------------------------------------------
  // EXCEL SERIAL DATE
  // -------------------------------------------------------------------------

  if (typeof value === "number") {
    if (value <= 0 || value >= 100000) {
      return undefined;
    }

    // Excel's epoch is 1899-12-30 (it treats 1900 as a leap year).
    const excelEpoch = Date.UTC(1899, 11, 30);
    const milliseconds = value * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch + milliseconds);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
  }

  // -------------------------------------------------------------------------
  // EXCEL FORMULA / OBJECT VALUE
  // -------------------------------------------------------------------------

  if (typeof value === "object") {
    const cellValue = value as {
      result?: unknown;
      text?: unknown;
    };

    if (cellValue.result !== undefined && cellValue.result !== null) {
      const parsed = parseExcelDate(cellValue.result);

      if (parsed) {
        return parsed;
      }
    }

    if (cellValue.text !== undefined && cellValue.text !== null) {
      const parsed = parseExcelDate(cellValue.text);

      if (parsed) {
        return parsed;
      }
    }

    return undefined;
  }

  // -------------------------------------------------------------------------
  // STRING DATE
  // -------------------------------------------------------------------------

  const dateString = String(value).trim();

  if (!dateString) {
    return undefined;
  }

  // YYYY-MM-DD  (e.g. 2023-01-15)
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateString);

  if (match) {
    return buildCalendarDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  // YYYY/MM/DD  (e.g. 2023/01/15)
  match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(dateString);

  if (match) {
    return buildCalendarDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  // MM/DD/YYYY  (e.g. 1/15/2023)
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);

  if (match) {
    return buildCalendarDate(
      Number(match[3]),
      Number(match[1]),
      Number(match[2])
    );
  }

  // Final fallback: anything else the runtime understands.
  const parsed = new Date(dateString);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );
}

/**
 * Today's date with the time component removed.
 *
 * Comparing calendar dates avoids Excel time-zone/time-component differences
 * making a valid date look like a future date.
 */
function startOfToday(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ===========================================================================
// MASTER DATA
// ===========================================================================

/**
 * Load all required master data once, keyed by normalized name.
 */
async function loadMasterData(): Promise<MasterData> {
  const [
    departments,
    designations,
    employeeTypes,
    userTypes,
    offices,
  ] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.designation.findMany({ select: { id: true, name: true } }),
    prisma.employeeType.findMany({ select: { id: true, name: true } }),
    prisma.userType.findMany({ select: { id: true, name: true } }),
    prisma.office.findMany({ select: { id: true, name: true } }),
  ]);

  const toMap = (
    records: Array<{ id: string; name: string }>
  ): Map<string, string> => {
    const map = new Map<string, string>();

    for (const record of records) {
      map.set(normalizeMasterName(record.name), record.id);
    }

    return map;
  };

  return {
    departments: toMap(departments),
    designations: toMap(designations),
    employeeTypes: toMap(employeeTypes),
    userTypes: toMap(userTypes),
    offices: toMap(offices),
  };
}

/**
 * Pre-load every email and phone in the file that already exists in the
 * database, using a small number of batched queries rather than one query per
 * row.
 */
async function loadExistingRecords(
  emails: string[],
  phones: string[]
): Promise<ExistingRecords> {
  const existing: ExistingRecords = {
    emails: new Set<string>(),
    phones: new Set<string>(),
  };

  const emailMatches = await Promise.all(
    chunk(emails, LOOKUP_CHUNK_SIZE).map((values) =>
      prisma.employee.findMany({
        where: { email: { in: values } },
        select: { email: true },
      })
    )
  );

  for (const matches of emailMatches) {
    for (const match of matches) {
      existing.emails.add(normalizeEmail(match.email));
    }
  }

  const phoneMatches = await Promise.all(
    chunk(phones, LOOKUP_CHUNK_SIZE).map((values) =>
      prisma.employee.findMany({
        where: { mobile: { in: values } },
        select: { mobile: true },
      })
    )
  );

  for (const matches of phoneMatches) {
    for (const match of matches) {
      if (match.mobile) {
        existing.phones.add(match.mobile);
      }
    }
  }

  return existing;
}

// ===========================================================================
// EXCEL PARSING
// ===========================================================================

/**
 * Extract data rows from the uploaded workbook.
 *
 * TEMPLATE COLUMNS:
 *   A = Email            G = Employee Type
 *   B = First Name       H = Role
 *   C = Last Name        I = User Type
 *   D = Phone Number     J = Office
 *   E = Department       K = Date of Joining
 *   F = Designation
 *
 * `rowNumber` is the real worksheet row number, so reported errors line up
 * with what the user sees in Excel.
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
      return {
        rows: [],
        error: "No worksheet found in Excel file",
      };
    }

    const rows: any[] = [];
    let dataRowCount = 0;

    worksheet.eachRow((row, rowNumber) => {
      // Skip the header row.
      if (rowNumber === 1) {
        return;
      }

      // ExcelJS returns a sparse, 1-based array for row.values.
      const values = (row.values as any[]) ?? [];

      const email = getExcelCellText(values[1]);
      const firstName = getExcelCellText(values[2]);
      const lastName = getExcelCellText(values[3]);
      const phone = getExcelCellText(values[4]);
      const department = getExcelCellText(values[5]);
      const designation = getExcelCellText(values[6]);
      const employeeType = getExcelCellText(values[7]);
      const role = getExcelCellText(values[8]);
      const userType = getExcelCellText(values[9]);
      const office = getExcelCellText(values[10]);
      const dateOfJoining = values[11];

      const isBlankRow =
        !email &&
        !firstName &&
        !lastName &&
        !phone &&
        !department &&
        !designation &&
        !employeeType &&
        !role &&
        !userType &&
        !office &&
        !dateOfJoining;

      // Blank rows are ignored entirely and never count towards the limit.
      if (isBlankRow) {
        return;
      }

      dataRowCount++;

      if (dataRowCount > MAX_ROWS) {
        return;
      }

      rows.push({
        rowNumber,
        email,
        firstName,
        lastName,
        phone,
        department,
        designation,
        employeeType,
        role,
        userType,
        office,
        dateOfJoining,
      });
    });

    if (dataRowCount > MAX_ROWS) {
      return {
        rows: [],
        error: `File contains too many rows. Maximum: ${MAX_ROWS}, Found: ${dataRowCount}`,
      };
    }

    return { rows };
  } catch (error) {
    return {
      rows: [],
      error: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"
        }`,
    };
  }
}

// ===========================================================================
// ROW VALIDATION
// ===========================================================================

/**
 * Validate a single employee row.
 *
 * Pure and synchronous: every lookup it needs has already been loaded into
 * memory. This is what removes the previous two-queries-per-row behaviour.
 *
 * A well-formed email or phone is recorded in `seen` even when the row is
 * rejected for another reason, so a repeated value in a later row is always
 * reported as a batch duplicate rather than being checked again.
 */
function validateEmployeeRow(
  row: any,
  seen: SeenValues,
  existing: ExistingRecords,
  errors: BulkUploadError[],
  masterData: MasterData
): ValidationOutcome {
  const {
    rowNumber,
    email,
    firstName,
    lastName,
    phone,
    department,
    designation,
    employeeType,
    role,
    userType,
    office,
    dateOfJoining,
  } = row;

  const fail = (
    field: string,
    value: any,
    message: string,
    reason: FailureKind = "VALIDATION"
  ): ValidationOutcome => {
    errors.push({ row: rowNumber, field, value, message });
    return { valid: false, reason };
  };

  // -------------------------------------------------------------------------
  // REQUIRED FIELDS
  // -------------------------------------------------------------------------

  if (!email || !firstName || !lastName) {
    return fail(
      "required_fields",
      `${email || "N/A"}, ${firstName || "N/A"}, ${lastName || "N/A"}`,
      "Email, First Name, and Last Name are required"
    );
  }

  const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`;

  // -------------------------------------------------------------------------
  // EMAIL
  // -------------------------------------------------------------------------

  const normalizedEmail = normalizeEmail(email);

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return fail("email", email, "Invalid email format");
  }

  // Claim the email before any further check, so a repeat in a later row is
  // reported as a batch duplicate even if this row fails below.
  const isRepeatedEmail = seen.emails.has(normalizedEmail);
  seen.emails.add(normalizedEmail);

  if (isRepeatedEmail) {
    return fail(
      "email",
      email,
      "Duplicate email in this upload batch",
      "DUPLICATE_EMAIL"
    );
  }

  if (existing.emails.has(normalizedEmail)) {
    return fail(
      "email",
      email,
      "Employee with this email already exists in database",
      "DUPLICATE_EMAIL"
    );
  }

  // -------------------------------------------------------------------------
  // PHONE
  // -------------------------------------------------------------------------

  let formattedPhone: string | undefined;

  if (phone) {
    const phoneValidation = validatePhoneNumber(String(phone).trim());

    if (!phoneValidation.valid) {
      return fail(
        "phone",
        phone,
        phoneValidation.error || "Invalid phone number"
      );
    }

    formattedPhone = phoneValidation.formatted;

    if (formattedPhone) {
      const isRepeatedPhone = seen.phones.has(formattedPhone);
      seen.phones.add(formattedPhone);

      if (isRepeatedPhone) {
        return fail(
          "phone",
          phone,
          "Duplicate phone in this upload batch",
          "DUPLICATE_PHONE"
        );
      }

      if (existing.phones.has(formattedPhone)) {
        return fail(
          "phone",
          phone,
          "Employee with this phone number already exists",
          "DUPLICATE_PHONE"
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // MASTER DATA REFERENCES
  // -------------------------------------------------------------------------

  const resolveMasterValue = (
    rawValue: string,
    lookup: Map<string, string>,
    field: string,
    label: string
  ):
    | { ok: true; id?: string }
    | { ok: false; outcome: ValidationOutcome } => {
    if (!rawValue) {
      return { ok: true };
    }

    const id = lookup.get(normalizeMasterName(rawValue));

    if (!id) {
      return {
        ok: false,
        outcome: fail(
          field,
          rawValue,
          `${label} "${rawValue}" not found in master list`
        ),
      };
    }

    return { ok: true, id };
  };

  const departmentResult = resolveMasterValue(
    department,
    masterData.departments,
    "department",
    "Department"
  );

  if (!departmentResult.ok) {
    return departmentResult.outcome;
  }

  const designationResult = resolveMasterValue(
    designation,
    masterData.designations,
    "designation",
    "Designation"
  );

  if (!designationResult.ok) {
    return designationResult.outcome;
  }

  const employeeTypeResult = resolveMasterValue(
    employeeType,
    masterData.employeeTypes,
    "employeeType",
    "Employee Type"
  );

  if (!employeeTypeResult.ok) {
    return employeeTypeResult.outcome;
  }

  const userTypeResult = resolveMasterValue(
    userType,
    masterData.userTypes,
    "userType",
    "User Type"
  );

  if (!userTypeResult.ok) {
    return userTypeResult.outcome;
  }

  const officeResult = resolveMasterValue(
    office,
    masterData.offices,
    "office",
    "Office"
  );

  if (!officeResult.ok) {
    return officeResult.outcome;
  }

  // -------------------------------------------------------------------------
  // ROLE
  // -------------------------------------------------------------------------

  let employeeRole: "ADMIN" | "EMPLOYEE" = "EMPLOYEE";

  if (role) {
    const normalizedRole = String(role).trim().toUpperCase();

    if (normalizedRole !== "ADMIN" && normalizedRole !== "EMPLOYEE") {
      return fail("role", role, 'Role must be either "ADMIN" or "EMPLOYEE"');
    }

    employeeRole = normalizedRole;
  }

  // -------------------------------------------------------------------------
  // DATE OF JOINING
  // -------------------------------------------------------------------------

  let doj: Date | undefined;

  if (
    dateOfJoining !== null &&
    dateOfJoining !== undefined &&
    dateOfJoining !== ""
  ) {
    const reportedValue =
      dateOfJoining instanceof Date
        ? dateOfJoining.toISOString()
        : dateOfJoining;

    const parsedDate = parseExcelDate(dateOfJoining);

    if (!parsedDate) {
      return fail(
        "dateOfJoining",
        reportedValue,
        'Date of Joining must be a valid date (e.g. "2024-01-15")'
      );
    }

    if (parsedDate > startOfToday()) {
      return fail(
        "dateOfJoining",
        reportedValue,
        "Date of Joining cannot be in the future"
      );
    }

    doj = parsedDate;
  }

  // -------------------------------------------------------------------------
  // VALIDATED
  // -------------------------------------------------------------------------

  return {
    valid: true,
    data: {
      email: normalizedEmail,
      fullName,
      mobile: formattedPhone,
      departmentId: departmentResult.id,
      designationId: designationResult.id,
      employeeTypeId: employeeTypeResult.id,
      userTypeId: userTypeResult.id,
      officeId: officeResult.id,
      role: employeeRole,
      dateOfJoining: doj,
    },
  };
}

// ===========================================================================
// API HANDLER
// ===========================================================================

export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // AUTHENTICATION / PERMISSION
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // FILE INTAKE
    // -----------------------------------------------------------------------

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    const rejectUpload = (message: string) =>
      NextResponse.json(
        {
          error: message,
          success: 0,
          failed: 0,
          errors: [],
          createdEmployees: [],
        },
        { status: 422 }
      );

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 422 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return rejectUpload(
        "Invalid file type. Only .xlsx (Excel) files are supported"
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return rejectUpload(
        `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // -----------------------------------------------------------------------
    // PARSE
    // -----------------------------------------------------------------------

    const parseResult = await parseExcelFile(file);

    if (parseResult.error) {
      return rejectUpload(parseResult.error);
    }

    const excelRows = parseResult.rows;

    if (excelRows.length === 0) {
      return rejectUpload("No data rows found in Excel file");
    }

    // -----------------------------------------------------------------------
    // PRE-LOAD LOOKUPS
    //
    // Master data and existing employees are loaded once, up front, so that
    // row validation needs no database access at all.
    // -----------------------------------------------------------------------

    const candidateEmails = Array.from(
      new Set(
        excelRows
          .map((row) => normalizeEmail(row.email))
          .filter((email) => EMAIL_PATTERN.test(email))
      )
    );

    const candidatePhones = Array.from(
      new Set(
        excelRows
          .map((row) => {
            if (!row.phone) {
              return undefined;
            }

            const phoneValidation = validatePhoneNumber(
              String(row.phone).trim()
            );

            return phoneValidation.valid
              ? phoneValidation.formatted
              : undefined;
          })
          .filter((phone): phone is string => Boolean(phone))
      )
    );

    const [masterData, existing] = await Promise.all([
      loadMasterData(),
      loadExistingRecords(candidateEmails, candidatePhones),
    ]);

    // -----------------------------------------------------------------------
    // PROCESS ROWS
    // -----------------------------------------------------------------------

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

    const seen: SeenValues = {
      emails: new Set<string>(),
      phones: new Set<string>(),
    };

    const recordFailure = (reason: FailureKind) => {
      result.failed++;
      result.summary.failedImports++;

      if (reason === "DUPLICATE_EMAIL") {
        result.summary.duplicateEmails++;
      } else if (reason === "DUPLICATE_PHONE") {
        result.summary.duplicatePhones++;
      } else {
        result.summary.validationErrors++;
      }
    };

    // Rows are processed sequentially so that errors are reported in file
    // order and the connection pool is never saturated by a large upload.
    for (const row of excelRows) {
      const validation = validateEmployeeRow(
        row,
        seen,
        existing,
        result.errors,
        masterData
      );

      if (!validation.valid) {
        recordFailure(validation.reason);
        continue;
      }

      const employeeData = validation.data;

      try {
        const temporaryPassword = generateSecurePassword();
        const passwordHash = await hashPassword(temporaryPassword);

        // Employee creation and its audit entry are atomic: if either fails,
        // neither is persisted.
        const newEmployee = await prisma.$transaction(async (tx) => {
          const employee = await tx.employee.create({
            data: {
              email: employeeData.email,
              fullName: employeeData.fullName,
              mobile: employeeData.mobile ?? null,
              departmentId: employeeData.departmentId ?? null,
              designationId: employeeData.designationId ?? null,
              employeeTypeId: employeeData.employeeTypeId ?? null,
              userTypeId: employeeData.userTypeId ?? null,
              officeId: employeeData.officeId ?? null,
              passwordHash,
              role: employeeData.role ?? "EMPLOYEE",
              createdById: admin.sub,
            },
          });

          await tx.auditLog.create({
            data: {
              employeeId: admin.sub,
              action: "EMPLOYEE_CREATED",
              entity: "Employee",
              entityId: employee.id,
              metadata: {
                source: "bulk_upload",
                fileName: file.name,
              },
            },
          });

          return employee;
        });

        // The row is now committed. Record it so a concurrent upload racing
        // this one cannot re-insert the same values.
        existing.emails.add(employeeData.email);

        if (employeeData.mobile) {
          existing.phones.add(employeeData.mobile);
        }

        result.success++;
        result.summary.successfulImports++;

        result.createdEmployees.push({
          id: newEmployee.id,
          email: newEmployee.email ?? "",
          temporaryPassword,
        });
      } catch (createError) {
        // A unique constraint violation means another request inserted this
        // value between the pre-load and this write. Nothing was created, so
        // report it as the duplicate it is rather than a raw database error.
        const uniqueViolation = asUniqueConstraintError(createError);

        if (uniqueViolation) {
          const isPhoneConflict = uniqueViolation.target.some((column) =>
            column.toLowerCase().includes("mobile")
          );

          if (isPhoneConflict) {
            result.errors.push({
              row: row.rowNumber,
              field: "phone",
              value: employeeData.mobile,
              message: "Employee with this phone number already exists",
            });

            recordFailure("DUPLICATE_PHONE");
          } else {
            result.errors.push({
              row: row.rowNumber,
              field: "email",
              value: employeeData.email,
              message: "Employee with this email already exists in database",
            });

            recordFailure("DUPLICATE_EMAIL");
          }

          continue;
        }

        console.error(
          `Employee creation failed for row ${row.rowNumber}:`,
          createError
        );

        result.errors.push({
          row: row.rowNumber,
          field: "database",
          value: employeeData.email,
          message: `Failed to create employee: ${createError instanceof Error
            ? createError.message
            : "Unknown error"
            }`,
        });

        recordFailure("VALIDATION");
      }
    }

    // -----------------------------------------------------------------------
    // COMPLETION AUDIT
    //
    // A failure here must never turn a successful upload into an error
    // response: the employees are already committed.
    // -----------------------------------------------------------------------

    try {
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
    } catch (auditError) {
      console.error(
        "Bulk upload completion audit logging failed:",
        auditError
      );
    }

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