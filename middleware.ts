import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security Headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Content-Security-Policy", "default-src 'self'");

  // CORS
  if (process.env.NODE_ENV === "production") {
    const origin = request.headers.get("origin");
    if (origin === process.env.NEXTAUTH_URL) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};