import { prisma } from "@/lib/prisma";

/**
 * Log audit trail for all system actions
 */
export async function logAudit(
    action: string,
    employeeId?: string | null,
    metadata?: Record<string, any> | null // ✅ Changed type
) {
    try {
        // ✅ Explicitly handle metadata - Prisma Json needs proper conversion
        const auditData = {
            action,
            employeeId: employeeId || null,
            metadata: metadata ? JSON.stringify(metadata) : null, // ✅ Convert to string
            entity: null,
            entityId: null,
        };

        // Type assertion to work with Prisma's Json type
        await prisma.auditLog.create({
            data: auditData as any, // ✅ Use type assertion if needed
        });
    } catch (error) {
        console.error("Failed to log audit:", error);
    }
}

/**
 * Log login attempt
 */
export async function logLoginAttempt(
    email: string,
    success: boolean,
    employeeId?: string,
    reason?: string
) {
    const metadata = {
        email,
        success,
        reason: reason || null,
        timestamp: new Date().toISOString(),
    };

    await logAudit(
        success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
        employeeId || null,
        metadata
    );
}

/**
 * Log employee action
 */
export async function logEmployeeAction(
    employeeId: string,
    action: string,
    targetEmployeeId?: string,
    metadata?: Record<string, any>
) {
    const fullMetadata = {
        targetEmployeeId,
        ...metadata,
    };

    await logAudit(action, employeeId, fullMetadata);
}

/**
 * Log attendance action
 */
export async function logAttendanceAction(
    employeeId: string,
    action: string,
    attendanceId: string,
    metadata?: Record<string, any>
) {
    const fullMetadata = {
        entity: "Attendance",
        entityId: attendanceId,
        ...metadata,
    };

    await logAudit(action, employeeId, fullMetadata);
}