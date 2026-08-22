import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const payload = token ? await verifyToken(token) : null;

  if (!payload && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (payload && isLoginPage) {
    return NextResponse.redirect(new URL("/admin/employees", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/login"],
};