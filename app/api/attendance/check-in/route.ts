import { validateAttendanceCheckIn, getTodayDate } from "@/lib/validators/attendance";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeeklyOffSettings, isWeeklyOff, checkIfDateIsOff } from "@/lib/attendanceUtils";

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // CRITICAL: Always use server date, never trust client
        const serverDate = getTodayDate();

        // Validate date
        const validation = validateAttendanceCheckIn(serverDate);
        if (!validation.allowed) {
            return NextResponse.json(
                { error: validation.reason },
                { status: 422 }
            );
        }

        // ✅ NEW: Check if today is a weekly off day or holiday
        const dateOffInfo = await checkIfDateIsOff(serverDate);

        if (dateOffInfo.isOff) {
            return NextResponse.json(
                {
                    error: `Cannot check in on ${dateOffInfo.reason?.toLowerCase() || "off"}: ${dateOffInfo.details}`, isOff: true,
                    offReason: dateOffInfo.reason,
                    offDetails: dateOffInfo.details,
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

        // ✅ NEW: Load weekly off settings for metadata
        const weeklyOffConfig = await getWeeklyOffSettings();
        const isDateWeeklyOff = isWeeklyOff(serverDate, weeklyOffConfig);

        // Create check-in
        const attendance = await prisma.attendance.create({
            data: {
                employeeId: session.sub,
                date: serverDate,
                status: "PRESENT",
                checkInTime: new Date(),
            },
        });

        // ✅ NEW: Log check-in with weekly off info
        await prisma.auditLog.create({
            data: {
                employeeId: session.sub,
                action: "CHECK_IN",
                entity: "Attendance",
                entityId: attendance.id,
                metadata: {
                    date: serverDate.toISOString().split("T")[0],
                    isWeeklyOff: isDateWeeklyOff,
                    checkInTime: attendance.checkInTime,
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