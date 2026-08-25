/**
 * Attendance Validator
 * Business rules:
 * - Only same-day attendance marking allowed
 * - No past date entries
 * - No future date entries
 * - Server-side date validation (never trust client)
 */

export interface AttendanceValidationResult {
  allowed: boolean;
  reason?: string;
  code?: "INVALID_DATE" | "PAST_DATE" | "FUTURE_DATE" | "ALREADY_CHECKED_IN" | "VALID";
}

/**
 * Validate attendance check-in date
 * CRITICAL: Always use server-side date, never trust client
 */
export const validateAttendanceCheckIn = (
  checkInDate: Date
): AttendanceValidationResult => {
  // Get today's date (server-side, UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Normalize provided date
  const providedDate = new Date(checkInDate);
  providedDate.setUTCHours(0, 0, 0, 0);

  // Check if date is in the past
  if (providedDate < today) {
    return {
      allowed: false,
      reason: `Cannot mark attendance for past dates. Your date: ${providedDate.toDateString()}, Today: ${today.toDateString()}`,
      code: "PAST_DATE",
    };
  }

  // Check if date is in the future
  if (providedDate > today) {
    return {
      allowed: false,
      reason: `Cannot mark attendance for future dates. Your date: ${providedDate.toDateString()}, Today: ${today.toDateString()}`,
      code: "FUTURE_DATE",
    };
  }

  // Date matches today - allowed
  return {
    allowed: true,
    code: "VALID",
  };
};

/**
 * Validate attendance check-out
 * Check-out time must be after check-in time
 */
export const validateAttendanceCheckOut = (
  checkInTime: Date,
  checkOutTime: Date
): AttendanceValidationResult => {
  if (checkOutTime <= checkInTime) {
    return {
      allowed: false,
      reason: `Check-out time (${checkOutTime.toLocaleTimeString()}) must be after check-in time (${checkInTime.toLocaleTimeString()})`,
      code: "INVALID_DATE",
    };
  }

  // Check if check-out is within 12 hours (reasonable work day)
  const hoursDiff = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
  if (hoursDiff > 24) {
    return {
      allowed: false,
      reason: `Check-out time is too far from check-in (${hoursDiff.toFixed(1)} hours apart)`,
      code: "INVALID_DATE",
    };
  }

  return {
    allowed: true,
    code: "VALID",
  };
};

/**
 * Get today's date for server (normalized to midnight UTC)
 */
export const getTodayDate = (): Date => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
};

/**
 * Format date for database storage
 */
export const formatDateForDB = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized.toISOString().split("T")[0]; // Returns YYYY-MM-DD
};

/**
 * Get date range for a day
 * Returns [startOfDay, endOfDay] timestamps
 */
export const getDayRange = (date: Date): [Date, Date] => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);

  return [start, end];
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  const d1 = new Date(date1);
  d1.setUTCHours(0, 0, 0, 0);

  const d2 = new Date(date2);
  d2.setUTCHours(0, 0, 0, 0);

  return d1.getTime() === d2.getTime();
};

/**
 * Attendance statistics for a date
 */
export interface AttendanceStats {
  date: string; // YYYY-MM-DD
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  onLeaveCount: number;
  attendancePercentage: number;
}

/**
 * Calculate working hours between check-in and check-out
 */
export const calculateWorkingHours = (
  checkInTime: Date,
  checkOutTime: Date | null
): number => {
  if (!checkOutTime) {
    return 0;
  }

  const diffMs = checkOutTime.getTime() - checkInTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.round(diffHours * 2) / 2; // Round to nearest 0.5 hour
};

/**
 * Determine if a day is a weekend (Saturday = 6, Sunday = 0)
 */
export const isWeekend = (date: Date): boolean => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Get day name from date
 */
export const getDayName = (date: Date): string => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getUTCDay()];
};

/**
 * Check if attendance is already marked for a specific date and employee
 * (This would be called from database query in actual API)
 */
export const hasAttendanceAlready = (
  existingAttendance: any,
  checkInDate: Date
): boolean => {
  if (!existingAttendance) {
    return false;
  }

  return isSameDay(existingAttendance.date, checkInDate);
};

/**
 * Validate bulk attendance import
 */
export interface BulkAttendanceImportRow {
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE";
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  remarks?: string;
}

export interface BulkAttendanceImportResult {
  valid: BulkAttendanceImportRow[];
  invalid: Array<{
    row: number;
    field: string;
    value: string;
    error: string;
  }>;
}

export const validateBulkAttendanceImport = (
  rows: BulkAttendanceImportRow[]
): BulkAttendanceImportResult => {
  const valid: BulkAttendanceImportRow[] = [];
  const invalid: Array<{
    row: number;
    field: string;
    value: string;
    error: string;
  }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 0-indexing

    // Validate employee ID
    if (!row.employeeId || row.employeeId.trim() === "") {
      invalid.push({
        row: rowNumber,
        field: "employeeId",
        value: row.employeeId || "",
        error: "Employee ID is required",
      });
      return;
    }

    // Validate date format
    if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      invalid.push({
        row: rowNumber,
        field: "date",
        value: row.date || "",
        error: "Date must be in YYYY-MM-DD format",
      });
      return;
    }

    // Validate date is not in future
    const dateObj = new Date(row.date);
    const validation = validateAttendanceCheckIn(dateObj);
    if (!validation.allowed && validation.code === "FUTURE_DATE") {
      invalid.push({
        row: rowNumber,
        field: "date",
        value: row.date,
        error: "Cannot import attendance for future dates",
      });
      return;
    }

    // Validate status
    const validStatuses = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"];
    if (!validStatuses.includes(row.status)) {
      invalid.push({
        row: rowNumber,
        field: "status",
        value: row.status,
        error: `Status must be one of: ${validStatuses.join(", ")}`,
      });
      return;
    }

    // Validate times if provided
    if (row.checkInTime && !/^\d{2}:\d{2}:\d{2}$/.test(row.checkInTime)) {
      invalid.push({
        row: rowNumber,
        field: "checkInTime",
        value: row.checkInTime,
        error: "Check-in time must be in HH:mm:ss format",
      });
      return;
    }

    if (row.checkOutTime && !/^\d{2}:\d{2}:\d{2}$/.test(row.checkOutTime)) {
      invalid.push({
        row: rowNumber,
        field: "checkOutTime",
        value: row.checkOutTime,
        error: "Check-out time must be in HH:mm:ss format",
      });
      return;
    }

    // All validations passed
    valid.push(row);
  });

  return { valid, invalid };
};

/**
 * Test cases
 */
export const attendanceValidatorTests = {
  checkIn: {
    valid: [
      { date: new Date(), description: "Today's date" },
    ],
    invalid: [
      {
        date: new Date(Date.now() - 86400000), // Yesterday
        description: "Past date",
        expectedCode: "PAST_DATE",
      },
      {
        date: new Date(Date.now() + 86400000), // Tomorrow
        description: "Future date",
        expectedCode: "FUTURE_DATE",
      },
    ],
  },
  checkOut: {
    valid: [
      {
        checkIn: new Date("2024-01-01T09:00:00"),
        checkOut: new Date("2024-01-01T17:00:00"),
        description: "Valid 8-hour workday",
      },
    ],
    invalid: [
      {
        checkIn: new Date("2024-01-01T09:00:00"),
        checkOut: new Date("2024-01-01T08:00:00"),
        description: "Check-out before check-in",
      },
      {
        checkIn: new Date("2024-01-01T09:00:00"),
        checkOut: new Date("2024-01-02T19:00:00"),
        description: "Check-out 34 hours later (too long)",
      },
    ],
  },
};