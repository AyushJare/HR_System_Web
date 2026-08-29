import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { refreshToken } = body;

    // Revoke refresh token from DB (so it can't be used again)
    if (refreshToken) {
      await prisma.session.deleteMany({
        where: { token: refreshToken },
      });
    }

    const response = NextResponse.json({ success: true });

    // Clear httpOnly cookie on web
    response.cookies.set("session", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}