import { getTodayIndiaDateString } from "@/lib/attendanceAutomation";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    getWeeklyOffConfigForEmployeeType,
    isWeeklyOff,
} from "@/lib/attendanceUtils";
import { isWithinOfficeRadius } from "@/lib/distanceUtils";
import { reverseGeocode } from "@/lib/reverseGeocode";

export async function POST(request: NextRequest) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // ==========================================================
        // GET CLOCK-IN REQUEST BODY
        // ==========================================================
        const body = await request.json();

        console.log("📱 Received body:", body);

        const clientTimestamp = body.timestamp
            ? new Date(body.timestamp)
            : new Date();

        console.log("⏰ Using timestamp:", clientTimestamp);

        // ==========================================================
        // GET LOCATION FROM CLOCK-IN REQUEST
        // ==========================================================
        const latitude =
            typeof body.latitude === "number"
                ? body.latitude
                : Number(body.latitude);

        const longitude =
            typeof body.longitude === "number"
                ? body.longitude
                : Number(body.longitude);

        const hasValidLocation =
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180;

        const locationName = hasValidLocation
            ? await reverseGeocode(latitude, longitude)
            : null;

        const gpsAccuracy =
            body.gpsAccuracy !== undefined &&
                body.gpsAccuracy !== null
                ? Number(body.gpsAccuracy)
                : null;

        const deviceId =
            body.deviceId?.toString() ?? null;

        const isMockLocation =
            body.isMockLocation === true ||
            body.isMockLocation === "true";

        // ==========================================================
        // GET SERVER DATE
        // ==========================================================
        const serverDateString =
            getTodayIndiaDateString();

        const serverDate = new Date(
            `${serverDateString}T00:00:00.000Z`
        );

        // ==========================================================
        // GET EMPLOYEE
        // ==========================================================
        const employee =
            await prisma.employee.findUnique({
                where: {
                    id: session.sub,
                },
                select: {
                    id: true,
                    isActive: true,
                    employeeTypeId: true,
                    officeId: true,
                    office: true,
                    userType: {
                        select: {
                            locationMode: true,
                        },
                    },
                },
            });

        if (!employee) {
            return NextResponse.json(
                {
                    error: "Employee not found",
                },
                { status: 404 }
            );
        }

        if (!employee.isActive) {
            return NextResponse.json(
                {
                    error: "Employee is inactive",
                },
                { status: 400 }
            );
        }

        // ==========================================================
        // OFFICE LOCATION CHECK
        // ==========================================================
        //
        // IMPORTANT:
        //
        // Location is NOT checked during login.
        //
        // Location is checked ONLY when Clock In is pressed.
        //
        // RESTRICTED_100M:
        //   - GPS location is required.
        //   - An assigned office is required.
        //   - Employee must be inside the assigned office radius.
        //
        // UNRESTRICTED:
        //   - No office-radius restriction is applied.
        //   - Clock in can continue normally.
        // ==========================================================

        let officeDistance: number | null = null;
        let officeName: string | null = null;
        let officeRadius: number | null = null;

        if (
            employee.userType?.locationMode ===
            "RESTRICTED_100M"
        ) {
            // ------------------------------------------------------
            // GPS REQUIRED FOR RESTRICTED EMPLOYEES
            // ------------------------------------------------------
            if (!hasValidLocation) {
                return NextResponse.json(
                    {
                        error:
                            "Your current location is required to clock in. Please enable location services and try again.",
                    },
                    { status: 422 }
                );
            }

            // ------------------------------------------------------
            // MOCK LOCATION NOT ALLOWED
            // ------------------------------------------------------
            if (isMockLocation) {
                return NextResponse.json(
                    {
                        error:
                            "Mock or simulated location is not allowed for clock in.",
                    },
                    { status: 422 }
                );
            }

            // ------------------------------------------------------
            // ASSIGNED OFFICE REQUIRED
            // ------------------------------------------------------
            if (
                !employee.officeId ||
                !employee.office
            ) {
                return NextResponse.json(
                    {
                        error:
                            "No office has been assigned to your account. Please contact your administrator.",
                    },
                    { status: 422 }
                );
            }

            // ------------------------------------------------------
            // GET ASSIGNED OFFICE INFORMATION
            // ------------------------------------------------------
            officeName =
                employee.office.name;

            officeRadius =
                employee.office.radiusMeters;

            // ------------------------------------------------------
            // CALCULATE DISTANCE FROM ASSIGNED OFFICE
            // ------------------------------------------------------
            const locationCheck =
                isWithinOfficeRadius(
                    latitude,
                    longitude,
                    {
                        latitude:
                            employee.office.latitude,
                        longitude:
                            employee.office.longitude,
                        name:
                            employee.office.name,
                        radiusMeters:
                            employee.office.radiusMeters,
                    }
                );

            officeDistance =
                locationCheck.distance;

            // ------------------------------------------------------
            // REJECT CLOCK-IN OUTSIDE OFFICE RADIUS
            // ------------------------------------------------------
            if (!locationCheck.isWithin) {
                await prisma.auditLog.create({
                    data: {
                        employeeId: session.sub,
                        action:
                            "ATTENDANCE_CLOCK_IN_OUTSIDE_RADIUS",
                        entity: "Attendance",
                        entityId: null,
                        metadata: {
                            attempt: "CLOCK_IN",
                            result:
                                "REJECTED_OUTSIDE_RADIUS",

                            latitude,
                            longitude,
                            gpsAccuracy,
                            locationName,
                            deviceId,
                            isMockLocation,

                            locationMode:
                                employee.userType?.locationMode,

                            officeId:
                                employee.officeId,

                            officeName:
                                employee.office.name,

                            officeLatitude:
                                employee.office.latitude,

                            officeLongitude:
                                employee.office.longitude,

                            officeRadius:
                                employee.office.radiusMeters,

                            distanceFromOffice:
                                officeDistance,

                            attemptedAt:
                                clientTimestamp,
                        },
                    },
                });

                return NextResponse.json(
                    {
                        error:
                            `You are outside the allowed office area. Please move within ${employee.office.radiusMeters} meters of ${employee.office.name} to clock in.`,

                        outsideOffice: true,

                        office: {
                            id:
                                employee.office.id,

                            name:
                                employee.office.name,

                            latitude:
                                employee.office.latitude,

                            longitude:
                                employee.office.longitude,

                            radiusMeters:
                                employee.office.radiusMeters,
                        },

                        distance:
                            officeDistance,

                        allowedRadius:
                            employee.office.radiusMeters,
                    },
                    { status: 422 }
                );
            }
        }

        // ==========================================================
        // WEEKLY OFF / HOLIDAY CHECK
        // ==========================================================

        /*
         * TEMPORARILY DISABLED:
         *
         * Weekly off and holiday checks are commented out so
         * employees can clock in on weekly offs and holidays.
         *
         * Keep this code commented for now so it can be restored
         * later without changing the original logic.
         */

        /*
        // Weekly off applies normally.
        // Weekly off applies according to the employee type.
        const weeklyOffConfig =
            await getWeeklyOffConfigForEmployeeType(
                employee.employeeTypeId
            );
    
        const isDateWeeklyOff =
            isWeeklyOff(
                serverDate,
                weeklyOffConfig
            );
    
        // Holiday applies only when it is assigned
        // to this employee's employee type.
        const applicableHoliday =
            employee.employeeTypeId
                ? await prisma.holiday.findFirst({
                    where: {
                        date: serverDate,
                        employeeTypeAssignments: {
                            some: {
                                employeeTypeId:
                                    employee.employeeTypeId,
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
    
        if (
            isDateWeeklyOff ||
            applicableHoliday
        ) {
            const reason =
                applicableHoliday
                    ? "holiday"
                    : "weekly off";
    
            const details =
                applicableHoliday
                    ? applicableHoliday.name
                    : "Today is a weekly off";
    
            return NextResponse.json(
                {
                    error:
                        `Cannot check in on ${reason}: ${details}`,
    
                    isOff: true,
    
                    offReason:
                        applicableHoliday
                            ? "HOLIDAY"
                            : "WEEKLY_OFF",
    
                    offDetails: details,
    
                    holiday:
                        applicableHoliday,
                },
                { status: 422 }
            );
        }
        */

        // ==========================================================
        // CHECK IF ALREADY CHECKED IN TODAY
        // ==========================================================
        const existing =
            await prisma.attendance.findUnique({
                where: {
                    employeeId_date: {
                        employeeId: session.sub,
                        date: serverDate,
                    },
                },
            });

        if (existing) {
            return NextResponse.json(
                {
                    error:
                        "Already checked in today",
                },
                { status: 422 }
            );
        }

        // ==========================================================
        // PROTECT APPROVED LEAVE
        // ==========================================================
        //
        // If approved leave exists for today,
        // check-in must not create PRESENT attendance.
        // ==========================================================

        const todayString =
            serverDate
                .toISOString()
                .slice(0, 10);

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
            approvedLeaveApprovals.some(
                (approval) => {
                    const details =
                        approval.details as
                        | {
                            date?: string;
                        }
                        | null;

                    return (
                        details?.date ===
                        todayString
                    );
                }
            );

        if (hasApprovedLeave) {
            return NextResponse.json(
                {
                    error:
                        "Cannot check in because the employee is on approved leave for today.",
                },
                { status: 409 }
            );
        }

        // ==========================================================
        // CREATE CHECK-IN
        // ==========================================================
        const attendance =
            await prisma.attendance.create({
                data: {
                    employeeId: session.sub,
                    date: serverDate,
                    status: "PRESENT",
                    checkInTime:
                        clientTimestamp,
                },
            });

        // ==========================================================
        // AUDIT CHECK-IN
        // ==========================================================
        await prisma.auditLog.create({
            data: {
                employeeId: session.sub,
                action:
                    "ATTENDANCE_LOGGED_IN",
                entity: "Attendance",
                entityId: attendance.id,
                metadata: {
                    date:
                        serverDate
                            .toISOString()
                            .split("T")[0],

                    attendanceTime:
                        attendance.checkInTime
                            ? attendance.checkInTime.toISOString()
                            : null,

                    // Weekly-off/holiday blocking is temporarily
                    // disabled for clock-in.

                    // --------------------------------------------------
                    // CLOCK-IN LOCATION INFORMATION
                    // --------------------------------------------------
                    locationCheckedAtClockIn:
                        true,

                    latitude:
                        hasValidLocation
                            ? latitude
                            : null,

                    longitude:
                        hasValidLocation
                            ? longitude
                            : null,

                    gpsAccuracy,
                    deviceId,
                    isMockLocation,
                    locationName,

                    // --------------------------------------------------
                    // USER TYPE LOCATION MODE
                    // --------------------------------------------------
                    locationMode:
                        employee.userType?.locationMode,

                    // --------------------------------------------------
                    // ASSIGNED OFFICE INFORMATION
                    // --------------------------------------------------
                    officeId:
                        employee.officeId,

                    officeName,
                    officeRadius,
                    officeDistance,
                },
            },
        });

        // ==========================================================
        // SUCCESS RESPONSE
        // ==========================================================
        return NextResponse.json(
            {
                ...attendance,

                message:
                    "Checked in successfully",

                // Location information for client
                locationCheckedAtClockIn:
                    true,

                officeName,
                officeDistance,
                officeRadius,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "POST /api/attendance/check-in error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to check in",

                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            { status: 500 }
        );
    }
}