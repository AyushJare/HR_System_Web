import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { rateLimit } from "@/lib/middleware/rateLimit";
import { logLoginAttempt } from "@/lib/audit";

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
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // GET EMPLOYEE + USER TYPE
    // ---------------------------------------------------------
    // Location is NO LONGER checked during login.
    // Office assignment is still stored on the employee and
    // will be used later when the employee clocks in.
    const employee = await prisma.employee.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        userType: true,
      },
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
      await logLoginAttempt(
        email,
        false,
        employee.id,
        "Invalid password"
      );

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // GET REAL IP FROM SERVER
    // ---------------------------------------------------------
    const forwardedFor = request.headers.get("x-forwarded-for");

    const realIp =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // ---------------------------------------------------------
    // SUCCESSFUL LOGIN AUDIT
    // ---------------------------------------------------------
    // IMPORTANT:
    // No GPS/location check happens here.
    // Location will be checked when Clock In is pressed.
    await prisma.auditLog.create({
      data: {
        employeeId: employee.id,
        action: "LOGIN",
        entity: "Employee",
        entityId: employee.id,
        metadata: {
          ipAddress: realIp,
          locationCheck: "DEFERRED_TO_CLOCK_IN",
          locationMode: employee.userType?.locationMode ?? null,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // ---------------------------------------------------------
    // CREATE TOKENS
    // ---------------------------------------------------------
    const accessToken = await signToken(
      {
        sub: employee.id,
        role: employee.role,
        type: "access",
      },
      "1h"
    );

    const refreshToken = await signToken(
      {
        sub: employee.id,
        role: employee.role,
        type: "refresh",
      },
      "7d"
    );

    // ---------------------------------------------------------
    // SESSION
    // ---------------------------------------------------------
    await prisma.session.create({
      data: {
        token: refreshToken,
        employeeId: employee.id,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      },
    });

    // ---------------------------------------------------------
    // LOGIN SUCCESS LOG
    // ---------------------------------------------------------
    await logLoginAttempt(
      email,
      true,
      employee.id,
      "Login successful. Location check deferred to clock-in."
    );

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
      locationCheck: "CLOCK_IN",
    });

    // ---------------------------------------------------------
    // COOKIES
    // ---------------------------------------------------------
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
      `Error: ${error instanceof Error ? error.message : "Unknown"
      }`
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}