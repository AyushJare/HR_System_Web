import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
      mobile,
      gender,
      isActive,
      departmentId,
      designationId,
      employeeTypeId,
      role,
    } = body;

    const employee = await prisma.employee.update({
      where: { id },

      data: {
        fullName:
          fullName !== undefined
            ? fullName
            : undefined,

        mobile:
          mobile !== undefined
            ? mobile || null
            : undefined,

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