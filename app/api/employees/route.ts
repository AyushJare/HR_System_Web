import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth";
import { validateEmail } from "@/lib/validators/email";
import { validatePassword } from "@/lib/validators/password";
import { validatePhoneNumber } from "@/lib/validators/phone";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
      isActive: true,
      department: { select: { name: true } },
      designation: { select: { name: true } },
    },
  });

  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { fullName, email, password, mobile, gender, departmentId, designationId, employeeTypeId, role } = body;

  // ADD VALIDATION:
  const emailValidation = validateEmail(body.email);
  if (!emailValidation.valid) {
    return NextResponse.json(
      { error: "Wrong email fommat", errors: emailValidation.error },
      { status: 422 }
    );
  }
  
  const passwordValidation = validatePassword(body.password);
  if (!passwordValidation.valid) {
    return NextResponse.json(
      { error: "Password requirements not met", errors: passwordValidation.errors },
      { status: 422 }
    );
  }
  
  if (body.phone) {
    const phoneValidation = validatePhoneNumber(body.phone);
    if (!phoneValidation.valid) {
      return NextResponse.json(
        { error: "Enter a correct phone number", errors: phoneValidation.error },
        { status: 422 }
      );
    }
    body.phone = phoneValidation.formatted;
  }

  if (!fullName || !email || !password) {
    return NextResponse.json(
      { error: "fullName, email, and password are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An employee with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  const employee = await prisma.employee.create({
    data: {
      fullName,
      email,
      passwordHash,
      mobile,
      gender,
      departmentId: departmentId || null,
      designationId: designationId || null,
      employeeTypeId: employeeTypeId || null,
      role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
      createdById: auth.session.sub,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "EMPLOYEE_CREATED",
      entity: "Employee",
      entityId: employee.id,
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
