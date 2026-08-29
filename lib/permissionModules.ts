export type ModuleActionKey =
    | "view"
    | "add"
    | "edit"
    | "delete"
    | "import"
    | "export";

export interface ModuleConfig {
    key: string;
    label: string;
    actions: string[];
    other?: string[];
    children?: ModuleConfig[];
}

export const PERMISSION_MODULES: ModuleConfig[] = [
    {
        key: "Dashboard",
        label: "Dashboard",
        actions: ["view"],
    },

    {
        key: "Employee",
        label: "Employees",
        actions: ["view", "add", "edit", "delete", "import", "export"],
        children: [
            { key: "Employee List", label: "Employee List", actions: ["view", "add", "edit", "delete"] },
            { key: "Employee Details", label: "Employee Details", actions: ["view", "edit"] },
            { key: "Employee Bulk Upload", label: "Bulk Upload", actions: ["view", "import"] },
            { key: "Employee Export", label: "Employee Export", actions: ["view", "export"] },
            { key: "Employee Attendance Summary", label: "Attendance Summary", actions: ["view", "export"] },
        ],
    },

    {
        key: "Attendance",
        label: "Attendance",
        actions: ["view", "add", "edit", "delete", "import", "export"],
        children: [
            { key: "Daily Attendance", label: "Daily Attendance", actions: ["view", "add", "edit"] },
            { key: "Check In", label: "Check In", actions: ["view", "add"] },
            { key: "Attendance Corrections", label: "Attendance Corrections", actions: ["view", "add", "edit"] },
        ],
    },

    {
        key: "Masters",
        label: "Masters",
        actions: ["view", "add", "edit", "delete", "import", "export"],
        children: [
            { key: "Departments", label: "Departments", actions: ["view", "add", "edit", "delete"] },
            { key: "Designations", label: "Designations", actions: ["view", "add", "edit", "delete"] },
            { key: "Employee Types", label: "Employee Types", actions: ["view", "add", "edit", "delete"] },
            {
                key: "Holidays",
                label: "Holidays",
                actions: ["view", "add", "edit", "delete", "import", "export"],
                children: [
                    { key: "Holiday Groups", label: "Holiday Groups", actions: ["view", "add", "edit", "delete"] },
                    { key: "Holiday Bulk Upload", label: "Holiday Bulk Upload", actions: ["view", "import"] },
                    { key: "Holiday Template", label: "Holiday Template", actions: ["view", "export"] },
                ],
            },
            { key: "Leave Types", label: "Leave Types", actions: ["view", "add", "edit", "delete"] },
            { key: "Weekly Off", label: "Weekly Off", actions: ["view", "edit"] },
            { key: "Masters Bulk Upload", label: "Masters Bulk Upload", actions: ["view", "import"] },
            { key: "Masters Template", label: "Masters Template", actions: ["view", "export"] },
        ],
    },

    {
        key: "Approvals",
        label: "Approvals",
        actions: ["view", "add", "edit", "delete"],
        children: [
            { key: "Leave Approvals", label: "Leave Approvals", actions: ["view", "add", "edit"] },
            { key: "Attendance Correction Approvals", label: "Attendance Correction Approvals", actions: ["view", "add", "edit"] },
            { key: "Approve Requests", label: "Approve Requests", actions: ["edit"] },
            { key: "Reject Requests", label: "Reject Requests", actions: ["edit"] },
        ],
    },

    {
        key: "Reports",
        label: "Reports",
        actions: ["view", "export"],
        children: [
            { key: "Attendance Summary Report", label: "Attendance Summary", actions: ["view", "export"] },
            { key: "Consolidated Report", label: "Consolidated Report", actions: ["view", "export"] },
        ],
    },

    {
        key: "Audit Log",
        label: "Audit Log",
        actions: ["view", "export"],
    },

    {
        key: "Access Control",
        label: "Access Control",
        actions: ["view", "add", "edit", "delete"],
        children: [
            { key: "User Types", label: "User Types", actions: ["view", "add", "edit", "delete"] },
            { key: "User Type Permissions", label: "User Type Permissions", actions: ["view", "add", "edit"] },
        ],
    },
];

export function buildEmptyPermissions(
    modules: ModuleConfig[] = PERMISSION_MODULES
): Record<string, any> {
    const result: Record<string, any> = {};

    for (const mod of modules) {
        const node: Record<string, any> = {};

        for (const action of mod.actions) {
            node[action] = false;
        }

        if (mod.children) {
            Object.assign(node, buildEmptyPermissions(mod.children));
        }

        result[mod.key] = node;
    }

    return result;
}