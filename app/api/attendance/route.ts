import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { toDateOnlyUTC } from "@/lib/dateOnly";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

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

    /*
     * Keep the response shape expected by
     * app/admin/attendance/page.tsx.
     *
     * Prisma:
     *   checkInTime  -> API: timeIn
     *   checkOutTime -> API: timeOut
     */
    const result = employees.map((emp) => {
      const attendance = emp.attendances[0] || null;

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
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();

    const {
      employeeId,
      date,
      timeIn,
      timeOut,
      status,
      reason,
    } = body;

    if (!employeeId || !date) {
      return NextResponse.json(
        {
          error: "employeeId and date are required",
        },
        {
          status: 400,
        }
      );
    }

    const attendanceDate = toDateOnlyUTC(date);

    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: attendanceDate,
        },
      },

      update: {
        checkInTime: timeIn
          ? new Date(`${date}T${timeIn}:00`)
          : undefined,

        checkOutTime: timeOut
          ? new Date(`${date}T${timeOut}:00`)
          : null,

        status: status || "PRESENT",
        reason: reason || null,
        modifiedBy: auth.session.sub,
      },

      create: {
        employeeId,
        date: attendanceDate,

        checkInTime: timeIn
          ? new Date(`${date}T${timeIn}:00`)
          : new Date(),

        checkOutTime: timeOut
          ? new Date(`${date}T${timeOut}:00`)
          : null,

        status: status || "PRESENT",
        reason: reason || null,
        modifiedBy: auth.session.sub,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "ATTENDANCE_MARKED",
        entity: "Attendance",
        entityId: attendance.id,

        metadata: {
          forEmployeeId: employeeId,
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
      {
        status: 500,
      }
    );
  }
}