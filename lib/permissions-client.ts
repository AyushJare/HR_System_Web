export type PermissionAction =
    | "view"
    | "add"
    | "edit"
    | "delete"
    | "export"
    | "import";

export type Permissions = Record<string, any> | null | undefined;

/**
 * Checks a permission using the nested permission structure
 * stored in UserType.permissions.
 *
 * Example:
 *
 * {
 *   HR: {
 *     Employee: {
 *       view: true,
 *       add: true,
 *       edit: true,
 *       delete: true
 *     }
 *   }
 * }
 *
 * modulePath:
 * ["HR", "Employee"]
 */
export function hasPermission(
    permissions: Permissions,
    modulePath: string[],
    action: PermissionAction
): boolean {
    if (!permissions || !modulePath.length) {
        return false;
    }

    let current: any = permissions;

    // Walk through the permission tree
    for (const module of modulePath) {
        if (
            !current ||
            typeof current !== "object" ||
            !(module in current)
        ) {
            return false;
        }

        current = current[module];
    }

    if (!current || typeof current !== "object") {
        return false;
    }

    return current[action] === true;
}