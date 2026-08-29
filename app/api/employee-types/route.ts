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
        (await checkPermission(session.sub, "Employee Types", "view")) ||
        (await checkPermission(session.sub, "Employee Details", "edit")) ||
        (await checkPermission(session.sub, "Employee List", "add")) ||
        (await checkPermission(session.sub, "Employee List", "edit"));

      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to view employee types" },
          { status: 403 }
        );
      }
    }

    const employeeTypes = await prisma.employeeType.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(employeeTypes);
  } catch (error) {
    console.error("GET employee types error:", error);

    return NextResponse.json(
      { error: "Failed to load employee types" },
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

    // ADMIN users are automatically allowed.
    // Non-admin users need Employee Types → add permission.
    if (session.role !== "ADMIN") {
      const allowed = await checkPermission(
        session.sub,
        "Employee Types",
        "add"
      );

      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to add employee types" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { name, noticePeriod } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Employee type name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.employeeType.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Employee type already exists" },
        { status: 409 }
      );
    }

    const employeeType = await prisma.employeeType.create({
      data: {
        name: name.trim(),
        noticePeriod:
          typeof noticePeriod === "number"
            ? noticePeriod
            : 30,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: session.sub,
        action: "EMPLOYEE_TYPE_CREATED",
        entity: "EmployeeType",
        entityId: employeeType.id,
      },
    });

    return NextResponse.json(employeeType, { status: 201 });
  } catch (error) {
    console.error("POST employee types error:", error);

    return NextResponse.json(
      { error: "Failed to create employee type" },
      { status: 500 }
    );
  }
}
