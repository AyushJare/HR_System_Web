import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validatePhoneNumber } from "@/lib/validators/phone";

type Params = {
  id: string;
};

type EmployeePermissionAction = "view" | "edit" | "delete";

async function requireEmployeePermission(
  moduleName: string,
  action: EmployeePermissionAction
) {
  const session = await getSession();

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  // Main Admin always has full access.
  if (session.role === "ADMIN") {
    return {
      ok: true as const,
      session,
    };
  }

  const allowed = await checkPermission(
    session.sub,
    moduleName,
    action
  );

  if (!allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: `You don't have permission to ${action} ${moduleName}`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;

    const auth = await requireEmployeePermission(
      "Employee Details",
      "view"
    );

    if (!auth.ok) {
      return auth.response;
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        mobile: true,
        gender: true,
        isActive: true,
        role: true,

        // Added direct IDs for Edit Employee page
        departmentId: true,
        designationId: true,
        employeeTypeId: true,
        userTypeId: true,
        officeId: true,

        department: {
          select: {
            id: true,
            name: true,
          },
        },

        designation: {
          select: {
            id: true,
            name: true,
          },
        },

        employeeType: {
          select: {
            id: true,
            name: true,
          },
        },

        // Added User Type relation
        userType: {
          select: {
            id: true,
            name: true,
            description: true,
            isSystem: true,
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

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("GET /api/employees/[id] error:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;

    const auth = await requireEmployeePermission(
      "Employee Details",
      "edit"
    );

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();

    const {
      fullName,
      email,
      password,
      mobile,
      gender,
      isActive,
      departmentId,
      designationId,
      employeeTypeId,
      userTypeId,
      officeId,
      role,
    } = body;

    // =====================================================
    // EMAIL IS OPTIONAL
    // =====================================================

    /*
    // Email is optional.
    // If an email is supplied, it can still be validated
    // for correct format.

    if (
      email !== undefined &&
      email !== null &&
      email.trim() !== ""
    ) {
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
    // DUPLICATE EMAIL CHECK
    // =====================================================

    // Only check duplicate email when a non-empty email is provided.
    if (
      email !== undefined &&
      email !== null &&
      email.trim() !== ""
    ) {
      const existingEmail = await prisma.employee.findFirst({
        where: {
          email: {
            equals: email.trim(),
            mode: "insensitive",
          },
          NOT: {
            id,
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
    // PHONE VALIDATION - REQUIRED
    // =====================================================

    if (
      mobile === undefined ||
      mobile === null ||
      String(mobile).trim() === ""
    ) {
      return NextResponse.json(
        {
          error: "Phone number is required",
        },
        { status: 422 }
      );
    }

    const phoneValidation = validatePhoneNumber(
      String(mobile).trim()
    );

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
    // DUPLICATE PHONE NUMBER CHECK
    // =====================================================

    const existingMobile = await prisma.employee.findFirst({
      where: {
        mobile: String(mobile).trim(),
        NOT: {
          id,
        },
      },
    });

    if (existingMobile) {
      return NextResponse.json(
        {
          error:
            "An employee with this phone number already exists",
        },
        { status: 409 }
      );
    }

    // =====================================================
    // DUPLICATE FULL NAME CHECK
    // =====================================================

    // Only runs when a non-empty fullName is submitted, mirroring
    // the mobile guard above — Edit sends fullName only when it
    // was actually changed.
    if (
      fullName !== undefined &&
      fullName !== null &&
      fullName.trim() !== ""
    ) {
      const existingFullName = await prisma.employee.findFirst({
        where: {
          fullName: {
            equals: fullName.trim(),
            mode: "insensitive",
          },
          NOT: {
            id,
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
    }

    // =====================================================
    // PASSWORD CHECKS DISABLED
    // =====================================================

    let passwordHash: string | undefined = undefined;

    if (password && password.trim() !== "") {
      /*
      // Password validation checks have been disabled.

      const existingEmployee = await prisma.employee.findUnique({
        where: { id },
        select: {
          id: true,
          passwordHash: true,
        },
      });

      if (!existingEmployee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }

      // Same-password check has been disabled.
      const isSamePassword = await verifyPassword(
        password,
        existingEmployee.passwordHash
      );

      // Same-password error has been disabled.
      if (isSamePassword) {
        return NextResponse.json(
          {
            error:
              "Please enter a new password. The new password cannot be the same as the current password.",
          },
          { status: 400 }
        );
      }
      */

      // Password is still hashed before being stored.
      passwordHash = await hashPassword(password);
    }

    // =====================================================
    // UPDATE EMPLOYEE
    // =====================================================

    const employee = await prisma.employee.update({
      where: { id },

      data: {
        fullName:
          fullName !== undefined
            ? fullName.trim()
            : undefined,

        // Email is optional.
        // Empty email clears the existing email.
        email:
          email !== undefined
            ? email && email.trim()
              ? email.trim()
              : null
            : undefined,

        passwordHash:
          passwordHash !== undefined
            ? passwordHash
            : undefined,

        mobile:
          String(mobile).trim(),

        gender:
          gender !== undefined
            ? gender || null
            : undefined,

        isActive:
          isActive !== undefined
            ? isActive
            : undefined,

        departmentId:
          departmentId !== undefined
            ? departmentId || null
            : undefined,

        designationId:
          designationId !== undefined
            ? designationId || null
            : undefined,

        employeeTypeId:
          employeeTypeId !== undefined
            ? employeeTypeId || null
            : undefined,

        userTypeId:
          userTypeId !== undefined
            ? userTypeId || null
            : undefined,

        officeId:
          officeId !== undefined
            ? officeId || null
            : undefined,

        role:
          role === "ADMIN" || role === "EMPLOYEE"
            ? role
            : undefined,

        updatedAt: new Date(),
      },

      select: {
        id: true,
        fullName: true,
        email: true,
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

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "EMPLOYEE_UPDATED",
        entity: "Employee",
        entityId: id,
      },
    });

    return NextResponse.json(employee);
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

    console.error("PUT /api/employees/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;

    const auth = await requireEmployeePermission(
      "Employee List",
      "delete"
    );

    if (!auth.ok) {
      return auth.response;
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        fullName: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    await prisma.employee.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "EMPLOYEE_DELETED",
        entity: "Employee List",
        entityId: id,
        metadata: {
          deletedName: employee.fullName,
        },
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/employees/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}