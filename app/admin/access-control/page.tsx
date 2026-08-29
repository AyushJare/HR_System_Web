"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { usePermission } from "@/lib/hooks/userPermission";

interface UserTypeRow {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    _count: { employees: number };
}

export default function AccessControlPage() {
    const router = useRouter();

    // View permission
    const {
        hasPermission,
        loading: permissionLoading,
        error: permissionError,
    } = usePermission("Access Control", "view");

    // Action permissions
    const { hasPermission: canAdd } = usePermission(
        "Access Control",
        "add"
    );

    const { hasPermission: canEdit } = usePermission(
        "Access Control",
        "edit"
    );

    const { hasPermission: canDelete } = usePermission(
        "Access Control",
        "delete"
    );

    const [items, setItems] = useState<UserTypeRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            setLoading(true);

            const res = await fetch("/api/user-types");
            const json = await res.json();

            if (!res.ok) {
                toast.error(
                    json.error || "Failed to load user types"
                );
                return;
            }

            setItems(json.data ?? []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load user types");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!permissionLoading && hasPermission) {
            load();
        }
    }, [permissionLoading, hasPermission]);

    const handleDelete = async (
        id: string,
        name: string
    ) => {
        if (!confirm(`Delete "${name}"?`)) return;

        try {
            const res = await fetch(
                `/api/user-types/${id}`,
                {
                    method: "DELETE",
                }
            );

            const json = await res.json();

            if (!res.ok) {
                toast.error(
                    json.error || "Failed to delete"
                );
                return;
            }

            toast.success("Deleted");
            load();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete");
        }
    };

    // Permission loading
    if (permissionLoading) {
        return (
            <div className="p-8">
                <div className="text-center py-12 text-slate-500">
                    Loading permissions...
                </div>
            </div>
        );
    }

    // Permission denied
    if (permissionError || !hasPermission) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-8">
                <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <span className="text-2xl text-red-600">
                            !
                        </span>
                    </div>

                    <h1 className="text-2xl font-bold text-slate-950">
                        Access Denied
                    </h1>

                    <p className="mt-3 text-slate-600">
                        You don't have permission to view the
                        Access Control module.
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                        Please contact your administrator if you
                        need access.
                    </p>

                    <button
                        onClick={() =>
                            router.push("/admin/dashboard")
                        }
                        className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Access Control
                    </h1>

                    <p className="text-slate-600 mt-1">
                        Manage user types and their permissions
                    </p>
                </div>

                {/* Add permission */}
                {canAdd && (
                    <button
                        onClick={() =>
                            router.push(
                                "/admin/access-control/add"
                            )
                        }
                        className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2 rounded-md"
                    >
                        + Add User Type
                    </button>
                )}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-4 py-3 font-medium text-slate-600 w-32">
                                Action
                            </th>

                            <th className="text-left px-4 py-3 font-medium text-slate-600">
                                User Type
                            </th>

                            <th className="text-left px-4 py-3 font-medium text-slate-600">
                                Description
                            </th>

                            <th className="text-left px-4 py-3 font-medium text-slate-600">
                                Employees
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-4 py-8 text-center text-slate-400"
                                >
                                    Loading...
                                </td>
                            </tr>
                        )}

                        {!loading && items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-4 py-8 text-center text-slate-400"
                                >
                                    No user types yet.
                                </td>
                            </tr>
                        )}

                        {items.map((ut) => (
                            <tr
                                key={ut.id}
                                className="border-b border-slate-100 last:border-0"
                            >
                                <td className="px-4 py-3">
                                    {/* Edit permission */}
                                    {canEdit && (
                                        <button
                                            onClick={() =>
                                                router.push(
                                                    `/admin/access-control/${ut.id}/edit`
                                                )
                                            }
                                            className="text-blue-600 hover:text-blue-800 font-medium mr-3 text-xs"
                                        >
                                            Edit
                                        </button>
                                    )}

                                    {/* Delete permission */}
                                    {!ut.isSystem && canDelete && (
                                        <button
                                            onClick={() =>
                                                handleDelete(
                                                    ut.id,
                                                    ut.name
                                                )
                                            }
                                            className="text-red-600 hover:text-red-800 font-medium text-xs"
                                        >
                                            Delete
                                        </button>
                                    )}

                                    {/* No actions available */}
                                    {!canEdit &&
                                        (!ut.isSystem &&
                                            !canDelete) && (
                                            <span className="text-slate-400 text-xs">
                                                —
                                            </span>
                                        )}
                                </td>

                                <td className="px-4 py-3 text-slate-800 font-medium">
                                    {ut.name}

                                    {ut.isSystem && (
                                        <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                            System
                                        </span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-slate-600">
                                    {ut.description ?? "—"}
                                </td>

                                <td className="px-4 py-3 text-slate-600">
                                    {ut._count.employees}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}