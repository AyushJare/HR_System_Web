import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, verifyToken } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token required" },
        { status: 400 }
      );
    }

    // Verify the refresh token signature
    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== "refresh") {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // Check if refresh token still exists in DB (not revoked)
    const session = await prisma.session.findUnique({
      where: { token: refreshToken },
      include: { employee: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Refresh token not found or revoked" },
        { status: 401 }
      );
    }

    // Check if refresh token has expired
    if (session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Refresh token expired" },
        { status: 401 }
      );
    }

    // Check if employee is still active
    if (!session.employee.isActive) {
      return NextResponse.json(
        { error: "Employee account is inactive" },
        { status: 401 }
      );
    }

    // Issue new access token (1 hour)
    const newAccessToken = await signToken(
      {
        sub: session.employee.id,
        role: session.employee.role,
        type: "access",
      },
      "1h"
    );

    const response = NextResponse.json({
      accessToken: newAccessToken,
      expiresIn: 3600, // 1 hour in seconds
    });

    // Update web cookie with new access token
    response.cookies.set("session", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}