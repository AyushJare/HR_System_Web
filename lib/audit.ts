import { prisma } from "@/lib/prisma";

/**
 * Metadata accepted by the audit logger.
 */
export type AuditMetadata = Record<string, unknown>;

/**
 * Log an audit trail for a system action.
 *
 * entity and entityId are stored in their dedicated AuditLog columns.
 * Additional information is stored in the metadata JSON field.
 *
 * Audit logging must never break the actual application action.
 */
export async function logAudit(
    action: string,
    employeeId?: string | null,
    metadata?: AuditMetadata | null,
    entity?: string | null,
    entityId?: string | null
) {
    try {
        const metadataCopy = metadata
            ? { ...metadata }
            : null;

        // Support callers that may provide entity/entityId
        // inside metadata.
        const resolvedEntity =
            entity ??
            (typeof metadataCopy?.entity === "string"
                ? metadataCopy.entity
                : null);

        const resolvedEntityId =
            entityId ??
            (typeof metadataCopy?.entityId === "string"
                ? metadataCopy.entityId
                : null);

        if (metadataCopy) {
            delete metadataCopy.entity;
            delete metadataCopy.entityId;
        }

        await prisma.auditLog.create({
            data: {
                action,
                employeeId: employeeId || null,
                entity: resolvedEntity,
                entityId: resolvedEntityId,

                // Prisma's JSON input type does not accept
                // a nullable plain object directly.
                // undefined means "do not provide metadata".
                metadata: metadataCopy
                    ? (metadataCopy as any)
                    : undefined,
            },
        });
    } catch (error) {
        console.error("Failed to log audit:", error);
    }
}

/**
 * Log a login attempt.
 */
export async function logLoginAttempt(
    email: string,
    success: boolean,
    employeeId?: string,
    reason?: string
) {
    await logAudit(
        success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
        employeeId || null,
        {
            email,
            success,
            reason: reason || null,
            timestamp: new Date().toISOString(),
        },
        "Employee",
        employeeId || null
    );
}

/**
 * Log an employee action.
 */
export async function logEmployeeAction(
    employeeId: string,
    action: string,
    targetEmployeeId?: string,
    metadata?: AuditMetadata
) {
    await logAudit(
        action,
        employeeId,
        {
            targetEmployeeId: targetEmployeeId || null,
            ...metadata,
        },
        "Employee",
        targetEmployeeId || null
    );
}

/**
 * Log an attendance action.
 */
export async function logAttendanceAction(
    employeeId: string,
    action: string,
    attendanceId: string,
    metadata?: AuditMetadata
) {
    await logAudit(
        action,
        employeeId,
        metadata,
        "Attendance",
        attendanceId
    );
}

/**
 * Log a UserType / Access Control action.
 */
export async function logUserTypeAction(
    employeeId: string,
    action: string,
    userTypeId?: string,
    metadata?: AuditMetadata
) {
    await logAudit(
        action,
        employeeId,
        metadata,
        "UserType",
        userTypeId || null
    );
}

/**
 * Log an approval action.
 */
export async function logApprovalAction(
    employeeId: string,
    action: string,
    approvalId?: string,
    metadata?: AuditMetadata
) {
    await logAudit(
        action,
        employeeId,
        metadata,
        "Approval",
        approvalId || null
    );
}