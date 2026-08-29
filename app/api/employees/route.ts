import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

import { validateEmail } from "@/lib/validators/email";
import { validatePassword } from "@/lib/validators/password";
import { validatePhoneNumber } from "@/lib/validators/phone";

export async function GET() {
  try {
    // Any authenticated user can reach this endpoint,
    // but they must have Employee -> View permission.
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const hasPermission = await checkPermission(
      session.sub,
      "Employee List",
      "view"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You do not have permission to view employees" },
        { status: 403 }
      );
    }

    const employees = await prisma.employee.findMany({
      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,

        department: {
          select: {
            name: true,
          },
        },

        designation: {
          select: {
            name: true,
          },
        },

        createdAt: true,
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Get employees error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Employee creation is controlled by Employee -> Add permission.
    // ADMIN automatically passes checkPermission().
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const hasPermission = await checkPermission(
      session.sub,
      "Employee List",
      "add"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You do not have permission to add employees" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      fullName,
      email,
      password,
      mobile,
      gender,
      departmentId,
      designationId,
      employeeTypeId,
      userTypeId,
      role,
    } = body;

    // Required fields
    if (!fullName || !email || !password) {
      return NextResponse.json(
        {
          error: "fullName, email, and password are required",
        },
        { status: 400 }
      );
    }

    // Employee must have a User Type.
    if (role !== "ADMIN" && !userTypeId) {
      return NextResponse.json(
        {
          error: "User Type is required for employees",
        },
        { status: 400 }
      );
    }

    // Email validation
    const emailValidation = validateEmail(email);

    if (!emailValidation.valid) {
      return NextResponse.json(
        {
          error: "Wrong email format",
          errors: emailValidation.error,
        },
        { status: 422 }
      );
    }

    // Password validation
    const passwordValidation = validatePassword(password);

    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: "Password requirements not met",
          errors: passwordValidation.errors,
        },
        { status: 422 }
      );
    }

    // Phone validation
    if (mobile) {
      const phoneValidation = validatePhoneNumber(mobile);

      if (!phoneValidation.valid) {
        return NextResponse.json(
          {
            error: "Enter a correct phone number",
            errors: phoneValidation.error,
          },
          { status: 422 }
        );
      }
    }

    // Duplicate email
    const existing = await prisma.employee.findUnique({
      where: {
        email,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "An employee with this email already exists",
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const employee = await prisma.employee.create({
      data: {
        fullName,
        email,
        passwordHash,

        mobile: mobile || null,
        gender: gender || null,

        departmentId: departmentId || null,
        designationId: designationId || null,
        employeeTypeId: employeeTypeId || null,
        userTypeId: userTypeId || null,

        role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",

        createdById: session.sub,
      },

      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        employeeId: session.sub,
        action: "EMPLOYEE_CREATED",
        entity: "Employee",
        entityId: employee.id,
      },
    });

    return NextResponse.json(employee, {
      status: 201,
    });
  } catch (error) {
    console.error("Create employee error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}