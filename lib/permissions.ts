import "server-only";

import { prisma } from "@/lib/prisma";
import {
    PERMISSION_MODULES,
    type ModuleConfig,
} from "@/lib/permissionModules";

export type PermissionAction =
    | "view"
    | "add"
    | "edit"
    | "delete"
    | "export"
    | "import";

export interface UserPermissions {
    moduleName: string;
    canView: boolean;
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canExport: boolean;
    canImport: boolean;
}

type PermissionData = UserPermissions | UserPermissions[] | Record<string, any>;

// -----------------------------------------------------------------------------
// PATH RESOLUTION
//
// Given a module leaf name ("Departments"), returns the full path in
// PERMISSION_MODULES ("Masters" -> "Departments"). Used so that a permission
// granted on a parent module (e.g. Masters.view) implicitly applies to its
// children (Departments, Designations, Holidays, ...).
// -----------------------------------------------------------------------------

function findModulePath(
    moduleKey: string,
    modules: ModuleConfig[] = PERMISSION_MODULES,
    path: string[] = []
): string[] | null {
    for (const m of modules) {
        const next = [...path, m.key];
        if (m.key === moduleKey) return next;
        if (m.children) {
            const found = findModulePath(moduleKey, m.children, next);
            if (found) return found;
        }
    }
    return null;
}

// -----------------------------------------------------------------------------
// NORMALIZER
//
// Flattens the nested UserType.permissions JSON into a flat list keyed by
// module name. Supports both the current nested format and the older
// canView/canAdd flat format used by earlier seeds.
// -----------------------------------------------------------------------------

function normalizePermissions(permissions: unknown): UserPermissions[] {
    if (!permissions) return [];

    if (Array.isArray(permissions)) {
        return permissions.filter(
            (item): item is UserPermissions =>
                typeof item === "object" &&
                item !== null &&
                "moduleName" in item
        );
    }

    if (typeof permissions !== "object" || permissions === null) return [];

    const actionKeys = new Set([
        "view", "add", "edit", "delete", "import", "export",
        "canView", "canAdd", "canEdit", "canDelete", "canImport", "canExport",
    ]);

    const result: UserPermissions[] = [];

    function walk(obj: Record<string, unknown>) {
        for (const [key, value] of Object.entries(obj)) {
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                continue;
            }
            const current = value as Record<string, unknown>;
            const hasAction = Object.keys(current).some((k) => actionKeys.has(k));

            if (hasAction) {
                result.push({
                    moduleName: key,
                    canView: Boolean(current.view ?? current.canView),
                    canAdd: Boolean(current.add ?? current.canAdd),
                    canEdit: Boolean(current.edit ?? current.canEdit),
                    canDelete: Boolean(current.delete ?? current.canDelete),
                    canExport: Boolean(current.export ?? current.canExport),
                    canImport: Boolean(current.import ?? current.canImport),
                });
            }

            walk(current);
        }
    }

    walk(permissions as Record<string, unknown>);
    return result;
}

const ACTION_MAP: Record<PermissionAction, keyof UserPermissions> = {
    view: "canView",
    add: "canAdd",
    edit: "canEdit",
    delete: "canDelete",
    export: "canExport",
    import: "canImport",
};

// -----------------------------------------------------------------------------
// hasPermission
//
// Resolution rules:
//   1. Flatten the permission tree.
//   2. If the requested module itself grants the action -> allow.
//   3. Otherwise, walk up its canonical ancestor chain in PERMISSION_MODULES.
//      If any ancestor grants the same action -> allow.
//
// This is what makes "Masters.view = true" grant view access to Departments,
// Designations, Holidays, etc. without the admin having to also tick every
// child. It only inherits the same action, so granting Masters.view does not
// silently grant Departments.delete.
// -----------------------------------------------------------------------------

export function hasPermission(
    permissions: PermissionData | null | undefined,
    modulePath: string[],
    action: PermissionAction
): boolean {
    if (!permissions) return false;

    const moduleName = modulePath[modulePath.length - 1];
    if (!moduleName) return false;

    const list = normalizePermissions(permissions);
    const key = ACTION_MAP[action];

    // 1. Direct match on the requested module.
    const direct = list.find((p) => p.moduleName === moduleName);
    if (direct && direct[key]) return true;

    // 2. Check child modules (for nested permissions like Approve Requests, Reject Requests under Approvals)
    const childPermissions = list.filter((p) => {
        // Child if it contains the parent module name as prefix or is under Approvals
        return p.moduleName !== moduleName &&
            (p.moduleName.includes(moduleName) ||
                (moduleName === "Approvals" && (p.moduleName.includes("Requests") || p.moduleName.includes("Approvals"))));
    });
    if (childPermissions.some((p) => p[key])) return true;

    // 3. Ancestor fallback via the canonical module tree.
    const canonicalPath = findModulePath(moduleName);
    if (canonicalPath && canonicalPath.length > 1) {
        for (const ancestor of canonicalPath.slice(0, -1)) {
            const p = list.find((x) => x.moduleName === ancestor);
            if (p && p[key]) return true;
        }
    }

    return false;
}

// -----------------------------------------------------------------------------

export async function getUserTypePermissions(userTypeId: string) {
    try {
        const userType = await prisma.userType.findUnique({
            where: { id: userTypeId },
            select: { permissions: true },
        });
        return userType?.permissions ?? {};
    } catch (error) {
        console.error("Error fetching permissions:", error);
        return {};
    }
}

export async function getUserPermissions(employeeId: string) {
    try {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                role: true,
                userType: { select: { permissions: true } },
            },
        });
        if (!employee) return {};
        return employee.userType?.permissions ?? {};
    } catch (error) {
        console.error("Error fetching user permissions:", error);
        return {};
    }
}

// -----------------------------------------------------------------------------
// checkPermission
//
// ADMIN always allowed.
// EMPLOYEE resolved via hasPermission (with ancestor inheritance above).
// -----------------------------------------------------------------------------

export async function checkPermission(
    employeeId: string,
    moduleName: string,
    action: PermissionAction = "view"
) {
    try {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                role: true,
                userType: { select: { permissions: true } },
            },
        });

        if (!employee) return false;

        if (employee.role === "ADMIN") return true;

        if (!employee.userType?.permissions) return false;

        return hasPermission(
            employee.userType.permissions as unknown as PermissionData,
            [moduleName],
            action
        );
    } catch (error) {
        console.error("Error checking permission:", error);
        return false;
    }
}

export function getAllModules() {
    return [
        { name: "Dashboard", actions: ["view"] },
        { name: "Admission", actions: ["view", "add", "edit", "delete", "import", "export"] },
        { name: "Fees", actions: ["view", "add", "edit", "delete", "import", "export"] },
        { name: "Employee", actions: ["view", "add", "edit", "delete", "import", "export"] },
        { name: "Attendance", actions: ["view", "add", "edit", "delete", "import", "export"] },
        { name: "Masters", actions: ["view", "add", "edit", "delete", "import", "export"] },
        { name: "Leaves", actions: ["view", "add", "edit", "delete", "import", "export"] },
        { name: "Approvals", actions: ["view", "add", "edit", "delete"] },
    ];
}

export async function savePermissions(
    userTypeId: string,
    permissionsData: UserPermissions | UserPermissions[] | Record<string, any>
) {
    try {
        const updated = await prisma.userType.update({
            where: { id: userTypeId },
            data: { permissions: permissionsData as any },
        });
        return updated.permissions;
    } catch (error) {
        console.error("Error saving permissions:", error);
        throw error;
    }
}
