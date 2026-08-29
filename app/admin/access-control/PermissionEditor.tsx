"use client";

import { ModuleConfig } from "@/lib/permissionModules";

type PermValue = Record<string, any>;

interface Props {
    modules: ModuleConfig[];
    value: PermValue;
    onChange: (next: PermValue) => void;
    depth?: number;
}

/**
 * Applies `patch` (e.g. { view: true }) to every descendant of `mod`
 * whose config declares that action. Actions that a descendant doesn't
 * support are ignored so we never inject invalid keys.
 */
function cascadePatch(
    mod: ModuleConfig,
    node: Record<string, any>,
    patch: Record<string, boolean>
): Record<string, any> {
    const next: Record<string, any> = { ...node };

    if (!mod.children) return next;

    for (const child of mod.children) {
        const childNode = (next[child.key] ?? {}) as Record<string, any>;
        const applicable: Record<string, boolean> = {};

        for (const [action, val] of Object.entries(patch)) {
            if (child.actions.includes(action)) {
                applicable[action] = val;
            }
        }

        const merged = { ...childNode, ...applicable };
        next[child.key] = cascadePatch(child, merged, patch);
    }

    return next;
}

export default function PermissionEditor({
    modules,
    value,
    onChange,
    depth = 0,
}: Props) {
    const updateModule = (
        mod: ModuleConfig,
        patch: Record<string, boolean>
    ) => {
        const currentNode = (value[mod.key] ?? {}) as Record<string, any>;
        const withAction = { ...currentNode, ...patch };
        const withCascade = cascadePatch(mod, withAction, patch);

        onChange({ ...value, [mod.key]: withCascade });
    };

    const updateOther = (
        key: string,
        otherKey: string,
        checked: boolean
    ) => {
        const node = value[key] ?? {};
        onChange({
            ...value,
            [key]: {
                ...node,
                other: { ...(node.other ?? {}), [otherKey]: checked },
            },
        });
    };

    return (
        <div className={depth > 0 ? "ml-6 mt-2 space-y-3" : "space-y-3"}>
            {modules.map((mod) => {
                const node = value[mod.key] ?? {};

                return (
                    <div
                        key={mod.key}
                        className="border border-slate-200 rounded-lg p-4 bg-white"
                    >
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <span className="font-semibold text-slate-800">
                                {mod.label}
                            </span>

                            <div className="flex gap-4 flex-wrap">
                                {mod.actions.map((action) => (
                                    <label
                                        key={action}
                                        className="flex items-center gap-1.5 text-sm text-slate-600"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!node[action]}
                                            onChange={(e) =>
                                                updateModule(mod, {
                                                    [action]: e.target.checked,
                                                })
                                            }
                                            className="rounded border-slate-300"
                                        />
                                        {action.charAt(0).toUpperCase() +
                                            action.slice(1)}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {mod.other && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                                <p className="text-xs font-medium text-blue-700 mb-2">
                                    Other Access
                                </p>
                                <div className="flex gap-4 flex-wrap">
                                    {mod.other.map((o) => (
                                        <label
                                            key={o}
                                            className="flex items-center gap-1.5 text-sm text-slate-600"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!!node.other?.[o]}
                                                onChange={(e) =>
                                                    updateOther(
                                                        mod.key,
                                                        o,
                                                        e.target.checked
                                                    )
                                                }
                                                className="rounded border-slate-300"
                                            />
                                            {o}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mod.children && (
                            <PermissionEditor
                                modules={mod.children}
                                value={node}
                                onChange={(childNext) =>
                                    onChange({
                                        ...value,
                                        [mod.key]: { ...node, ...childNext },
                                    })
                                }
                                depth={depth + 1}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
