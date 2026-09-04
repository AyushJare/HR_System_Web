import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkIfDateIsOff } from "@/lib/attendanceUtils";

export async function POST(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = await request.json();

        const {
            type,
            fromDate,
            toDate,
            reason,
            leaveTypeId,
        } = body ?? {};

        if (
            !type ||
            !fromDate ||
            !toDate ||
            !leaveTypeId
        ) {
            return NextResponse.json(
                {
                    error:
                        "type, fromDate, toDate and leaveTypeId are required",
                },
                { status: 400 },
            );
        }

        const start = new Date(`${fromDate}T00:00:00.000Z`);
        const end = new Date(`${toDate}T00:00:00.000Z`);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime())
        ) {
            return NextResponse.json(
                { error: "Invalid leave dates" },
                { status: 400 },
            );
        }

        if (start > end) {
            return NextResponse.json(
                {
                    error:
                        "Start date cannot be after end date",
                },
                { status: 400 },
            );
        }

        // Validate every date in the requested range.
        for (
            let current = new Date(start);
            current <= end;
            current.setUTCDate(current.getUTCDate() + 1)
        ) {
            const dateString =
                current.toISOString().split("T")[0];

            const leaveDate = new Date(
                `${dateString}T00:00:00.000Z`,
            );

            const dateOffInfo =
                await checkIfDateIsOff(leaveDate);

            if (dateOffInfo.isOff) {
                return NextResponse.json(
                    {
                        error: `Leave cannot be applied for ${dateString} because it is a ${dateOffInfo.reason}.`,
                    },
                    { status: 409 },
                );
            }

            const attendance =
                await prisma.attendance.findUnique({
                    where: {
                        employeeId_date: {
                            employeeId: session.sub,
                            date: leaveDate,
                        },
                    },
                });

            if (
                attendance?.checkInTime ||
                attendance?.checkOutTime
            ) {
                return NextResponse.json(
                    {
                        error: `Leave cannot be applied for ${dateString} because attendance already exists.`,
                    },
                    { status: 409 },
                );
            }

            const existing =
                await prisma.approval.findFirst({
                    where: {
                        type: "LEAVE",
                        actorId: session.sub,
                        status: {
                            in: ["PENDING", "APPROVED"],
                        },
                        details: {
                            path: ["date"],
                            equals: dateString,
                        },
                    },
                });

            if (existing) {
                return NextResponse.json(
                    {
                        error: `Leave has already been applied for ${dateString}.`,
                    },
                    { status: 409 },
                );
            }
        }

        // Create ONE approval for the entire date range.
        const approval = await prisma.approval.create({
            data: {
                type: "LEAVE",
                actorId: session.sub,
                refId: null,
                status: "PENDING",
                details: {
                    fromDate,
                    toDate,
                    reason: reason ?? null,
                    leaveTypeId,
                },
            },
        });

        await prisma.auditLog.create({
            data: {
                employeeId: session.sub,
                action: "LEAVE_REQUESTED",
                entity: "Approval",
                entityId: approval.id,
                metadata: {
                    fromDate,
                    toDate,
                    reason: reason ?? null,
                    leaveTypeId,
                },
            },
        });

        return NextResponse.json(
            {
                success: true,
                message:
                    "Leave request submitted successfully",
                request: approval,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error(
            "Leave submission error:",
            error,
        );

        return NextResponse.json(
            {
                error: "Failed to submit leave request",
            },
            { status: 500 },
        );
    }
}