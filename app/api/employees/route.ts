import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

// Email is optional when creating an employee.
// import { validateEmail } from "@/lib/validators/email";

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

        office: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            radiusMeters: true,
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
      officeId,
      role,
    } = body;

    // Email is NOT required.
    if (!fullName || !password || !mobile) {
      return NextResponse.json(
        {
          error: "fullName, phone number and password are required",
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

    // =====================================================
    // EMAIL VALIDATION
    // =====================================================

    /*
    // Email is optional.
    // If an email is provided, the existing email validation
    // can be used to verify its format.

    if (email && email.trim()) {
      const emailValidation = validateEmail(email.trim());

      if (!emailValidation.valid) {
        return NextResponse.json(
          {
            error: "Wrong email format",
            errors: emailValidation.error,
          },
          { status: 422 }
        );
      }
    }
    */

    // =====================================================
    // PASSWORD VALIDATION DISABLED
    // =====================================================

    /*
    // Password policy validation has been disabled.

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
    */

    // Phone validation
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

    // =====================================================
    // DUPLICATE EMAIL CHECK
    // =====================================================

    // Only check for duplicate email when an email was provided.
    if (email && email.trim()) {
      const existingEmail = await prisma.employee.findFirst({
        where: {
          email: {
            equals: email.trim(),
            mode: "insensitive",
          },
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          {
            error: "An employee with this email already exists",
          },
          { status: 409 }
        );
      }
    }

    // =====================================================
    // DUPLICATE PHONE NUMBER CHECK
    // =====================================================

    // mobile is required (checked above), so this always runs.
    const normalizedMobile = mobile.trim();

    const existingMobile = await prisma.employee.findFirst({
      where: {
        mobile: normalizedMobile,
      },
    });

    if (existingMobile) {
      return NextResponse.json(
        {
          error: "An employee with this phone number already exists",
        },
        { status: 409 }
      );
    }

    // =====================================================
    // DUPLICATE FULL NAME CHECK
    // =====================================================

    // fullName is required (checked above), so this always runs.
    // Case-insensitive: "John Doe" and "john doe" are treated as
    // the same name so the check can't be bypassed by casing.
    const normalizedFullName = fullName.trim();

    const existingFullName = await prisma.employee.findFirst({
      where: {
        fullName: {
          equals: normalizedFullName,
          mode: "insensitive",
        },
      },
    });

    if (existingFullName) {
      return NextResponse.json(
        {
          error: "An employee with this name already exists",
        },
        { status: 409 }
      );
    }

    // Password is still securely hashed before being stored.
    const passwordHash = await hashPassword(password);

    const employee = await prisma.employee.create({
      data: {
        fullName: normalizedFullName,

        // Email is optional.
        // Empty email is stored as null.
        email:
          email && email.trim()
            ? email.trim()
            : null,

        passwordHash,

        mobile: normalizedMobile,
        gender: gender || null,

        departmentId: departmentId || null,
        designationId: designationId || null,
        employeeTypeId: employeeTypeId || null,
        userTypeId: userTypeId || null,
        officeId: officeId || null,

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

        office: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            radiusMeters: true,
          },
        },
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
    // Safety net for a race condition: two concurrent requests can both
    // pass the DUPLICATE EMAIL CHECK above before either has committed,
    // so the database's own unique constraint is what actually catches
    // it. Same pattern as app/api/holidays/[id]/route.ts.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "An employee with this email already exists" },
        { status: 409 }
      );
    }

    console.error("Create employee error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}