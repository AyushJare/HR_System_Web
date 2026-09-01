import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { rateLimit } from "@/lib/middleware/rateLimit";
import { logLoginAttempt } from "@/lib/audit";
import {
  isWithinOfficeRadius,
  LOCATION_RADIUS_METERS,
  OFFICE_LOCATION,
} from "@/lib/distanceUtils";

const checkRateLimit = rateLimit(30, 60000);

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // RATE LIMIT
    // ---------------------------------------------------------
    const limitCheck = await checkRateLimit(request);
    if (limitCheck.status !== 200) {
      return limitCheck;
    }

    // ---------------------------------------------------------
    // REQUEST BODY
    // ---------------------------------------------------------
    const body = await request.json();
    const {
      email,
      password,
      latitude,
      longitude,
      gpsAccuracy,
      deviceId,
      isMockLocation,
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // GET EMPLOYEE + USER TYPE
    // ---------------------------------------------------------
    const employee = await prisma.employee.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { userType: true },
    });

    if (!employee || !employee.isActive) {
      await logLoginAttempt(
        email,
        false,
        undefined,
        "User not found or inactive"
      );
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // PASSWORD
    // ---------------------------------------------------------
    const isValid = await verifyPassword(password, employee.passwordHash);
    if (!isValid) {
      await logLoginAttempt(email, false, employee.id, "Invalid password");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // LOCATION PARSING
    // ---------------------------------------------------------
    const lat =
      latitude !== undefined && latitude !== null && latitude !== ""
        ? Number(latitude)
        : undefined;

    const lon =
      longitude !== undefined && longitude !== null && longitude !== ""
        ? Number(longitude)
        : undefined;

    const accuracy =
      gpsAccuracy !== undefined && gpsAccuracy !== null && gpsAccuracy !== ""
        ? Number(gpsAccuracy)
        : undefined;

    const isMock = isMockLocation === true || isMockLocation === "true";

    // ---------------------------------------------------------
    // GET REAL IP FROM SERVER
    // ---------------------------------------------------------
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // ---------------------------------------------------------
    // VALIDATE NUMERIC LOCATION VALUES
    // ---------------------------------------------------------
    const hasValidCoordinates =
      lat !== undefined &&
      lon !== undefined &&
      Number.isFinite(lat) &&
      Number.isFinite(lon);

    const hasValidAccuracy =
      accuracy !== undefined && Number.isFinite(accuracy);

    console.log("=================================");
    console.log("LOCATION CHECK");
    console.log("Employee:", employee.fullName);
    console.log("UserType:", employee.userType?.locationMode);
    console.log("Latitude:", lat);
    console.log("Longitude:", lon);
    console.log("Accuracy:", accuracy);
    console.log("Mock:", isMock);
    console.log("IP:", realIp);
    console.log("=================================");

    // ---------------------------------------------------------
    // LOCATION VARIABLES
    // ---------------------------------------------------------
    let distanceFromOffice: number | null = null;
    let requiresApproval = false;
    let allowLogin = true;
    let locationCheckMessage = "";

    // ---------------------------------------------------------
    // CALCULATE DISTANCE WHEN LOCATION EXISTS
    // ---------------------------------------------------------
    if (hasValidCoordinates) {
      const locationResult = isWithinOfficeRadius(lat!, lon!);
      distanceFromOffice = locationResult.distance;
      console.log("Distance from office:", distanceFromOffice, "meters");
      console.log("Within radius:", locationResult.isWithin);
    }

    // ---------------------------------------------------------
    // TYPE 1: RESTRICTED_100M
    // ---------------------------------------------------------
    if (employee.userType?.locationMode === "RESTRICTED_100M") {
      console.log("RESTRICTED_100M mode detected");

      // -----------------------------------------------------
      // LOCATION REQUIRED
      // -----------------------------------------------------
      if (!hasValidCoordinates) {
        await prisma.auditLog.create({
          data: {
            employeeId: employee.id,
            action: "LOGIN_LOCATION_REJECTED",
            entity: "Employee",
            entityId: employee.id,
            metadata: {
              reason: "LOCATION_REQUIRED",
              latitude: lat ?? null,
              longitude: lon ?? null,
              gpsAccuracy: hasValidAccuracy ? accuracy : null,
              deviceId: deviceId ?? null,
              ipAddress: realIp,
              isMockLocation: isMock,
              distanceFromOffice: null,
              locationMode: employee.userType?.locationMode,
              loginAllowed: false,
              requiresApproval: false,
              timestamp: new Date().toISOString(),
            },
          },
        });
        await logLoginAttempt(email, false, employee.id, "Location required");
        return NextResponse.json(
          { error: "Location permission is required for login." },
          { status: 403 }
        );
      }

      // -----------------------------------------------------
      // MOCK LOCATION
      // -----------------------------------------------------
      if (isMock) {
        await prisma.auditLog.create({
          data: {
            employeeId: employee.id,
            action: "LOGIN_LOCATION_REJECTED",
            entity: "Employee",
            entityId: employee.id,
            metadata: {
              reason: "MOCK_LOCATION",
              latitude: lat,
              longitude: lon,
              gpsAccuracy: hasValidAccuracy ? accuracy : null,
              deviceId: deviceId ?? null,
              ipAddress: realIp,
              isMockLocation: true,
              distanceFromOffice,
              officeLatitude: OFFICE_LOCATION.latitude,
              officeLongitude: OFFICE_LOCATION.longitude,
              locationMode: employee.userType?.locationMode,
              loginAllowed: false,
              requiresApproval: false,
              timestamp: new Date().toISOString(),
            },
          },
        });
        await logLoginAttempt(
          email,
          false,
          employee.id,
          "Mock location detected"
        );
        return NextResponse.json(
          { error: "Mock location detected. Login denied." },
          { status: 403 }
        );
      }

      // -----------------------------------------------------
      // WITHIN / OUTSIDE 100 METERS
      // -----------------------------------------------------
      const locationResult = isWithinOfficeRadius(lat!, lon!);
      distanceFromOffice = locationResult.distance;

      if (!locationResult.isWithin) {
        console.log("OUTSIDE OFFICE RADIUS");

        // ---------------------------------------------------
        // STICKY APPROVAL CHECK (grace window)
        // ---------------------------------------------------
        const GRACE_WINDOW_MINUTES = 30;
        const graceStart = new Date(
          Date.now() - GRACE_WINDOW_MINUTES * 60 * 1000
        );

        const stickyApproval = await prisma.approval.findFirst({
          where: {
            type: "LOCATION_BASED_LOGIN",
            refId: employee.id,
            status: "APPROVED",
            updatedAt: { gte: graceStart },
          },
          orderBy: { updatedAt: "desc" },
        });

        if (stickyApproval) {
          // Login allowed within grace window
          console.log("STICKY APPROVAL used, login allowed");

          locationCheckMessage =
            `Location approved by admin. You are ${distanceFromOffice}m from the office. ` +
            `Grace window: ${GRACE_WINDOW_MINUTES} min.`;

          await prisma.auditLog.create({
            data: {
              employeeId: employee.id,
              action: "LOGIN_LOCATION_GRACE_APPROVED",
              entity: "Approval",
              entityId: stickyApproval.id,
              metadata: {
                latitude: lat,
                longitude: lon,
                distanceFromOffice,
                gpsAccuracy: hasValidAccuracy ? accuracy : null,
                deviceId: deviceId ?? null,
                ipAddress: realIp,
                approvalId: stickyApproval.id,
                approvedAt: stickyApproval.updatedAt.toISOString(),
                graceWindowMinutes: GRACE_WINDOW_MINUTES,
                loginAllowed: true,
                timestamp: new Date().toISOString(),
              },
            },
          });
          // Flow falls through to the normal successful-login path.
        } else {
          // No recent approval → block and create new pending request
          requiresApproval = true;
          allowLogin = false;

          locationCheckMessage =
            `You are ${distanceFromOffice}m from the office. ` +
            `The allowed radius is ${LOCATION_RADIUS_METERS}m. ` +
            `Manager approval is required.`;

          // Avoid stacking duplicate PENDING rows for the same employee
          const existingPending = await prisma.approval.findFirst({
            where: {
              type: "LOCATION_BASED_LOGIN",
              refId: employee.id,
              status: "PENDING",
            },
          });

          if (!existingPending) {
            await prisma.approval.create({
              data: {
                type: "LOCATION_BASED_LOGIN",
                refId: employee.id,
                details: {
                  employeeId: employee.id,
                  employeeName: employee.fullName,
                  latitude: lat,
                  longitude: lon,
                  gpsAccuracy: hasValidAccuracy ? accuracy : null,
                  deviceId: deviceId ?? null,
                  ipAddress: realIp,
                  isMockLocation: false,
                  distanceFromOffice,
                  allowedRadius: LOCATION_RADIUS_METERS,
                  officeLatitude: OFFICE_LOCATION.latitude,
                  officeLongitude: OFFICE_LOCATION.longitude,
                  locationMode: employee.userType?.locationMode,
                  timestamp: new Date().toISOString(),
                },
                status: "PENDING",
                actorId: employee.id,
              },
            });
          }

          await prisma.auditLog.create({
            data: {
              employeeId: employee.id,
              action: "LOGIN_LOCATION_APPROVAL_REQUIRED",
              entity: "Employee",
              entityId: employee.id,
              metadata: {
                reason: "OUTSIDE_ALLOWED_RADIUS",
                latitude: lat,
                longitude: lon,
                gpsAccuracy: hasValidAccuracy ? accuracy : null,
                deviceId: deviceId ?? null,
                ipAddress: realIp,
                isMockLocation: false,
                distanceFromOffice,
                allowedRadius: LOCATION_RADIUS_METERS,
                officeLatitude: OFFICE_LOCATION.latitude,
                officeLongitude: OFFICE_LOCATION.longitude,
                locationMode: employee.userType?.locationMode,
                loginAllowed: false,
                requiresApproval: true,
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
      } else {
        // ---------------------------------------------------
        // WITHIN 100 METERS
        // ---------------------------------------------------
        locationCheckMessage = `Location verified. You are ${distanceFromOffice}m from the office.`;
        console.log("WITHIN OFFICE RADIUS");
      }
    }
    // ---------------------------------------------------------
    // TYPE 2: UNRESTRICTED
    // ---------------------------------------------------------
    else if (employee.userType?.locationMode === "UNRESTRICTED") {
      console.log("UNRESTRICTED mode detected");
      if (hasValidCoordinates) {
        locationCheckMessage = `Location recorded. You are ${distanceFromOffice}m from the office.`;
      } else {
        locationCheckMessage = "Login allowed. Location was not available.";
      }
    }
    // ---------------------------------------------------------
    // USER WITHOUT USER TYPE
    // ---------------------------------------------------------
    else {
      console.log("No valid UserType/locationMode found");
      locationCheckMessage =
        "Login allowed. No location restriction configured.";
    }

    // ---------------------------------------------------------
    // REJECT BEFORE ATTENDANCE / TOKEN CREATION
    // ---------------------------------------------------------
    if (!allowLogin && requiresApproval) {
      await logLoginAttempt(email, false, employee.id, locationCheckMessage);

      return NextResponse.json(
        {
          error: "Approval required",
          message: locationCheckMessage,
          requiresApproval: true,
          distance: distanceFromOffice,
          allowedRadius: LOCATION_RADIUS_METERS,
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------------
    // ATTENDANCE
    // ---------------------------------------------------------
    if (hasValidCoordinates) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingAttendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: { employeeId: employee.id, date: today },
        },
      });

      if (!existingAttendance) {
        await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: today,
            latitude: lat,
            longitude: lon,
            gpsAccuracy: hasValidAccuracy ? accuracy : null,
            deviceId: deviceId ?? "unknown",
            ipAddress: realIp,
            isMockLocation: isMock,
            distanceFromOffice,
            status: "PRESENT",
          },
        });
      }
    }

    // ---------------------------------------------------------
    // SUCCESSFUL LOGIN AUDIT
    // ---------------------------------------------------------
    await prisma.auditLog.create({
      data: {
        employeeId: employee.id,
        action: "LOGIN_WITH_LOCATION",
        entity: "Employee",
        entityId: employee.id,
        metadata: {
          latitude: hasValidCoordinates ? lat : null,
          longitude: hasValidCoordinates ? lon : null,
          gpsAccuracy: hasValidAccuracy ? accuracy : null,
          deviceId: deviceId ?? null,
          ipAddress: realIp,
          isMockLocation: isMock,
          distanceFromOffice,
          allowedRadius: LOCATION_RADIUS_METERS,
          officeLatitude: OFFICE_LOCATION.latitude,
          officeLongitude: OFFICE_LOCATION.longitude,
          locationMode: employee.userType?.locationMode ?? null,
          requiresApproval: false,
          loginAllowed: true,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // ---------------------------------------------------------
    // CREATE TOKENS
    // ---------------------------------------------------------
    const accessToken = await signToken(
      { sub: employee.id, role: employee.role, type: "access" },
      "1h"
    );

    const refreshToken = await signToken(
      { sub: employee.id, role: employee.role, type: "refresh" },
      "7d"
    );

    // ---------------------------------------------------------
    // SESSION
    // ---------------------------------------------------------
    await prisma.session.create({
      data: {
        token: refreshToken,
        employeeId: employee.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // ---------------------------------------------------------
    // LOGIN SUCCESS LOG
    // ---------------------------------------------------------
    await logLoginAttempt(email, true, employee.id, locationCheckMessage);

    // ---------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------
    const response = NextResponse.json({
      success: true,
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role,
      },
      ...(locationCheckMessage && { locationInfo: locationCheckMessage }),
      location: {
        latitude: hasValidCoordinates ? lat : null,
        longitude: hasValidCoordinates ? lon : null,
        gpsAccuracy: hasValidAccuracy ? accuracy : null,
        distanceFromOffice,
        locationMode: employee.userType?.locationMode ?? null,
      },
    });

    // ---------------------------------------------------------
    // COOKIES
    // ---------------------------------------------------------
    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 60 * 60,
      path: "/",
    });

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    response.cookies.set("session", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    await logLoginAttempt(
      "unknown",
      false,
      undefined,
      `Error: ${error instanceof Error ? error.message : "Unknown"}`
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}