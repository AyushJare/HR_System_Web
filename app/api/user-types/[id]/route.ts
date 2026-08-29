import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { UserPermissions } from "@/lib/permissions";

type Params = { id: string };

interface UpdateUserTypeRequest {
    name?: string;
    description?: string;
    permissions?: UserPermissions | UserPermissions[];
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<Params> }
) {
    const { id } = await params;

    const auth = await requireAdmin();

    if (!auth.ok) {
        return NextResponse.json(
            { error: auth.error },
            { status: auth.status }
        );
    }

    const userType = await prisma.userType.findUnique({
        where: { id },
        include: {
            employees: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    employeeCode: true,
                    isActive: true,
                },
                take: 10,
            },
        },
    });

    if (!userType) {
        return NextResponse.json(
            { error: "UserType not found" },
            { status: 404 }
        );
    }

    const employeeCount = await prisma.employee.count({
        where: {
            userTypeId: id,
        },
    });

    return NextResponse.json({
        success: true,
        data: {
            ...userType,
            employeeCount,
        },
    });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<Params> }
) {
    const { id } = await params;

    const auth = await requireAdmin();

    if (!auth.ok) {
        return NextResponse.json(
            { error: auth.error },
            { status: auth.status }
        );
    }

    const userType = await prisma.userType.findUnique({
        where: { id },
    });

    if (!userType) {
        return NextResponse.json(
            { error: "UserType not found" },
            { status: 404 }
        );
    }

    if (userType.isSystem) {
        return NextResponse.json(
            { error: "System UserTypes cannot be modified" },
            { status: 403 }
        );
    }

    const body: UpdateUserTypeRequest = await request.json();

    if (body.name && body.name !== userType.name) {
        const existing = await prisma.userType.findUnique({
            where: { name: body.name },
        });

        if (existing) {
            return NextResponse.json(
                { error: "UserType with this name already exists" },
                { status: 409 }
            );
        }
    }

    const updated = await prisma.userType.update({
        where: { id },
        data: {
            ...(body.name !== undefined && {
                name: body.name.trim(),
            }),

            ...(body.description !== undefined && {
                description:
                    body.description.trim() || null,
            }),

            ...(body.permissions !== undefined && {
                permissions: body.permissions as any,
            }),
        },
    });

    await prisma.auditLog.create({
        data: {
            employeeId: auth.session.sub,
            action: "USER_TYPE_UPDATED",
            entity: "UserType",
            entityId: id,
        },
    });

    return NextResponse.json({
        success: true,
        data: updated,
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<Params> }
) {
    const { id } = await params;

    const auth = await requireAdmin();

    if (!auth.ok) {
        return NextResponse.json(
            { error: auth.error },
            { status: auth.status }
        );
    }

    const userType = await prisma.userType.findUnique({
        where: { id },
    });

    if (!userType) {
        return NextResponse.json(
            { error: "UserType not found" },
            { status: 404 }
        );
    }

    if (userType.isSystem) {
        return NextResponse.json(
            { error: "System UserTypes cannot be deleted" },
            { status: 403 }
        );
    }

    const employeeCount = await prisma.employee.count({
        where: {
            userTypeId: id,
        },
    });

    if (employeeCount > 0) {
        return NextResponse.json(
            {
                error: `Cannot delete UserType with ${employeeCount} assigned employee(s)`,
            },
            { status: 409 }
        );
    }

    await prisma.auditLog.create({
        data: {
            employeeId: auth.session.sub,
            action: "USER_TYPE_DELETED",
            entity: "UserType",
            entityId: id,
            metadata: {
                deletedName: userType.name,
            },
        },
    });

    await prisma.userType.delete({
        where: { id },
    });

    return NextResponse.json({
        success: true,
        message: "UserType deleted successfully",
    });
}