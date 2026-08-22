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
    const { id } = await params;

    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const department = await prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("GET [id] department error:", error);
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

    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    const department = await prisma.department.update({
      where: { id },
      data: { name: name.trim() },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "DEPARTMENT_UPDATED",
        entity: "Department",
        entityId: id,
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("PUT [id] department error:", error);
    return NextResponse.json(
      { error: "Failed to update department" },
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

    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const department = await prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "DEPARTMENT_DELETED",
        entity: "Department",
        entityId: id,
        metadata: { deletedName: department.name },
      },
    });

    await prisma.department.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE [id] department error:", error);
    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 }
    );
  }
}