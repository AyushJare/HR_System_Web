"use client";

import { useEffect, useState } from "react";

export type PermissionAction =
    | "view"
    | "add"
    | "edit"
    | "delete"
    | "export"
    | "import";

interface UsePermissionResult {
    hasPermission: boolean;
    loading: boolean;
    error: string | null;
}

export function usePermission(
    moduleName: string,
    action: PermissionAction = "view"
): UsePermissionResult {
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function checkPermission() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch("/api/permissions/check", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        moduleName,
                        action,
                    }),
                });

                if (cancelled) return;

                if (!response.ok) {
                    setHasPermission(false);

                    if (response.status === 401) {
                        setError("Unauthorized");
                    } else if (response.status === 403) {
                        setError("Permission denied");
                    } else {
                        setError("Permission check failed");
                    }

                    return;
                }

                const data = await response.json();

                setHasPermission(data.hasPermission === true);
            } catch (err) {
                if (cancelled) return;

                setHasPermission(false);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Permission check failed"
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        checkPermission();

        return () => {
            cancelled = true;
        };
    }, [moduleName, action]);

    return {
        hasPermission,
        loading,
        error,
    };
}