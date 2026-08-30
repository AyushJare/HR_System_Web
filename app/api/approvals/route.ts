import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermissionOrAdmin("Approvals", "view");

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // Optional filters
    const type = request.nextUrl.searchParams.get("type");
    const status = request.nextUrl.searchParams.get("status");

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    const approvals = await prisma.approval.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    return NextResponse.json(approvals);
  } catch (error) {
    console.error("GET /api/approvals error:", error);

    return NextResponse.json(
      { error: "Failed to load approvals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermissionOrAdmin("Approvals", "edit");

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();

    const { type, actorId, refId, details } = body ?? {};

    if (!type || !details) {
      return NextResponse.json(
        { error: "type and details are required" },
        { status: 400 }
      );
    }

    // Supported approval request types
    if (
      type !== "LEAVE" &&
      type !== "ATTENDANCE_CORRECTION" &&
      type !== "LOCATION_BASED_LOGIN"
    ) {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Use provided actorId, otherwise current authenticated user
    const approvalActorId = actorId || auth.session.sub;

    const approval = await prisma.approval.create({
      data: {
        type,
        refId: refId || null,
        actorId: approvalActorId,
        status: "PENDING",
        details,
      },
    });

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "APPROVAL_REQUESTED",
        entity: "Approval",
        entityId: approval.id,
        metadata: {
          type,
          actorId: approvalActorId,
          refId: refId || null,
        },
      },
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    console.error("POST /api/approvals error:", error);

    return NextResponse.json(
      { error: "Failed to create approval" },
      { status: 500 }
    );
  }
}