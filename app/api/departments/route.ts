import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.role !== "ADMIN") {
      const allowed =
        (await checkPermission(session.sub, "Departments", "view")) ||
        (await checkPermission(session.sub, "Employee List", "add")) ||
        (await checkPermission(session.sub, "Employee List", "edit"));

      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to view departments" },
          { status: 403 }
        );
      }
    }

    const departments = await prisma.department.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error("GET departments error:", error);

    return NextResponse.json(
      { error: "Failed to load departments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.role !== "ADMIN") {
      const allowed = await checkPermission(
        session.sub,
        "Departments",
        "add"
      );

      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to add departments" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.department.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Department already exists" },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: session.sub,
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