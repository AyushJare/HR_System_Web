import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requirePermissionOrAdmin("Audit Log", "view");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 100),
    500
  );

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
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
}