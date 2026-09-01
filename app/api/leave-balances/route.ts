import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getOrCreateLeaveBalance } from "@/lib/leaveBalance";

export async function GET(request: NextRequest) {

  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (session.role !== "ADMIN") {
    const allowed =
      (await checkPermission(session.sub, "Approvals", "view")) ||
      (await checkPermission(session.sub, "Approvals", "add")) ||
      (await checkPermission(session.sub, "Approvals", "edit"));

    if (!allowed) {
      return NextResponse.json(
        { error: "You don't have permission to view leave balances" },
        { status: 403 }
      );
    }
  }

  const { searchParams } = new URL(request.url);

  const employeeId = searchParams.get("employeeId");

  const year =
    searchParams.get("year") ||
    String(new Date().getFullYear());

  if (!employeeId) {
    return NextResponse.json(
      { error: "employeeId is required" },
      { status: 400 }
    );
  }

  const leaveTypes = await prisma.leaveType.findMany();

  const balances = await Promise.all(
    leaveTypes.map((lt) =>
      getOrCreateLeaveBalance(
        employeeId,
        lt.id,
        Number(year)
      )
    )
  );

  const result = leaveTypes.map((lt, i) => ({
    leaveTypeId: lt.id,
    name: lt.name,
    code: lt.code,
    allocated: balances[i].allocated,
    used: balances[i].used,
    remaining:
      balances[i].allocated -
      balances[i].used,
  }));

  return NextResponse.json(result);
}