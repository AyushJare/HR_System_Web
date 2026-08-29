import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { toDateOnlyUTC } from "@/lib/dateOnly";

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

    const result = employees.map((emp) => {
      const attendance = emp.attendances[0] ?? null;

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
            reason: attendance.reason,
          }
          : null,
      };
    });

    return NextResponse.json(result);
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

        status: status || "PRESENT",
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

        status: status || "PRESENT",
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
          status: status || "PRESENT",
        },
      },
    });

    return NextResponse.json(attendance);
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