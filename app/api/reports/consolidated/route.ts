import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 0));
  const daysInMonth = endDate.getUTCDate();

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: "asc" },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      attendances: {
        where: { date: { gte: startDate, lte: endDate } },
        select: { date: true, status: true },
      },
    },
  });

  const statusCode: Record<string, string> = {
    PRESENT: "P",
    ABSENT: "A",
    HALF_DAY: "H",
    ON_LEAVE: "L",
  };

  const rows = employees.map((emp) => {
    const dayMap: Record<number, string> = {};
    emp.attendances.forEach((a) => {
      const day = new Date(a.date).getUTCDate();
      dayMap[day] = statusCode[a.status] ?? "-";
    });

    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(dayMap[d] ?? "-");
    }

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      days,
    };
  });

  return NextResponse.json({ daysInMonth, rows });
}