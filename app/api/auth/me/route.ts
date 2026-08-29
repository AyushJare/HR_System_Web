import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const employee = await prisma.employee.findUnique({
    where: { id: session.sub },
    include: { userType: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      role: employee.role,
      employeeCode: employee.employeeCode,
      userType: employee.userType?.name,
      permissions: employee.userType?.permissions,
    }
  });
}