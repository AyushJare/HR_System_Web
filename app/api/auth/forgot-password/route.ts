import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
// import { verifyPassword } from "@/lib/password";
// import { validatePassword } from "@/lib/validators/password";
import { rateLimit } from "@/lib/middleware/rateLimit";

const checkRateLimit = rateLimit(10, 15 * 60 * 1000);

export async function POST(request: NextRequest) {
    try {
        const limitCheck = await checkRateLimit(request);

        if (limitCheck.status !== 200) {
            return limitCheck;
        }

        const body = await request.json();

        const firstName = body.firstName?.toString().trim();
        const employeeCode = body.employeeCode?.toString().trim();
        const mobile = body.mobile?.toString().trim();
        const newPassword = body.newPassword?.toString();

        if (!firstName || !employeeCode || !mobile || !newPassword) {
            return NextResponse.json(
                {
                    error:
                        "First name, employee code, mobile number and new password are required.",
                },
                { status: 400 }
            );
        }

        // ---------------------------------------------------------
        // FIND EMPLOYEE
        // ---------------------------------------------------------

        const numericEmployeeCode = Number(employeeCode);

        if (!Number.isInteger(numericEmployeeCode)) {
            return NextResponse.json(
                { error: "Invalid employee code." },
                { status: 400 }
            );
        }

        const employees = await prisma.employee.findMany({
            where: {
                employeeCode: numericEmployeeCode,
                mobile: mobile,
                isActive: true,
            },
            select: {
                id: true,
                fullName: true,
                passwordHash: true,
            },
        });

        // ---------------------------------------------------------
        // VERIFY THAT EXACTLY ONE EMPLOYEE MATCHES
        // ---------------------------------------------------------

        if (employees.length !== 1) {
            return NextResponse.json(
                {
                    error:
                        "The information provided does not match an active employee account.",
                },
                { status: 401 }
            );
        }

        const employee = employees[0];

        // ---------------------------------------------------------
        // VERIFY FIRST NAME
        // ---------------------------------------------------------

        const storedFirstName =
            employee.fullName.trim().split(/\s+/)[0];

        if (
            storedFirstName.toLowerCase() !==
            firstName.toLowerCase()
        ) {
            return NextResponse.json(
                {
                    error:
                        "The information provided does not match an active employee account.",
                },
                { status: 401 }
            );
        }

        // ---------------------------------------------------------
        // PASSWORD VALIDATION DISABLED
        // ---------------------------------------------------------

        /*
        // Password policy validation has been disabled.

        const passwordValidation = validatePassword(newPassword);

        if (!passwordValidation.valid) {
            return NextResponse.json(
                {
                    error: "Password does not meet the required policy.",
                    errors: passwordValidation.errors,
                },
                { status: 400 }
            );
        }
        */

        // ---------------------------------------------------------
        // SAME PASSWORD CHECK DISABLED
        // ---------------------------------------------------------

        /*
        // Same-as-current-password validation has been disabled.

        if (employee.passwordHash) {
            const isSamePassword = await verifyPassword(
                newPassword,
                employee.passwordHash
            );

            if (isSamePassword) {
                return NextResponse.json(
                    {
                        error:
                            "New password cannot be the same as your current password.",
                    },
                    { status: 400 }
                );
            }
        }
        */

        // ---------------------------------------------------------
        // UPDATE PASSWORD
        // ---------------------------------------------------------

        // Password is still securely hashed before being stored.
        const passwordHash = await hashPassword(newPassword);

        await prisma.employee.update({
            where: {
                id: employee.id,
            },
            data: {
                passwordHash,
            },
        });

        // ---------------------------------------------------------
        // AUDIT LOG
        // ---------------------------------------------------------

        await prisma.auditLog.create({
            data: {
                employeeId: employee.id,
                action: "PASSWORD_RESET",
                entity: "Employee",
                entityId: employee.id,
                metadata: {
                    method: "SELF_SERVICE",
                },
            },
        });

        return NextResponse.json(
            {
                success: true,
                message: "Password changed successfully.",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "POST /api/auth/forgot-password error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to reset password.",
            },
            { status: 500 }
        );
    }
}