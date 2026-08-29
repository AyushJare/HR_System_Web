"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import PermissionEditor from "../PermissionEditor";
import {
    PERMISSION_MODULES,
    buildEmptyPermissions,
} from "@/lib/permissionModules";
import { usePermission } from "@/lib/hooks/userPermission";

export default function AddUserTypePage() {
    const router = useRouter();

    const {
        hasPermission,
        loading: permissionLoading,
        error: permissionError,
    } = usePermission("Access Control", "add");

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [permissions, setPermissions] = useState(
        buildEmptyPermissions()
    );
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }

        setSaving(true);

        try {
            const res = await fetch("/api/user-types", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    description,
                    permissions,
                }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(
                    json.error || "Failed to create"
                );
            }

            toast.success("User type created");
            router.push("/admin/access-control");
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to create"
            );
        } finally {
            setSaving(false);
        }
    };

    // Permission loading state
    if (permissionLoading) {
        return (
            <div className="p-8">
                <div className="text-center py-12 text-slate-500">
                    Loading permissions...
                </div>
            </div>
        );
    }

    // Permission denied state
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
                        You don't have permission to add User Types.
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                        Please contact your administrator if you need
                        access.
                    </p>

                    <button
                        onClick={() =>
                            router.push("/admin/access-control")
                        }
                        className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all"
                    >
                        Back to Access Control
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">
                Add User Type
            </h1>

            <form
                onSubmit={handleSubmit}
                className="space-y-6"
            >
                <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            User Type *
                        </label>

                        <input
                            value={name}
                            onChange={(e) =>
                                setName(e.target.value)
                            }
                            className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description
                        </label>

                        <input
                            value={description}
                            onChange={(e) =>
                                setDescription(e.target.value)
                            }
                            className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <PermissionEditor
                    modules={PERMISSION_MODULES}
                    value={permissions}
                    onChange={setPermissions}
                />

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2 rounded-md disabled:opacity-60"
                    >
                        {saving
                            ? "Saving..."
                            : "Create User Type"}
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            router.push("/admin/access-control")
                        }
                        className="text-sm font-medium text-slate-600 px-5 py-2"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
