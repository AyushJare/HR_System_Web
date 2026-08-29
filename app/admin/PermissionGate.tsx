"use client";

import { useRouter } from "next/navigation";
import { usePermission, PermissionAction } from "@/lib/hooks/userPermission";

interface Props {
    moduleName: string;
    action?: PermissionAction;
    children: React.ReactNode;
}

export default function PermissionGate({
    moduleName,
    action = "view",
    children,
}: Props) {
    const router = useRouter();
    const { hasPermission, loading, error } = usePermission(moduleName, action);

    if (loading) {
        return (
            <div className="p-8">
                <div className="text-center py-12 text-slate-500">
                    Loading permissions...
                </div>
            </div>
        );
    }

    if (error || !hasPermission) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-8">
                <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <span className="text-2xl text-red-600">!</span>
                    </div>

                    <h1 className="text-2xl font-bold text-slate-950">
                        Access Denied
                    </h1>

                    <p className="mt-3 text-slate-600">
                        You don't have permission to view {moduleName}.
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                        Please contact your administrator if you need access.
                    </p>

                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}