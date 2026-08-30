import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";

type Params = { id: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;

    const auth = await requirePermissionOrAdmin("Approvals", "edit");

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const decision = body?.decision;

    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json(
        { error: "decision must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    const existing = await prisma.approval.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { error: "This request has already been actioned" },
        { status: 409 }
      );
    }

    const updated = await prisma.approval.update({
      where: { id },
      data: {
        status: decision,
        remarks: body?.remarks ?? null,
      },
      include: {
        actor: {
          select: {
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    // If a location-based login is approved, create a dedicated audit log
    if (
      updated.type === "LOCATION_BASED_LOGIN" &&
      decision === "APPROVED"
    ) {
      await prisma.auditLog.create({
        data: {
          employeeId: updated.refId,
          action: "LOCATION_LOGIN_APPROVED",
          entity: "Approval",
          entityId: updated.id,
          metadata: {
            details: updated.details,
            approvedBy: auth.session.sub,
          },
        },
      });
    }

    // Standard approval audit log
    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action:
          decision === "APPROVED"
            ? "APPROVAL_APPROVED"
            : "APPROVAL_REJECTED",
        entity: "Approval",
        entityId: id,
        metadata: {
          type: updated.type,
          refId: updated.refId,
          remarks: body?.remarks ?? null,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/approvals/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to update approval" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;

    const auth = await requirePermissionOrAdmin("Approvals", "view");

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(approval);
  } catch (error) {
    console.error("GET /api/approvals/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to load approval" },
      { status: 500 }
    );
  }
}