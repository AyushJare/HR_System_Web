import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findUnique({ where: { email } });

  if (!employee || !employee.isActive) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const isValid = await verifyPassword(password, employee.passwordHash);

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  // Create short-lived access token (1 hour)
  const accessToken = await signToken(
    { sub: employee.id, role: employee.role, type: "access" },
    "1h"
  );

  // Create long-lived refresh token (7 days)
  const refreshToken = await signToken(
    { sub: employee.id, role: employee.role, type: "refresh" },
    "7d"
  );

  // Store refresh token in DB (so we can revoke it later)
  await prisma.session.create({
    data: {
      token: refreshToken,
      employeeId: employee.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  const response = NextResponse.json({
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1 hour in seconds
    user: {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      role: employee.role,
    },
  });

  // Web still gets httpOnly cookie (so browser auto-sends it)
  response.cookies.set("session", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour, matches access token
    path: "/",
  });

  return response;
}