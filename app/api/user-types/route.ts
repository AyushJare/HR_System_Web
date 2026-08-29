import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission, UserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import crypto from "crypto";

interface CreateUserTypeRequest {
    name: string;
    description?: string;
    permissions: UserPermissions;
}

function generateEmail(name: string): string {
    const base = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

    return `${base}@company.com`;
}

function generatePassword(): string {
    return `${crypto.randomBytes(6).toString("base64url")}A1!`;
}

async function getUniqueEmail(name: string): Promise<string> {
    const baseEmail = generateEmail(name);

    const existing = await prisma.employee.findUnique({
        where: {
            email: baseEmail,
        },
        select: {
            id: true,
        },
    });

    if (!existing) {
        return baseEmail;
    }

    const base = baseEmail.replace("@company.com", "");

    let counter = 2;

    while (true) {
        const email = `${base}${counter}@company.com`;

        const found = await prisma.employee.findUnique({
            where: {
                email,
            },
            select: {
                id: true,
            },
        });

        if (!found) {
            return email;
        }

        counter++;
    }
}

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
                (await checkPermission(session.sub, "User Types", "view")) ||
                (await checkPermission(session.sub, "Employee List", "add")) ||
                (await checkPermission(session.sub, "Employee List", "edit"));

            if (!allowed) {
                return NextResponse.json(
                    {
                        error: "You don't have permission to view User Types",
                    },
                    { status: 403 }
                );
            }
        }

        const userTypes = await prisma.userType.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                isSystem: true,
                loginEmail: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        employees: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json({
            success: true,
            data: userTypes,
        });
    } catch (error) {
        console.error("GET user types error:", error);

        return NextResponse.json(
            { error: "Failed to load User Types" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
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
            "User Types",
            "add"
        );

        if (!allowed) {
            return NextResponse.json(
                {
                    error: "You don't have permission to add User Types",
                },
                { status: 403 }
            );
        }
    }

    const body: CreateUserTypeRequest = await request.json();

    if (!body.name || !body.permissions) {
        return NextResponse.json(
            { error: "Name and permissions are required" },
            { status: 400 }
        );
    }

    const cleanName = body.name.trim();

    if (!cleanName) {
        return NextResponse.json(
            { error: "UserType name is required" },
            { status: 400 }
        );
    }

    // Check whether the UserType already exists
    const existing = await prisma.userType.findUnique({
        where: {
            name: cleanName,
        },
    });

    if (existing) {
        return NextResponse.json(
            { error: "UserType with this name already exists" },
            { status: 409 }
        );
    }

    // ----------------------------------------------------
    // GENERATE LOGIN EMAIL
    // Example:
    // "HR Manager" -> hr.manager@company.com
    // ----------------------------------------------------

    const emailPrefix = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

    let loginEmail = `${emailPrefix}@company.com`;

    // Make sure the generated email is unique
    let emailExists = await prisma.userType.findUnique({
        where: {
            loginEmail,
        },
    });

    let counter = 1;

    while (emailExists) {
        loginEmail = `${emailPrefix}${counter}@company.com`;

        emailExists = await prisma.userType.findUnique({
            where: {
                loginEmail,
            },
        });

        counter++;
    }

    // ----------------------------------------------------
    // GENERATE RANDOM PASSWORD
    // ----------------------------------------------------

    const generatedPassword =
        crypto.randomBytes(9).toString("base64url") + "A1!";

    const passwordHash = await hashPassword(generatedPassword);

    // ----------------------------------------------------
    // CREATE USER TYPE
    // ----------------------------------------------------

    const userType = await prisma.userType.create({
        data: {
            name: cleanName,
            description: body.description?.trim() || null,
            permissions: body.permissions as any,

            // Automatically generated credentials
            loginEmail,
            passwordHash,

            isSystem: false,
        },

        select: {
            id: true,
            name: true,
            description: true,
            permissions: true,
            isSystem: true,
            loginEmail: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    // ----------------------------------------------------
    // AUDIT LOG
    // ----------------------------------------------------

    await prisma.auditLog.create({
        data: {
            employeeId: session.sub,
            action: "USER_TYPE_CREATED",
            entity: "UserType",
            entityId: userType.id,
            metadata: {
                name: userType.name,
                loginEmail: userType.loginEmail,
            },
        },
    });

    // ----------------------------------------------------
    // RETURN CREDENTIALS ONCE
    // ----------------------------------------------------

    return NextResponse.json(
        {
            success: true,
            data: userType,
            credentials: {
                email: loginEmail,
                password: generatedPassword,
            },
        },
        { status: 201 }
    );
}