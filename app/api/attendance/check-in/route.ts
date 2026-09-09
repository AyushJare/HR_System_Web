import { validateAttendanceCheckIn } from "@/lib/validators/attendance";
import { getTodayIndiaDateString } from "@/lib/attendanceAutomation";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeeklyOffSettings, isWeeklyOff } from "@/lib/attendanceUtils";

export async function POST(request: NextRequest) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ← ADD THESE 2 LINES:
        const body = await request.json();
        console.log('📱 Received body:', body);  // ← ADD THIS LINE
        const clientTimestamp = body.timestamp ? new Date(body.timestamp) : new Date();
        console.log('⏰ Using timestamp:', clientTimestamp);  // ← ADD THIS TOO

        const serverDateString = getTodayIndiaDateString();
        const serverDate = new Date(`${serverDateString}T00:00:00.000Z`);

        // Check the logged-in employee's employee type before applying holiday rules.
        const employee = await prisma.employee.findUnique({
            where: {
                id: session.sub,
            },
            select: {
                id: true,
                isActive: true,
                employeeTypeId: true,
            },
        });

        if (!employee) {
            return NextResponse.json(
                { error: "Employee not found" },
                { status: 404 }
            );
        }

        if (!employee.isActive) {
            return NextResponse.json(
                { error: "Employee is inactive" },
                { status: 400 }
            );
        }

        // Weekly off applies normally.
        const weeklyOffConfig = await getWeeklyOffSettings();
        const isDateWeeklyOff = isWeeklyOff(serverDate, weeklyOffConfig);

        // Holiday applies only when it is assigned to this employee's employee type.
        const applicableHoliday = employee.employeeTypeId
            ? await prisma.holiday.findFirst({
                where: {
                    date: serverDate,
                    employeeTypeAssignments: {
                        some: {
                            employeeTypeId: employee.employeeTypeId,
                        },
                    },
                },
                select: {
                    id: true,
                    name: true,
                    date: true,
                },
            })
            : null;

        if (isDateWeeklyOff || applicableHoliday) {
            const reason = applicableHoliday ? "holiday" : "weekly off";
            const details = applicableHoliday
                ? applicableHoliday.name
                : "Today is a weekly off";

            return NextResponse.json(
                {
                    error: `Cannot check in on ${reason}: ${details}`,
                    isOff: true,
                    offReason: applicableHoliday ? "HOLIDAY" : "WEEKLY_OFF",
                    offDetails: details,
                    holiday: applicableHoliday,
                },
                { status: 422 }
            );
        }

        // Check if already checked in today
        const existing = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: session.sub,
                    date: serverDate,
                },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: "Already checked in today" },
                { status: 422 }
            );
        }

        // ==========================================================
        // PROTECT APPROVED LEAVE
        // ==========================================================
        // If approved leave exists for today, check-in must not
        // create PRESENT attendance.
        const todayString = serverDate.toISOString().slice(0, 10);

        const approvedLeaveApprovals =
            await prisma.approval.findMany({
                where: {
                    type: "LEAVE",
                    status: "APPROVED",
                    actorId: session.sub,
                },
                select: {
                    details: true,
                },
            });

        const hasApprovedLeave =
            approvedLeaveApprovals.some((approval) => {
                const details = approval.details as
                    | { date?: string }
                    | null;

                return details?.date === todayString;
            });

        if (hasApprovedLeave) {
            return NextResponse.json(
                {
                    error:
                        "Cannot check in because the employee is on approved leave for today.",
                },
                { status: 409 }
            );
        }

        // Create check-in
        const attendance = await prisma.attendance.create({
            data: {
                employeeId: session.sub,
                date: serverDate,
                status: "PRESENT",
                checkInTime: clientTimestamp,
            },
        });

        // Log check-in with weekly off info
        await prisma.auditLog.create({
            data: {
                employeeId: session.sub,
                action: "ATTENDANCE_LOGGED_IN",
                entity: "Attendance",
                entityId: attendance.id,
                metadata: {
                    date: serverDate.toISOString().split("T")[0],
                    isWeeklyOff: isDateWeeklyOff,
                    attendanceTime: attendance.checkInTime,
                },
            },
        });

        return NextResponse.json(
            {
                ...attendance,
                isWeeklyOff: isDateWeeklyOff,
                message: "Checked in successfully",
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/attendance/check-in error:", error);
        return NextResponse.json(
            {
                error: "Failed to check in",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}