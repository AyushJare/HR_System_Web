import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { toDateOnlyUTC } from "@/lib/dateOnly";
import {
  getWeeklyOffSettings,
  isWeeklyOff,
  checkIfDateIsOff,
} from "@/lib/attendanceUtils";
import {
  calculateAttendanceStatus,
  calculateWorkedMinutes,
  formatWorkedDuration,
  parseIndiaDateTime,
} from "@/lib/attendanceAutomation";

function getTodayIndiaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = toDateOnlyUTC(value);

  return parsed.toISOString().slice(0, 10) === value;
}

function formatTimeForAudit(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateForAudit(value: Date): string {
  return value.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/*
 * ============================================================
 * GET ATTENDANCE
 * ============================================================
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const employeeId = session.sub;

    const dateParam =
      request.nextUrl.searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { error: "date is required" },
        { status: 400 }
      );
    }

    if (!isValidDateString(dateParam)) {
      return NextResponse.json(
        { error: "Invalid date. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }

    /*
     * Non-admin users can view attendance if they have
     * any of the relevant self-service view permissions.
     */
    if (session.role !== "ADMIN") {
      const [
        attendanceView,
        dailyAttendanceView,
        checkInView,
      ] = await Promise.all([
        checkPermission(
          employeeId,
          "Attendance",
          "view"
        ),

        checkPermission(
          employeeId,
          "Daily Attendance",
          "view"
        ),

        checkPermission(
          employeeId,
          "Check In",
          "view"
        ),
      ]);

      const allowed =
        attendanceView ||
        dailyAttendanceView ||
        checkInView;

      if (!allowed) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to view Attendance",
          },
          { status: 403 }
        );
      }
    }

    const date = toDateOnlyUTC(dateParam);

    const weeklyOffConfig =
      await getWeeklyOffSettings();

    const dateOffInfo =
      await checkIfDateIsOff(date);

    const employeeWhere =
      session.role === "ADMIN"
        ? {
          isActive: true,
        }
        : {
          isActive: true,
          id: employeeId,
        };

    const employees =
      await prisma.employee.findMany({
        where: employeeWhere,

        orderBy: {
          employeeCode: "asc",
        },

        select: {
          id: true,
          employeeCode: true,
          fullName: true,

          attendances: {
            where: {
              date,
              deletedAt: null,
            },

            select: {
              id: true,
              checkInTime: true,
              checkOutTime: true,
              status: true,
              reason: true,
            },
          },
        },
      });

    const isDateWeeklyOff =
      isWeeklyOff(
        date,
        weeklyOffConfig
      );

    const result =
      employees.map((emp) => {
        const attendance =
          emp.attendances[0] ?? null;

        const effectiveStatus =
          isDateWeeklyOff &&
            attendance?.status === "ABSENT"
            ? "WEEKLY_OFF"
            : attendance?.status;

        const workedMinutes =
          attendance?.checkInTime &&
            attendance?.checkOutTime
            ? calculateWorkedMinutes(
              attendance.checkInTime,
              attendance.checkOutTime
            )
            : null;

        const workedDuration =
          workedMinutes !== null
            ? formatWorkedDuration(
              workedMinutes
            )
            : null;

        return {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,

          attendance: attendance
            ? {
              id: attendance.id,

              timeIn:
                attendance.checkInTime,

              timeOut:
                attendance.checkOutTime,

              status:
                attendance.status,

              effectiveStatus,

              isWeeklyOff:
                isDateWeeklyOff,

              reason:
                attendance.reason,

              workedMinutes,

              workedDuration,
            }
            : null,

          dateInfo: dateOffInfo,
        };
      });

    return NextResponse.json({
      role: session.role,

      date: dateParam,

      dateOffInfo,

      employees: result,

      count: result.length,
    });
  } catch (error) {
    console.error(
      "GET /api/attendance error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load attendance",

        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

/*
 * ============================================================
 * POST ATTENDANCE
 * ============================================================
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const employeeId = session.sub;

    const body = await request.json();

    const {
      employeeId: requestedEmployeeId,
      date,
      timeIn,
      timeOut,
      status,
      reason,
      action,
    } = body;

    /*
     * ==========================================================
     * BASIC VALIDATION
     * ==========================================================
     */

    if (!date) {
      return NextResponse.json(
        {
          error: "date is required",
        },
        { status: 400 }
      );
    }

    if (!isValidDateString(date)) {
      return NextResponse.json(
        {
          error:
            "Invalid date. Expected YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    /*
     * ==========================================================
     * EMPLOYEE LOGIN / LOGOUT
     * ==========================================================
     */

    if (
      action === "LOGIN" ||
      action === "LOGOUT"
    ) {
      if (session.role !== "EMPLOYEE" && session.role !== "ADMIN") {
        return NextResponse.json(
          {
            error:
              "Login/logout actions are only available to employees and admins",
          },
          { status: 403 }
        );
      }

      /*
       * Never trust employeeId from frontend.
       */
      if (
        requestedEmployeeId &&
        requestedEmployeeId !== employeeId
      ) {
        return NextResponse.json(
          {
            error:
              "You can only modify your own attendance",
          },
          { status: 403 }
        );
      }

      /*
       * Employees can only login/logout today.
       */
      const serverToday =
        getTodayIndiaDate();

      if (date !== serverToday) {
        return NextResponse.json(
          {
            error:
              "You can only log in or log out for today",
          },
          { status: 400 }
        );
      }

      /*
       * Employee must exist and be active.
       */
      const employee =
        await prisma.employee.findUnique({
          where: {
            id: employeeId,
          },

          select: {
            id: true,
            fullName: true,
            isActive: true,
          },
        });

      if (!employee) {
        return NextResponse.json(
          {
            error: "Employee not found",
          },
          { status: 404 }
        );
      }

      if (!employee.isActive) {
        return NextResponse.json(
          {
            error:
              "Employee is inactive",
          },
          { status: 400 }
        );
      }

      /*
       * Check Check In permission.
       */
      const canCheckIn =
        await checkPermission(
          employeeId,
          "Check In",
          "add"
        );

      if (!canCheckIn) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to check in",
          },
          { status: 403 }
        );
      }

      const attendanceDate =
        toDateOnlyUTC(date);

      /*
       * Don't allow login/logout on weekly off
       * or holiday.
       */
      const dateOffInfo =
        await checkIfDateIsOff(
          attendanceDate
        );

      if (dateOffInfo.isOff) {
        return NextResponse.json(
          {
            error:
              "Attendance cannot be logged on a weekly off or holiday",

            dateOffInfo,
          },
          { status: 400 }
        );
      }

      /*
       * Don't allow employees to login/logout when
       * they have approved leave for today.
       */
      const approvedLeaveApprovals =
        await prisma.approval.findMany({
          where: {
            type: "LEAVE",
            status: "APPROVED",
            actorId: employeeId,
          },
          select: {
            details: true,
          },
        });

      const hasApprovedLeave =
        approvedLeaveApprovals.some((approval) => {
          const details = approval.details as {
            date?: string;
          } | null;

          return details?.date === date;
        });

      if (hasApprovedLeave) {
        return NextResponse.json(
          {
            error:
              "You cannot check in or check out because you have approved leave today",
          },
          { status: 400 }
        );
      }

      /*
       * Find today's attendance.
       */
      const existingAttendance =
        await prisma.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId,
              date: attendanceDate,
            },
          },
        });

      /*
       * Don't allow an employee to check in when
       * the attendance is already marked as approved leave.
       */
      if (
        action === "LOGIN" &&
        existingAttendance?.status === "ON_LEAVE"
      ) {
        return NextResponse.json(
          {
            error:
              "You are marked as on approved leave today",
          },
          { status: 400 }
        );
      }

      /*
       * ========================================================
       * LOGIN
       * ========================================================
       */

      if (action === "LOGIN") {
        if (
          existingAttendance?.checkInTime
        ) {
          return NextResponse.json(
            {
              error:
                "You have already logged in today",
            },
            { status: 400 }
          );
        }

        const now = new Date();

        const attendance =
          existingAttendance
            ? await prisma.attendance.update({
              where: {
                id: existingAttendance.id,
              },

              data: {
                checkInTime: now,

                checkOutTime: null,

                status: "PRESENT",

                reason: null,

                modifiedBy:
                  employeeId,

                deletedAt: null,
              },
            })
            : await prisma.attendance.create({
              data: {
                employeeId,

                date:
                  attendanceDate,

                checkInTime: now,

                checkOutTime: null,

                status: "PRESENT",

                reason: null,

                modifiedBy:
                  employeeId,
              },
            });

        await prisma.auditLog.create({
          data: {
            employeeId,

            action:
              "ATTENDANCE_LOGGED_IN",

            entity:
              "Attendance",

            entityId:
              attendance.id,

            metadata: {
              targetEmployeeId:
                employee.id,

              targetEmployeeName:
                employee.fullName,

              date,

              attendanceTime:
                now.toISOString(),

              timeIn:
                now.toISOString(),

              message:
                `${employee.fullName} logged in at ${formatTimeForAudit(
                  now
                )}`,
            },
          },
        });

        return NextResponse.json({
          ...attendance,

          message:
            "Logged in successfully",
        });
      }

      /*
       * ========================================================
       * LOGOUT
       * ========================================================
       */

      if (
        !existingAttendance?.checkInTime
      ) {
        return NextResponse.json(
          {
            error:
              "You must log in before logging out",
          },
          { status: 400 }
        );
      }

      if (
        existingAttendance.checkOutTime
      ) {
        return NextResponse.json(
          {
            error:
              "You have already logged out today",
          },
          { status: 400 }
        );
      }

      const now = new Date();

      /*
       * Automatically determine status.
       *
       * >= 8 hours = PRESENT
       * >= 4 hours and < 8 hours = HALF_DAY
       * < 4 hours = WORKED
       */
      const calculatedStatus =
        calculateAttendanceStatus(
          existingAttendance.checkInTime,
          now
        );

      const workedMinutes =
        calculateWorkedMinutes(
          existingAttendance.checkInTime,
          now
        );

      const workedDuration =
        formatWorkedDuration(
          workedMinutes
        );

      const attendance =
        await prisma.attendance.update({
          where: {
            id:
              existingAttendance.id,
          },

          data: {
            checkOutTime: now,

            status:
              calculatedStatus,

            modifiedBy:
              employeeId,

            deletedAt: null,
          },
        });

      await prisma.auditLog.create({
        data: {
          employeeId,

          action:
            "ATTENDANCE_LOGGED_OUT",

          entity:
            "Attendance",

          entityId:
            attendance.id,

          metadata: {
            targetEmployeeId:
              employee.id,

            targetEmployeeName:
              employee.fullName,

            date,

            attendanceTime:
              now.toISOString(),

            timeOut:
              now.toISOString(),

            oldStatus:
              existingAttendance.status,

            newStatus:
              attendance.status,

            workedMinutes,

            workedDuration,

            message:
              `${employee.fullName} logged out at ${formatTimeForAudit(
                now
              )}. Worked: ${workedDuration}. Status: ${attendance.status === "HALF_DAY"
                ? "Half Day"
                : attendance.status === "WORKED"
                  ? "Worked"
                  : "Present"
              }`,
          },
        },
      });

      return NextResponse.json({
        ...attendance,

        workedMinutes,

        workedDuration,

        message:
          attendance.status === "HALF_DAY"
            ? `Logged out successfully. Attendance marked as Half Day. Worked ${workedDuration}.`
            : attendance.status === "WORKED"
              ? `Logged out successfully. Worked ${workedDuration}.`
              : "Logged out successfully. Attendance marked as Present.",
      });
    }

    /*
     * ==========================================================
     * ADMIN / MANUAL ATTENDANCE SAVE
     * ==========================================================
     */

    let canModifyAttendance =
      false;

    if (session.role === "ADMIN") {
      canModifyAttendance = true;
    } else {
      const [
        attendanceAdd,
        attendanceEdit,
        dailyAttendanceAdd,
        dailyAttendanceEdit,
        correctionAdd,
        correctionEdit,
      ] = await Promise.all([
        checkPermission(
          employeeId,
          "Attendance",
          "add"
        ),

        checkPermission(
          employeeId,
          "Attendance",
          "edit"
        ),

        checkPermission(
          employeeId,
          "Daily Attendance",
          "add"
        ),

        checkPermission(
          employeeId,
          "Daily Attendance",
          "edit"
        ),

        checkPermission(
          employeeId,
          "Attendance Corrections",
          "add"
        ),

        checkPermission(
          employeeId,
          "Attendance Corrections",
          "edit"
        ),
      ]);

      /*
       * IMPORTANT:
       *
       * "Check In -> add" is intentionally NOT included here.
       * That permission is only for employee login/logout.
       */
      canModifyAttendance =
        attendanceAdd ||
        attendanceEdit ||
        dailyAttendanceAdd ||
        dailyAttendanceEdit ||
        correctionAdd ||
        correctionEdit;
    }

    if (!canModifyAttendance) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to modify Attendance",
        },
        { status: 403 }
      );
    }

    /*
     * ==========================================================
     * DETERMINE TARGET EMPLOYEE
     * ==========================================================
     */

    let targetEmployeeId: string;

    if (session.role === "ADMIN") {
      if (!requestedEmployeeId) {
        return NextResponse.json(
          {
            error:
              "employeeId is required",
          },
          { status: 400 }
        );
      }

      targetEmployeeId =
        requestedEmployeeId;
    } else {
      /*
       * Non-admin users can ONLY modify themselves.
       */
      targetEmployeeId =
        employeeId;

      if (
        requestedEmployeeId &&
        requestedEmployeeId !==
        employeeId
      ) {
        return NextResponse.json(
          {
            error:
              "You can only modify your own attendance",
          },
          { status: 403 }
        );
      }
    }

    /*
     * ==========================================================
     * GET TARGET EMPLOYEE
     * ==========================================================
     */

    const targetEmployee =
      await prisma.employee.findUnique({
        where: {
          id: targetEmployeeId,
        },

        select: {
          id: true,
          fullName: true,
          isActive: true,
        },
      });

    if (!targetEmployee) {
      return NextResponse.json(
        {
          error:
            "Employee not found",
        },
        { status: 404 }
      );
    }

    if (!targetEmployee.isActive) {
      return NextResponse.json(
        {
          error:
            "Employee is inactive",
        },
        { status: 400 }
      );
    }

    const attendanceDate =
      toDateOnlyUTC(date);

    /*
     * ==========================================================
     * DATE / WEEKLY OFF INFORMATION
     * ==========================================================
     */

    const weeklyOffConfig =
      await getWeeklyOffSettings();

    const isDateWeeklyOff =
      isWeeklyOff(
        attendanceDate,
        weeklyOffConfig
      );

    const dateOffInfo =
      await checkIfDateIsOff(
        attendanceDate
      );

    if (
      isDateWeeklyOff &&
      status !== "WEEKLY_OFF" &&
      status !== "ABSENT"
    ) {
      console.warn(
        `[ATTENDANCE] Attendance manually modified on weekly off day for employee ${targetEmployeeId} on ${date}`
      );
    }

    /*
     * If someone tries to mark ABSENT on a weekly off,
     * keep your existing WEEKLY_OFF behavior.
     */
    const effectiveStatus =
      isDateWeeklyOff &&
        status === "ABSENT"
        ? "WEEKLY_OFF"
        : status;

    /*
     * ==========================================================
     * EXISTING ATTENDANCE
     * ==========================================================
     */

    const existingAttendance =
      await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId:
              targetEmployeeId,

            date:
              attendanceDate,
          },
        },

        select: {
          id: true,

          checkInTime: true,

          checkOutTime: true,

          status: true,

          reason: true,

          deletedAt: true,
        },
      });

    /*
     * ==========================================================
     * PROTECT APPROVED LEAVE
     * ==========================================================
     *
     * ON_LEAVE must not be overwritten by a manual attendance
     * operation. Leave can only be changed through the proper
     * leave/attendance correction flow.
     */
    if (
      existingAttendance &&
      !existingAttendance.deletedAt &&
      existingAttendance.status === "ON_LEAVE"
    ) {
      return NextResponse.json(
        {
          error:
            "Attendance cannot be modified because the employee is marked as on leave for this date.",
        },
        { status: 409 }
      );
    }

    /*
     * ==========================================================
     * PREPARE NEW TIME VALUES
     * ==========================================================
     */

    const hasTimeIn =
      Object.prototype.hasOwnProperty.call(
        body,
        "timeIn"
      );

    const hasTimeOut =
      Object.prototype.hasOwnProperty.call(
        body,
        "timeOut"
      );

    /*
     * --------------------------
     * TIME IN
     * --------------------------
     */

    let newCheckInTime:
      Date | null;

    if (hasTimeIn) {
      if (
        timeIn === null ||
        timeIn === ""
      ) {
        newCheckInTime =
          existingAttendance?.checkInTime ??
          null;
      } else {
        if (
          typeof timeIn !== "string"
        ) {
          return NextResponse.json(
            {
              error:
                "Invalid timeIn",
            },
            { status: 400 }
          );
        }

        newCheckInTime =
          parseIndiaDateTime(
            date,
            timeIn
          );

        if (!newCheckInTime) {
          return NextResponse.json(
            {
              error:
                "Invalid timeIn. Expected HH:mm.",
            },
            { status: 400 }
          );
        }
      }
    } else {
      newCheckInTime =
        existingAttendance?.checkInTime ??
        null;
    }

    /*
     * --------------------------
     * TIME OUT
     * --------------------------
     *
     * undefined = preserve existing
     * null      = explicitly clear
     * string    = set new checkout
     */

    let newCheckOutTime:
      Date | null;

    if (!hasTimeOut) {
      newCheckOutTime =
        existingAttendance?.checkOutTime ??
        null;
    } else if (
      timeOut === null ||
      timeOut === ""
    ) {
      newCheckOutTime = null;
    } else {
      if (
        typeof timeOut !== "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid timeOut",
          },
          { status: 400 }
        );
      }

      newCheckOutTime =
        parseIndiaDateTime(
          date,
          timeOut
        );

      if (!newCheckOutTime) {
        return NextResponse.json(
          {
            error:
              "Invalid timeOut. Expected HH:mm.",
          },
          { status: 400 }
        );
      }
    }

    /*
     * ==========================================================
     * VALIDATE TIME ORDER
     * ==========================================================
     */

    if (
      newCheckInTime &&
      newCheckOutTime &&
      newCheckOutTime.getTime() <
      newCheckInTime.getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "Check-out time cannot be earlier than check-in time",
        },
        { status: 400 }
      );
    }

    /*
     * ==========================================================
     * DETERMINE STATUS
     * ==========================================================
     */

    let newStatus =
      effectiveStatus ||
      existingAttendance?.status ||
      "PRESENT";

    /*
     * If both check-in and check-out exist,
     * automatically calculate PRESENT vs HALF_DAY vs WORKED.
     *
     * ABSENT / ON_LEAVE / WEEKLY_OFF are preserved
     * because those are explicit attendance states.
     */
    const isExplicitStatus =
      newStatus === "ABSENT" ||
      newStatus === "ON_LEAVE" ||
      newStatus === "WEEKLY_OFF";

    if (
      !isExplicitStatus &&
      newCheckInTime &&
      newCheckOutTime
    ) {
      /*
       * IMPORTANT FIX:
       *
       * Both values are checked before calling
       * calculateAttendanceStatus(), so TypeScript
       * knows they are Date rather than Date | null.
       */
      newStatus =
        calculateAttendanceStatus(
          newCheckInTime,
          newCheckOutTime
        );
    }

    /*
     * If status is not explicitly supplied and there is
     * no checkout yet, preserve the existing status or PRESENT.
     */
    if (
      !status &&
      !newCheckOutTime &&
      newCheckInTime &&
      !isExplicitStatus
    ) {
      newStatus =
        existingAttendance?.status ===
          "HALF_DAY"
          ? "HALF_DAY"
          : existingAttendance?.status ===
            "WORKED"
            ? "WORKED"
            : "PRESENT";
    }

    /*
     * ==========================================================
     * REASON
     * ==========================================================
     */

    const newReason =
      reason === undefined
        ? existingAttendance?.reason ??
        null
        : reason || null;

    /*
     * ==========================================================
     * SAVE ATTENDANCE
     * ==========================================================
     */

    const attendance =
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId:
              targetEmployeeId,

            date:
              attendanceDate,
          },
        },

        update: {
          checkInTime:
            newCheckInTime ??
            new Date(
              `${date}T00:00:00+05:30`
            ),

          checkOutTime:
            newCheckOutTime,

          status:
            newStatus,

          reason:
            newReason,

          modifiedBy:
            employeeId,

          deletedAt:
            null,
        },

        create: {
          employeeId:
            targetEmployeeId,

          date:
            attendanceDate,

          /*
           * Attendance.checkInTime is required in Prisma.
           *
           * For ABSENT / ON_LEAVE / WEEKLY_OFF without
           * a real check-in, use the beginning of that
           * India calendar date rather than "now".
           */
          checkInTime:
            newCheckInTime ??
            new Date(
              `${date}T00:00:00+05:30`
            ),

          checkOutTime:
            newCheckOutTime,

          status:
            newStatus,

          reason:
            newReason,

          modifiedBy:
            employeeId,
        },
      });

    /*
     * ==========================================================
     * AUDIT ACTION
     * ==========================================================
     */

    const isExistingAttendance =
      Boolean(existingAttendance);

    const auditAction =
      isExistingAttendance
        ? "ATTENDANCE_UPDATED"
        : "ATTENDANCE_MARKED";

    /*
     * ==========================================================
     * ACTOR
     * ==========================================================
     */

    const actor =
      await prisma.employee.findUnique({
        where: {
          id: employeeId,
        },

        select: {
          fullName: true,
        },
      });

    const actorName =
      actor?.fullName ??
      "System";

    /*
     * ==========================================================
     * OLD VALUES
     * ==========================================================
     */

    const oldTimeIn =
      existingAttendance?.checkInTime ??
      null;

    const oldTimeOut =
      existingAttendance?.checkOutTime ??
      null;

    const oldStatus =
      existingAttendance?.status ??
      null;

    const oldReason =
      existingAttendance?.reason ??
      null;

    /*
     * ==========================================================
     * WORKED DURATION
     * ==========================================================
     */

    const workedMinutes =
      attendance.checkInTime &&
        attendance.checkOutTime
        ? calculateWorkedMinutes(
          attendance.checkInTime,
          attendance.checkOutTime
        )
        : null;

    const workedDuration =
      workedMinutes !== null
        ? formatWorkedDuration(
          workedMinutes
        )
        : null;

    /*
     * ==========================================================
     * AUDIT MESSAGE
     * ==========================================================
     */

    let auditMessage: string;

    if (
      auditAction ===
      "ATTENDANCE_UPDATED"
    ) {
      auditMessage =
        `${actorName} updated attendance for ${targetEmployee.fullName} on ${formatDateForAudit(
          attendanceDate
        )}`;
    } else {
      auditMessage =
        `${actorName} marked attendance for ${targetEmployee.fullName} on ${formatDateForAudit(
          attendanceDate
        )}`;
    }

    /*
     * ==========================================================
     * AUDIT LOG
     * ==========================================================
     */

    await prisma.auditLog.create({
      data: {
        employeeId,

        action:
          auditAction,

        entity:
          "Attendance",

        entityId:
          attendance.id,

        metadata: {
          targetEmployeeId:
            targetEmployee.id,

          targetEmployeeName:
            targetEmployee.fullName,

          actorName,

          date,

          oldTimeIn:
            oldTimeIn?.toISOString() ??
            null,

          newTimeIn:
            attendance.checkInTime?.toISOString() ??
            null,

          oldTimeOut:
            oldTimeOut?.toISOString() ??
            null,

          newTimeOut:
            attendance.checkOutTime?.toISOString() ??
            null,

          oldStatus,

          newStatus:
            attendance.status,

          oldReason,

          newReason:
            attendance.reason ??
            null,

          workedMinutes,

          workedDuration,

          requestedEmployeeId:
            requestedEmployeeId ??
            null,

          requestedStatus:
            status ??
            null,

          effectiveStatus,

          isWeeklyOff:
            isDateWeeklyOff,

          dateOffInfo,

          message:
            auditMessage,
        },
      },
    });

    /*
     * ==========================================================
     * RESPONSE
     * ==========================================================
     */

    return NextResponse.json({
      ...attendance,

      effectiveStatus,

      isWeeklyOff:
        isDateWeeklyOff,

      dateOffInfo,

      workedMinutes,

      workedDuration,
    });
  } catch (error) {
    console.error(
      "POST /api/attendance error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to save attendance",

        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}