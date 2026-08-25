import { validateAttendanceCheckIn, getTodayDate } from "@/lib/validators/attendance";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
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

    // Create check-in
    const attendance = await prisma.attendance.create({
        data: {
            employeeId: session.sub,
            date: serverDate,
            status: "PRESENT",
        },
    });

    return NextResponse.json(attendance, { status: 201 });
}