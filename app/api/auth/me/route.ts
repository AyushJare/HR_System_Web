import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  // ---------------------------------------------------------
  // Authenticate using:
  //
  // 1. session cookie (web)
  // 2. Authorization: Bearer <accessToken> (Flutter/mobile)
  // ---------------------------------------------------------
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      {
        error: "Not authenticated",
      },
      {
        status: 401,
      }
    );
  }

  // ---------------------------------------------------------
  // Find the employee represented by the JWT `sub`
  // ---------------------------------------------------------
  const employee = await prisma.employee.findUnique({
    where: {
      id: session.sub,
    },
    include: {
      userType: true,
    },
  });

  if (!employee) {
    return NextResponse.json(
      {
        error: "Not found",
      },
      {
        status: 404,
      }
    );
  }

  // ---------------------------------------------------------
  // Return authenticated user information
  // ---------------------------------------------------------
  return NextResponse.json({
    success: true,
    data: {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      role: employee.role,
      employeeCode: employee.employeeCode,
      userType: employee.userType?.name ?? null,
      permissions: employee.userType?.permissions ?? null,
    },
  });
}