import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getUserPermissions, savePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const adminCheck = await requireAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json(
                { error: adminCheck.error },
                { status: adminCheck.status }
            );
        }

        const userTypeId =
            request.nextUrl.searchParams.get("userTypeId");

        let permissions: unknown = [];

        if (userTypeId) {
            const userType = await prisma.userType.findUnique({
                where: { id: userTypeId },
                select: {
                    permissions: true,
                },
            });

            if (!userType) {
                return NextResponse.json(
                    { error: "User type not found" },
                    { status: 404 }
                );
            }

            permissions = userType.permissions;
        } else {
            const employeeId =
                (adminCheck.session as any).id ??
                (adminCheck.session as any).employeeId ??
                (adminCheck.session as any).sub;

            permissions = await getUserPermissions(employeeId);
        }

        return NextResponse.json({ permissions });
    } catch (error) {
        console.error("Fetch permissions error:", error);

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const adminCheck = await requireAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json(
                { error: adminCheck.error },
                { status: adminCheck.status }
            );
        }

        const body = await request.json();
        const { userTypeId, permissions } = body;

        if (!userTypeId || permissions === undefined) {
            return NextResponse.json(
                { error: "User type ID and permissions are required" },
                { status: 400 }
            );
        }

        const userType = await prisma.userType.findUnique({
            where: { id: userTypeId },
        });

        if (!userType) {
            return NextResponse.json(
                { error: "User type not found" },
                { status: 404 }
            );
        }

        if (userType.isSystem) {
            return NextResponse.json(
                { error: "System UserTypes cannot be modified" },
                { status: 403 }
            );
        }

        await savePermissions(userTypeId, permissions);

        const employeeId =
            (adminCheck.session as any).id ??
            (adminCheck.session as any).employeeId ??
            (adminCheck.session as any).sub;

        try {
            await prisma.auditLog.create({
                data: {
                    employeeId,
                    action: "PERMISSIONS_UPDATED",
                    entity: "UserType",
                    entityId: userTypeId,
                    metadata: {
                        userTypeId,
                    },
                },
            });
        } catch (error) {
            console.error("Audit log failed:", error);
        }

        return NextResponse.json({
            success: true,
            message: "Permissions saved successfully",
        });
    } catch (error) {
        console.error("Save permissions error:", error);

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}