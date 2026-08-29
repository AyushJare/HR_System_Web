import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requirePermissionOrAdmin("Attendance Summary Report", "view");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // format: "2026-08"

  if (!month) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 0));

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: "asc" },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      department: { select: { name: true } },
      attendances: {
        where: { date: { gte: startDate, lte: endDate } },
        select: { status: true },
      },
    },
  });

  const summary = employees.map((emp) => {
    const counts = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, ON_LEAVE: 0 };
    emp.attendances.forEach((a) => {
      if (
        a.status === "PRESENT" ||
        a.status === "ABSENT" ||
        a.status === "HALF_DAY" ||
        a.status === "ON_LEAVE"
      ) {
        counts[a.status] += 1;
      }
    });
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      department: emp.department?.name ?? "-",
      present: counts.PRESENT,
      absent: counts.ABSENT,
      halfDay: counts.HALF_DAY,
      onLeave: counts.ON_LEAVE,
      totalMarked: emp.attendances.length,
    };
  });

  return NextResponse.json(summary);
}