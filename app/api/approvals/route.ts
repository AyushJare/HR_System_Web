import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";
import { checkIfDateIsOff } from "@/lib/attendanceUtils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermissionOrAdmin("Approvals", "view");

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // Optional filters
    const type = request.nextUrl.searchParams.get("type");
    const status = request.nextUrl.searchParams.get("status");

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    const approvals = await prisma.approval.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    return NextResponse.json(approvals);
  } catch (error) {
    console.error("GET /api/approvals error:", error);

    return NextResponse.json(
      { error: "Failed to load approvals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermissionOrAdmin("Approvals", "edit");

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();

    const { type, actorId, refId, details } = body ?? {};

    if (!type || !details) {
      return NextResponse.json(
        { error: "type and details are required" },
        { status: 400 }
      );
    }

    // Supported approval request types
    if (
      type !== "LEAVE" &&
      type !== "ATTENDANCE_CORRECTION" &&
      type !== "LOCATION_BASED_LOGIN"
    ) {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Use provided actorId, otherwise current authenticated user
    const approvalActorId = actorId || auth.session.sub;

    // Prevent leave requests if attendance has already been completed
    if (type === "LEAVE") {
      const leaveDate = details?.date;

      if (!leaveDate) {
        return NextResponse.json(
          { error: "Leave date is required" },
          { status: 400 }
        );
      }

      const attendanceDate = new Date(
        `${leaveDate}T00:00:00.000Z`
      );

      /*
       * Prevent leave requests on weekly offs and holidays.
       */
      const dateOffInfo =
        await checkIfDateIsOff(attendanceDate);

      if (dateOffInfo.isOff) {
        return NextResponse.json(
          {
            error:
              dateOffInfo.reason === "HOLIDAY"
                ? "Leave cannot be applied on a holiday."
                : "Leave cannot be applied on a weekly off.",
          },
          { status: 409 }
        );
      }

      const attendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: approvalActorId,
            date: attendanceDate,
          },
        },
        select: {
          id: true,
          status: true,
          checkInTime: true,
          checkOutTime: true,
          deletedAt: true,
        },
      });

      if (
        attendance &&
        !attendance.deletedAt &&
        attendance.checkInTime &&
        attendance.status !== "ABSENT"
      ) {
        return NextResponse.json(
          {
            error:
              "Leave request cannot be submitted because attendance has already been recorded for this date.",
          },
          { status: 409 }
        );
      }

      // Prevent multiple active leave applications for the same day
      const existingLeave = await prisma.approval.findFirst({
        where: {
          type: "LEAVE",
          actorId: approvalActorId,
          status: {
            in: ["PENDING", "APPROVED"],
          },
          details: {
            path: ["date"],
            equals: leaveDate,
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingLeave) {
        return NextResponse.json(
          {
            error:
              "A leave application already exists for this employee on this date.",
          },
          { status: 409 }
        );
      }
    }

    const approval = await prisma.approval.create({
      data: {
        type,
        refId: refId || null,
        actorId: approvalActorId,
        status: "PENDING",
        details,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "APPROVAL_REQUESTED",
        entity: "Approval",
        entityId: approval.id,
        metadata: {
          type,
          actorId: approvalActorId,
          refId: refId || null,
        },
      },
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    console.error("POST /api/approvals error:", error);

    return NextResponse.json(
      { error: "Failed to create approval" },
      { status: 500 }
    );
  }
}