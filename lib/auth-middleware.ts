import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
    hasPermission,
    UserPermissions,
    PermissionAction,
} from "@/lib/permissions";

export async function verifySession(_token?: string | null) {
    const session = await getSession();

    if (!session) return null;

    return {
        userId: session.sub,
        role: session.role,
    };
}

/**
 * Require ADMIN role.
 * ADMIN users bypass RBAC permission checks.
 */
export async function requireAdmin(_request?: NextRequest) {
    const user = await verifySession();

    if (!user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    if (user.role !== "ADMIN") {
        return NextResponse.json(
            { error: "Forbidden - Admin access required" },
            { status: 403 }
        );
    }

    return null;
}

/**
 * Require a specific UserType permission.
 */
export async function requirePermission(
    _request: NextRequest,
    modulePath: string[],
    action: PermissionAction
) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    // ADMIN has unrestricted access.
    if (session.role === "ADMIN") {
        return null;
    }

    return checkUserPermission(
        session.sub,
        modulePath,
        action
    );
}

async function checkUserPermission(
    employeeId: string,
    modulePath: string[],
    action: PermissionAction
) {
    const { prisma } = await import("@/lib/prisma");

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
            isActive: true,
            userType: {
                select: {
                    permissions: true,
                },
            },
        },
    });

    if (!employee || !employee.isActive) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const permissions =
        employee.userType?.permissions as unknown as
        | UserPermissions
        | UserPermissions[]
        | null
        | undefined;

    if (!hasPermission(permissions, modulePath, action)) {
        return NextResponse.json(
            {
                error: `Forbidden - ${modulePath.join(
                    " > "
                )} ${action} permission required`,
            },
            { status: 403 }
        );
    }

    return null;
}