import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const departments = await prisma.department.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error("GET departments error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    // Check if already exists
    const existing = await prisma.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Department already exists" },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: { name: name.trim() },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "DEPARTMENT_CREATED",
        entity: "Department",
        entityId: department.id,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error("POST departments error:", error);
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }
}