import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PUT(request: NextRequest) {
    const auth = await requireAdmin();

    if (!auth.ok) {
        return NextResponse.json(
            { error: auth.error },
            { status: auth.status }
        );
    }

    try {
        const body = await request.json();

        const {
            ids,
            name,
            description,
            startDate,
            endDate,
        } = body;

        // ---------------------------------------------------------
        // VALIDATION
        // ---------------------------------------------------------

        if (
            !Array.isArray(ids) ||
            ids.length === 0 ||
            typeof name !== "string" ||
            !name.trim() ||
            !startDate ||
            !endDate
        ) {
            return NextResponse.json(
                {
                    error:
                        "Group IDs, name, start date and end date are required",
                },
                { status: 400 }
            );
        }

        if (startDate > endDate) {
            return NextResponse.json(
                {
                    error: "Start date cannot be after end date",
                },
                { status: 400 }
            );
        }

        // ---------------------------------------------------------
        // GENERATE NEW DATE RANGE
        // ---------------------------------------------------------

        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T00:00:00.000Z`);

        const dates: string[] = [];

        const current = new Date(start);

        while (current <= end) {
            dates.push(current.toISOString().split("T")[0]);

            current.setUTCDate(current.getUTCDate() + 1);
        }

        // ---------------------------------------------------------
        // LOAD ORIGINAL GROUP
        // ---------------------------------------------------------

        const existingGroup = await prisma.holiday.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            orderBy: {
                date: "asc",
            },
        });

        if (existingGroup.length !== ids.length) {
            return NextResponse.json(
                {
                    error: "One or more holidays in this group no longer exist",
                },
                { status: 404 }
            );
        }

        // ---------------------------------------------------------
        // CHECK FOR CONFLICTS OUTSIDE THIS GROUP
        //
        // Example:
        //
        // Existing:
        // Ganesh Chaturthi - Sep 11
        // Ganesh Chaturthi - Sep 12
        //
        // Trying to move Sep 11 -> Sep 12 should be rejected
        // instead of partially updating the group.
        // ---------------------------------------------------------

        const conflictingHolidays =
            await prisma.holiday.findMany({
                where: {
                    name: name.trim(),
                    date: {
                        gte: start,
                        lte: end,
                    },
                    id: {
                        notIn: ids,
                    },
                },
                select: {
                    id: true,
                    name: true,
                    date: true,
                },
            });

        if (conflictingHolidays.length > 0) {
            const conflictDates = conflictingHolidays
                .map((holiday) =>
                    holiday.date.toISOString().split("T")[0]
                )
                .join(", ");

            return NextResponse.json(
                {
                    error: `Cannot update holiday group because these dates already contain "${name.trim()}": ${conflictDates}`,
                },
                { status: 409 }
            );
        }

        // ---------------------------------------------------------
        // UPDATE EVERYTHING IN ONE TRANSACTION
        // ---------------------------------------------------------

        const updatedHolidays = await prisma.$transaction(
            async (tx) => {
                /*
                 * IMPORTANT:
                 *
                 * We cannot directly change:
                 *
                 * Sep 11 -> Sep 12
                 * Sep 12 -> Sep 13
                 *
                 * because Sep 12 already exists temporarily.
                 *
                 * So first move all existing records to unique
                 * temporary dates far away from the real range.
                 */

                for (let i = 0; i < existingGroup.length; i++) {
                    const holiday = existingGroup[i];

                    await tx.holiday.update({
                        where: {
                            id: holiday.id,
                        },
                        data: {
                            date: new Date(
                                `2099-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`
                            ),
                        },
                    });
                }

                const results = [];

                const existingCount = Math.min(
                    existingGroup.length,
                    dates.length
                );

                // -------------------------------------------------------
                // UPDATE EXISTING RECORDS
                // -------------------------------------------------------

                for (let i = 0; i < existingCount; i++) {
                    const holiday = existingGroup[i];

                    const updated = await tx.holiday.update({
                        where: {
                            id: holiday.id,
                        },
                        data: {
                            name: name.trim(),
                            description:
                                typeof description === "string" &&
                                    description.trim()
                                    ? description.trim()
                                    : null,
                            date: new Date(
                                `${dates[i]}T00:00:00.000Z`
                            ),
                        },
                    });

                    results.push(updated);
                }

                // -------------------------------------------------------
                // DELETE EXTRA OLD RECORDS
                // -------------------------------------------------------

                if (existingGroup.length > dates.length) {
                    for (
                        let i = dates.length;
                        i < existingGroup.length;
                        i++
                    ) {
                        await tx.holiday.delete({
                            where: {
                                id: existingGroup[i].id,
                            },
                        });
                    }
                }

                // -------------------------------------------------------
                // CREATE NEW RECORDS
                // -------------------------------------------------------

                if (dates.length > existingGroup.length) {
                    for (
                        let i = existingGroup.length;
                        i < dates.length;
                        i++
                    ) {
                        const created = await tx.holiday.create({
                            data: {
                                name: name.trim(),
                                description:
                                    typeof description === "string" &&
                                        description.trim()
                                        ? description.trim()
                                        : null,
                                date: new Date(
                                    `${dates[i]}T00:00:00.000Z`
                                ),
                            },
                        });

                        results.push(created);
                    }
                }

                return results;
            }
        );

        // ---------------------------------------------------------
        // AUDIT LOG
        // ---------------------------------------------------------

        await prisma.auditLog.create({
            data: {
                employeeId: auth.session.sub,
                action: "HOLIDAY_GROUP_UPDATED",
                entity: "Holiday",
                entityId: ids[0],
                metadata: {
                    holidayIds: ids,
                    name: name.trim(),
                    description:
                        typeof description === "string" &&
                            description.trim()
                            ? description.trim()
                            : null,
                    startDate,
                    endDate,
                    updatedCount: updatedHolidays.length,
                },
            },
        });

        return NextResponse.json({
            success: true,
            holidays: updatedHolidays,
        });
    } catch (error) {
        console.error("Holiday group update error:", error);

        return NextResponse.json(
            {
                error: "Failed to update holiday group",
            },
            { status: 500 }
        );
    }
}