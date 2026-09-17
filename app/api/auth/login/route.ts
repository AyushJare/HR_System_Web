import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { rateLimit } from "@/lib/middleware/rateLimit";
import { logLoginAttempt } from "@/lib/audit";

type EmployeeWithUserType = Prisma.EmployeeGetPayload<{
  include: { userType: true };
}>;

const checkRateLimit = rateLimit(30, 60000);

// A generic, unchanging message for every "this credential is wrong" case.
// It intentionally does not distinguish "no such account", "wrong password",
// or "this phone number matches more than one account" - anything more
// specific would tell an attacker which part of their guess was correct.
const INVALID_CREDENTIALS_RESPONSE = NextResponse.json(
  { error: "Invalid credentials" },
  { status: 401 }
);

type LoginIdentifier =
  | { type: "email"; value: string }
  | { type: "mobile"; candidates: string[] }
  | { type: "invalid" };

/**
 * Build every representation of a 10-digit mobile number that may be
 * present in the database.
 *
 * `mobile` has never been written consistently across the app: the Add
 * and Edit employee forms store the raw digits (e.g. "9876543210"), while
 * bulk upload stores the dash-formatted version (e.g. "98765-43210"). A
 * login lookup has to check both, or employees created through one path
 * would be unable to sign in with the phone number they were told to use.
 */
function buildMobileCandidates(digitsOnly: string): string[] {
  const formatted = `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`;
  return [digitsOnly, formatted];
}

/**
 * Decide whether the submitted login identifier is an email address or a
 * phone number, without touching the database.
 *
 * An "@" is treated as unambiguously email. Otherwise the value is
 * stripped to digits and accepted only if it matches a valid Indian
 * mobile number (10 digits, starting 6-9) - the same rule enforced when
 * the number was first saved. Anything else is rejected before it ever
 * reaches a query.
 */
function resolveLoginIdentifier(raw: string): LoginIdentifier {
  const trimmed = raw.trim();

  if (trimmed.includes("@")) {
    return { type: "email", value: trimmed.toLowerCase() };
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return { type: "mobile", candidates: buildMobileCandidates(digitsOnly) };
  }

  return { type: "invalid" };
}

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
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email or phone number, and password, are required" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // RESOLVE IDENTIFIER
    // ---------------------------------------------------------
    // This only inspects the shape of the input - no database access yet.
    const resolvedIdentifier = resolveLoginIdentifier(String(identifier));

    if (resolvedIdentifier.type === "invalid") {
      return NextResponse.json(
        { error: "Enter a valid email address or 10-digit phone number" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // GET EMPLOYEE + USER TYPE
    // ---------------------------------------------------------
    // Location is NO LONGER checked during login.
    // Office assignment is still stored on the employee and
    // will be used later when the employee clocks in.
    let employee: EmployeeWithUserType | null = null;

    if (resolvedIdentifier.type === "email") {
      // `email` has a unique constraint, so at most one row can ever match.
      employee = await prisma.employee.findUnique({
        where: { email: resolvedIdentifier.value },
        include: { userType: true },
      });
    } else {
      // `mobile` has NO unique constraint at the database level - only
      // application-level checks discourage duplicates on write. A login
      // lookup must not silently trust that no duplicate exists.
      const matches = await prisma.employee.findMany({
        where: {
          mobile: { in: resolvedIdentifier.candidates },
          isActive: true,
        },
        include: { userType: true },
      });

      if (matches.length > 1) {
        // Data integrity problem, not a normal failed login: two active
        // employees share a phone number, so this attempt can't be
        // resolved to a single account. Fail closed exactly like a wrong
        // password would, but log it distinctly so an admin can find and
        // fix the duplicate - this should never happen in normal use.
        console.error(
          `Login blocked: ${matches.length} active employees share mobile number ${resolvedIdentifier.candidates[0]}`
        );

        await logLoginAttempt(
          String(identifier),
          false,
          undefined,
          "Multiple active accounts share this phone number"
        );

        return INVALID_CREDENTIALS_RESPONSE;
      }

      employee = matches[0] ?? null;
    }

    if (!employee || !employee.isActive) {
      await logLoginAttempt(
        String(identifier),
        false,
        undefined,
        "User not found or inactive"
      );

      return INVALID_CREDENTIALS_RESPONSE;
    }

    // ---------------------------------------------------------
    // PASSWORD
    // ---------------------------------------------------------
    const isValid = await verifyPassword(password, employee.passwordHash);

    if (!isValid) {
      await logLoginAttempt(
        String(identifier),
        false,
        employee.id,
        "Invalid password"
      );

      return INVALID_CREDENTIALS_RESPONSE;
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
      String(identifier),
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