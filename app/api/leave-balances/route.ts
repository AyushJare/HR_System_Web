import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getOrCreateLeaveBalance } from "@/lib/leaveBalance";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const year = searchParams.get("year") || String(new Date().getFullYear());

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const leaveTypes = await prisma.leaveType.findMany();

  const balances = await Promise.all(
    leaveTypes.map((lt) => getOrCreateLeaveBalance(employeeId, lt.id, Number(year)))
  );

  const result = leaveTypes.map((lt, i) => ({
    leaveTypeId: lt.id,
    name: lt.name,
    code: lt.code,
    allocated: balances[i].allocated,
    used: balances[i].used,
    remaining: balances[i].allocated - balances[i].used,
  }));

  return NextResponse.json(result);
}