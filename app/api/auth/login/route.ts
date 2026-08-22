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

  const token = await signToken({ sub: employee.id, role: employee.role });

  const response = NextResponse.json({
    id: employee.id,
    fullName: employee.fullName,
    email: employee.email,
    role: employee.role,
  });

  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours, matches token expiry
    path: "/",
  });

  return response;
}
