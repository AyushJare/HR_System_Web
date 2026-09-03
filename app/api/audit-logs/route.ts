import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermissionOrAdmin(
      "Audit Log",
      "view"
    );

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const requestedLimit = Number(
      request.nextUrl.searchParams.get("limit") ?? 100
    );

    const limit = Math.min(
      Number.isFinite(requestedLimit)
        ? Math.max(requestedLimit, 1)
        : 100,
      500
    );

    const logs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },

      take: limit,

      include: {
        employee: {
          select: {
            fullName: true,
            employeeCode: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);

    return NextResponse.json(
      {
        error: "Failed to load audit logs",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}