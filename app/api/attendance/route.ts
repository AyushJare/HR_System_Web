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

    // ADMIN always has access.
    // Other users need Attendance -> View.
    if (session.role !== "ADMIN") {
      const allowed = await checkPermission(
        employeeId,
        "Attendance",
        "view"
      );

      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to view Attendance" },
          { status: 403 }
        );
      }
    }

    const dateParam = request.nextUrl.searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { error: "date is required" },
        { status: 400 }
      );
    }

    const date = toDateOnlyUTC(dateParam);

    // ✅ NEW: Get weekly off settings for this date
    const weeklyOffConfig = await getWeeklyOffSettings();

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },

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

    // ✅ NEW: Check if the date itself is a weekly off or holiday
    const dateOffInfo = await checkIfDateIsOff(date);

    const result = employees.map((emp) => {
      const attendance = emp.attendances[0] ?? null;

      // ✅ NEW: Determine if this date is a weekly off day
      const isDateWeeklyOff = isWeeklyOff(date, weeklyOffConfig);

      // ✅ NEW: If it's a weekly off day, the effective status should be WEEKLY_OFF
      const effectiveStatus =
        isDateWeeklyOff && attendance?.status === "ABSENT"
          ? "WEEKLY_OFF"
          : attendance?.status;

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,

        attendance: attendance
          ? {
            id: attendance.id,
            timeIn: attendance.checkInTime,
            timeOut: attendance.checkOutTime,
            status: attendance.status,
            effectiveStatus, // ✅ NEW: Show effective status
            isWeeklyOff: isDateWeeklyOff, // ✅ NEW: Flag if weekly off
            reason: attendance.reason,
          }
          : null,

        // ✅ NEW: Add info about the date itself
        dateInfo: dateOffInfo,
      };
    });

    return NextResponse.json({
      date: date.toISOString().split("T")[0],
      dateOffInfo, // ✅ NEW: Include date off info in response
      employees: result,
      count: result.length,
    });
  } catch (error) {
    console.error("GET /api/attendance error:", error);

    return NextResponse.json(
      {
        error: "Failed to load attendance",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const employeeId = session.sub;

    /*
     * Saving attendance is a modifying action.
     *
     * ADMIN -> automatically allowed
     * Other users -> need Attendance edit OR add permission
     */
    if (session.role !== "ADMIN") {
      const canEdit = await checkPermission(
        employeeId,
        "Attendance",
        "edit"
      );

      const canAdd = await checkPermission(
        employeeId,
        "Attendance",
        "add"
      );

      if (!canEdit && !canAdd) {
        return NextResponse.json(
          { error: "You don't have permission to modify Attendance" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    const {
      employeeId: targetEmployeeId,
      date,
      timeIn,
      timeOut,
      status,
      reason,
    } = body;

    if (!targetEmployeeId || !date) {
      return NextResponse.json(
        {
          error: "employeeId and date are required",
        },
        { status: 400 }
      );
    }

    const attendanceDate = toDateOnlyUTC(date);

    // ✅ NEW: Check if this date is a weekly off day
    const weeklyOffConfig = await getWeeklyOffSettings();
    const isDateWeeklyOff = isWeeklyOff(attendanceDate, weeklyOffConfig);

    // ✅ NEW: Check if date is off (weekly off or holiday)
    const dateOffInfo = await checkIfDateIsOff(attendanceDate);

    // ✅ NEW: Warn if marking attendance on weekly off day
    // (allow it, but log it)
    if (isDateWeeklyOff && status !== "WEEKLY_OFF") {
      console.warn(
        `[ATTENDANCE] Marking attendance on weekly off day for employee ${targetEmployeeId} on ${date}`
      );
    }

    // ✅ NEW: Determine effective status
    // If it's a weekly off day and status is ABSENT, mark as WEEKLY_OFF
    const effectiveStatus =
      isDateWeeklyOff && status === "ABSENT" ? "WEEKLY_OFF" : status;

    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: targetEmployeeId,
          date: attendanceDate,
        },
      },

      update: {
        ...(timeIn
          ? {
            checkInTime: new Date(`${date}T${timeIn}:00`),
          }
          : {}),

        ...(timeOut
          ? {
            checkOutTime: new Date(`${date}T${timeOut}:00`),
          }
          : {
            checkOutTime: null,
          }),

        status: effectiveStatus || "PRESENT", // ✅ UPDATED: Use effective status
        reason: reason || null,
        modifiedBy: employeeId,
      },

      create: {
        employeeId: targetEmployeeId,
        date: attendanceDate,

        checkInTime: timeIn
          ? new Date(`${date}T${timeIn}:00`)
          : new Date(),

        checkOutTime: timeOut
          ? new Date(`${date}T${timeOut}:00`)
          : null,

        status: effectiveStatus || "PRESENT", // ✅ UPDATED: Use effective status
        reason: reason || null,
        modifiedBy: employeeId,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId,
        action: "ATTENDANCE_MARKED",
        entity: "Attendance",
        entityId: attendance.id,

        metadata: {
          forEmployeeId: targetEmployeeId,
          date,
          requestedStatus: status,
          effectiveStatus, // ✅ NEW: Log effective status
          isWeeklyOff: isDateWeeklyOff, // ✅ NEW: Log if weekly off
          dateOffInfo, // ✅ NEW: Log date off info
        },
      },
    });

    return NextResponse.json({
      ...attendance,
      effectiveStatus, // ✅ NEW: Return effective status
      isWeeklyOff: isDateWeeklyOff, // ✅ NEW: Return weekly off flag
      dateOffInfo, // ✅ NEW: Return date off info
    });
  } catch (error) {
    console.error("POST /api/attendance error:", error);

    return NextResponse.json(
      {
        error: "Failed to save attendance",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}