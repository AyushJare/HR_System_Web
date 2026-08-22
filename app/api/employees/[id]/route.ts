import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = {
  id: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;  // ← AWAIT params!

    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
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
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        employeeType: { select: { id: true, name: true } },
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
    console.error("GET [id] error:", error);
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
    const { id } = await params;  // ← AWAIT params!

    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
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
        fullName: fullName || undefined,
        mobile: mobile || undefined,
        gender: gender || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        departmentId: departmentId !== undefined ? (departmentId || null) : undefined,
        designationId: designationId !== undefined ? (designationId || null) : undefined,
        employeeTypeId: employeeTypeId !== undefined ? (employeeTypeId || null) : undefined,
        role: role === "ADMIN" || role === "EMPLOYEE" ? role : undefined,
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
    console.error("PUT [id] error:", error);
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
    const { id } = await params;  // ← AWAIT params!

    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { fullName: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "EMPLOYEE_DELETED",
        entity: "Employee",
        entityId: id,
        metadata: { deletedName: employee.fullName },
      },
    });

    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE [id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}