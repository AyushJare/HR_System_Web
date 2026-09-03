import { prisma } from "@/lib/prisma";
import {
    checkIfDateIsOff,
} from "@/lib/attendanceUtils";
import { toDateOnlyUTC } from "@/lib/dateOnly";

const INDIA_TIME_ZONE = "Asia/Kolkata";

const FULL_DAY_MINUTES = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;

/**
 * Returns today's date in India as YYYY-MM-DD.
 */
export function getTodayIndiaDateString(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: INDIA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

/**
 * Returns yesterday's date in India as YYYY-MM-DD.
 */
export function getPreviousIndiaDateString(): string {
    const today = getTodayIndiaDateString();

    const [year, month, day] =
        today.split("-").map(Number);

    const previousDate = new Date(
        Date.UTC(year, month - 1, day - 1)
    );

    return previousDate
        .toISOString()
        .split("T")[0];
}

/**
 * Converts an India-local date + time into a Date.
 *
 * Example:
 * 2026-09-01 + 08:00
 * -> 2026-09-01T08:00:00+05:30
 */
export function parseIndiaDateTime(
    date: string,
    time: string
): Date {
    return new Date(
        `${date}T${time}:00+05:30`
    );
}

/**
 * Formats worked minutes as a human-readable duration.
 *
 * Examples:
 * 65  -> "1h 5m"
 * 120 -> "2h"
 * 480 -> "8h"
 */
export function formatWorkedDuration(
    durationMinutes: number
): string {
    const roundedMinutes =
        Math.max(
            0,
            Math.floor(durationMinutes)
        );

    const hours =
        Math.floor(
            roundedMinutes / 60
        );

    const minutes =
        roundedMinutes % 60;

    if (hours === 0) {
        return `${minutes}m`;
    }

    if (minutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
}

/**
 * Calculates attendance status from check-in/check-out.
 *
 * >= 8 hours = PRESENT
 * >= 4 hours and < 8 hours = HALF_DAY
 * < 4 hours = WORKED
 */
export function calculateAttendanceStatus(
    timeIn: Date,
    timeOut: Date
): "PRESENT" | "HALF_DAY" | "WORKED" {
    const durationMinutes =
        (timeOut.getTime() - timeIn.getTime()) /
        (1000 * 60);

    if (
        durationMinutes >=
        FULL_DAY_MINUTES
    ) {
        return "PRESENT";
    }

    if (
        durationMinutes >=
        HALF_DAY_MINUTES
    ) {
        return "HALF_DAY";
    }

    return "WORKED";
}

/**
 * Calculates the actual worked duration
 * between check-in and check-out.
 */
export function calculateWorkedMinutes(
    timeIn: Date,
    timeOut: Date
): number {
    return Math.max(
        0,
        Math.floor(
            (
                timeOut.getTime() -
                timeIn.getTime()
            ) /
            (1000 * 60)
        )
    );
}

/**
 * Finalizes attendance for one completed date.
 *
 * Rules:
 *
 * Weekly off / holiday
 *     -> do nothing
 *
 * Open attendance without checkout
 *     -> automatically checkout at 11:59:59.999 PM
 *     -> reason: "User didn't check out"
 *
 * Approved leave
 *     -> ON_LEAVE
 *
 * Existing attendance
 *     -> preserve it
 *
 * No attendance
 *     -> ABSENT
 */
export async function finalizeAttendanceForDate(
    dateString: string
) {
    const date = toDateOnlyUTC(dateString);

    /*
     * Do not create attendance on holidays / weekly offs.
     */
    const dateOffInfo =
        await checkIfDateIsOff(date);

    if (dateOffInfo.isOff) {
        return {
            date: dateString,
            skipped: true,
            reason: "WEEKLY_OFF_OR_HOLIDAY",
            absentCreated: 0,
            leaveCreated: 0,
        };
    }

    /*
     * Find all active employees.
     *
     * createdAt prevents employees from being marked
     * absent for dates before they joined the system.
     */
    const endOfAttendanceDate = new Date(
        `${dateString}T23:59:59.999+05:30`
    );

    const employees =
        await prisma.employee.findMany({
            where: {
                isActive: true,
                createdAt: {
                    lte: endOfAttendanceDate,
                },
            },

            select: {
                id: true,
                fullName: true,
            },
        });

    /*
     * Fetch approved leaves for this date once.
     *
     * This is much more efficient than querying
     * approvals separately for every employee.
     */
    const approvedLeaves =
        await prisma.approval.findMany({
            where: {
                type: "LEAVE",
                status: "APPROVED",
            },

            select: {
                id: true,
                actorId: true,
                details: true,
            },
        });

    const employeesOnLeave =
        new Set<string>();

    for (const approval of approvedLeaves) {
        if (!approval.actorId) {
            continue;
        }

        const details =
            approval.details as
            | {
                date?: string;
            }
            | null;

        if (details?.date === dateString) {
            employeesOnLeave.add(
                approval.actorId
            );
        }
    }

    let absentCreated = 0;
    let leaveCreated = 0;

    for (const employee of employees) {
        /*
         * Check whether attendance already exists.
         */
        const existing =
            await prisma.attendance.findUnique({
                where: {
                    employeeId_date: {
                        employeeId: employee.id,
                        date,
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
         * Existing attendance always wins.
         *
         * This prevents the automation from replacing
         * an employee's legitimate attendance.
         */
        if (existing && !existing.deletedAt) {
            /*
             * If the employee checked in but did not
             * check out, automatically close the
             * attendance at the end of that day.
             *
             * The checkout is stored as 11:59:59.999 PM
             * of the attendance date so the record remains
             * associated with the correct date.
             */
            if (
                existing.checkInTime &&
                !existing.checkOutTime &&
                existing.status !== "ON_LEAVE" &&
                existing.status !== "ABSENT" &&
                existing.status !== "WEEKLY_OFF"
            ) {
                const automaticCheckOut =
                    new Date(
                        `${dateString}T23:59:59.999+05:30`
                    );

                const calculatedStatus =
                    calculateAttendanceStatus(
                        existing.checkInTime,
                        automaticCheckOut
                    );

                await prisma.attendance.update({
                    where: {
                        id: existing.id,
                    },

                    data: {
                        checkOutTime:
                            automaticCheckOut,

                        status:
                            calculatedStatus,

                        reason:
                            "User didn't check out",

                        modifiedBy:
                            employee.id,

                        deletedAt: null,
                    },
                });

                /*
                 * Do not continue with the normal
                 * ABSENT / ON_LEAVE finalization logic
                 * for this attendance record.
                 */
                continue;
            }

            /*
             * If the employee was marked ABSENT but has approved leave,
             * convert the existing attendance to ON_LEAVE.
             */
            if (
                employeesOnLeave.has(employee.id) &&
                existing.status === "ABSENT"
            ) {
                await prisma.attendance.update({
                    where: { id: existing.id },
                    data: {
                        status: "ON_LEAVE",
                        reason: "Approved leave",
                        modifiedBy: employee.id,
                    },
                });

                leaveCreated++;
            }

            continue;
        }

        /*
         * Approved leave.
         */
        if (
            employeesOnLeave.has(employee.id)
        ) {
            await prisma.attendance.upsert({
                where: {
                    employeeId_date: {
                        employeeId: employee.id,
                        date,
                    },
                },

                update: {
                    status: "ON_LEAVE",
                    reason: "Approved leave",
                    modifiedBy: employee.id,
                    deletedAt: null,
                },

                create: {
                    employeeId: employee.id,
                    date,

                    /*
                     * Attendance requires checkInTime.
                     * Midnight is used for leave records.
                     */
                    checkInTime: new Date(
                        `${dateString}T00:00:00+05:30`
                    ),

                    checkOutTime: null,
                    status: "ON_LEAVE",
                    reason: "Approved leave",
                    modifiedBy: employee.id,
                },
            });

            leaveCreated++;
            continue;
        }

        /*
         * No attendance and no approved leave.
         *
         * Therefore this employee was absent.
         */
        await prisma.attendance.upsert({
            where: {
                employeeId_date: {
                    employeeId: employee.id,
                    date,
                },
            },

            update: {
                status: "ABSENT",
                reason: "No attendance recorded",
                modifiedBy: employee.id,
                deletedAt: null,
            },

            create: {
                employeeId: employee.id,
                date,

                checkInTime: new Date(
                    `${dateString}T00:00:00+05:30`
                ),

                checkOutTime: null,
                status: "ABSENT",
                reason: "No attendance recorded",
                modifiedBy: employee.id,
            },
        });

        absentCreated++;
    }

    return {
        date: dateString,
        skipped: false,
        absentCreated,
        leaveCreated,
    };
}