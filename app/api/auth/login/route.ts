import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { rateLimit } from "@/lib/middleware/rateLimit";
import { logLoginAttempt } from "@/lib/audit";

const checkRateLimit = rateLimit(30, 60000);

export async function POST(request: NextRequest) {
  try {
    // 1️⃣ Rate limiting
    const limitCheck = await checkRateLimit(request);
    if (limitCheck.status !== 200) {
      return limitCheck;
    }

    // 2️⃣ Parse request
    const body = await request.json();
    const { email, password } = body;

    // 3️⃣ Validate
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 4️⃣ Find employee
    const employee = await prisma.employee.findUnique({
      where: { email },
    });

    // 5️⃣ Check if exists and active
    if (!employee || !employee.isActive) {
      await logLoginAttempt(email, false, undefined, "User not found or inactive");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 6️⃣ Verify password
    const isValid = await verifyPassword(password, employee.passwordHash);

    if (!isValid) {
      await logLoginAttempt(email, false, employee.id, "Invalid password");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 7️⃣ Create tokens
    const accessToken = await signToken(
      { sub: employee.id, role: employee.role, type: "access" },
      "1h"
    );

    const refreshToken = await signToken(
      { sub: employee.id, role: employee.role, type: "refresh" },
      "7d"
    );

    // 8️⃣ Store session
    await prisma.session.create({
      data: {
        token: refreshToken,
        employeeId: employee.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // 9️⃣ Log success
    await logLoginAttempt(email, true, employee.id);

    // 🔟 Create response
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
    });

    // Set cookies
    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    response.cookies.set("session", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    await logLoginAttempt("unknown", false, undefined, `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}