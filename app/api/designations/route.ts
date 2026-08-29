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
        (await checkPermission(session.sub, "Designations", "view")) ||
        (await checkPermission(session.sub, "Employee Details", "edit")) ||
        (await checkPermission(session.sub, "Employee List", "add")) ||
        (await checkPermission(session.sub, "Employee List", "edit"));

      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to view designations" },
          { status: 403 }
        );
      }
    }

    const designations = await prisma.designation.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(designations);
  } catch (error) {
    console.error("GET designations error:", error);

    return NextResponse.json(
      { error: "Failed to load designations" },
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
    // Non-admin users need Designations → add permission.
    if (session.role !== "ADMIN") {
      const allowed = await checkPermission(
        session.sub,
        "Designations",
        "add"
      );

      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to add designations" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Designation name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.designation.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Designation already exists" },
        { status: 409 }
      );
    }

    const designation = await prisma.designation.create({
      data: {
        name: name.trim(),
        description:
          typeof description === "string" &&
            description.trim() !== ""
            ? description.trim()
            : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: session.sub,
        action: "DESIGNATION_CREATED",
        entity: "Designation",
        entityId: designation.id,
      },
    });

    return NextResponse.json(designation, { status: 201 });
  } catch (error) {
    console.error("POST designations error:", error);

    return NextResponse.json(
      { error: "Failed to create designation" },
      { status: 500 }
    );
  }
}