"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: "📊",
    moduleName: "Dashboard",
  },
  {
    label: "Employees",
    href: "/admin/employees",
    icon: "👥",
    moduleName: "Employee",
  },
  {
    label: "Attendance",
    href: "/admin/attendance",
    icon: "✓",
    moduleName: "Attendance",
  },
  {
    label: "Masters",
    href: "/admin/masters",
    icon: "⚙️",
    moduleName: "Masters",
  },
  {
    label: "Approvals",
    href: "/admin/approvals",
    icon: "⏱️",
    moduleName: "Approvals",
  },
  {
    label: "Audit Log",
    href: "/admin/audit-log",
    icon: "📋",
    moduleName: "Audit Log",
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: "📈",
    moduleName: "Reports",
  },
  {
    label: "Access Control",
    href: "/admin/access-control",
    icon: "🔐",
    moduleName: "Access Control",
  },
];

type User = {
  fullName: string;
  email: string;
  role: string;
};

type Permissions = Record<string, unknown> | null;

export default function AdminShell({
  user,
  permissions,
  children,
}: {
  user: User;
  permissions: Permissions;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [visibleModules, setVisibleModules] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const isAdmin = user.role === "ADMIN";

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      if (isAdmin) {
        setVisibleModules(navItems.map((item) => item.moduleName));
        setPermissionsLoading(false);
        return;
      }

      try {
        setPermissionsLoading(true);

        const results = await Promise.all(
          navItems.map(async (item) => {
            try {
              const response = await fetch("/api/permissions/check", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                  moduleName: item.moduleName,
                  action: "view",
                }),
              });

              if (!response.ok) {
                return null;
              }

              const data = await response.json();

              return data.hasPermission === true
                ? item.moduleName
                : null;
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setVisibleModules(
            results.filter(
              (module): module is string => module !== null
            )
          );
        }
      } finally {
        if (!cancelled) {
          setPermissionsLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const visibleNavItems = navItems.filter((item) =>
    visibleModules.includes(item.moduleName)
  );

  async function handleLogout() {
    setLoggingOut(true);

    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col shadow-2xl border-r border-slate-800 z-50">
        {/* Brand */}
        <div className="h-20 flex items-center px-8 border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              HR
            </div>

            <div>
              <span className="font-bold text-sm text-white tracking-tight">
                HR
              </span>

              <span className="font-bold text-sm text-slate-400 tracking-tight ml-1.5">
                Management
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
          {permissionsLoading ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              Loading menu...
            </div>
          ) : visibleNavItems.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              No modules available
            </div>
          ) : (
            visibleNavItems.map((item) => {
              const active = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group relative
                    ${active
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/40"
                    }
                  `}
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">
                    {item.icon}
                  </span>

                  <span className="flex-1">
                    {item.label}
                  </span>

                  {active && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-lg">
                        ●
                      </span>
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800/40 bg-gradient-to-t from-slate-950 to-slate-900/50">
          <div className="mb-3 pb-3 border-b border-slate-800/40">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-500/30 flex items-center justify-center text-white font-bold text-sm">
                {user.fullName.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {user.fullName}
                </p>

                <p className="text-xs text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/40 rounded-lg text-xs font-semibold text-emerald-300">
              <span>
                {user.role === "ADMIN" ? "🔑" : "👤"}
              </span>

              <span>
                {user.role === "ADMIN" ? "Admin" : "Employee"}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all duration-200 border border-red-500/30 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-72 flex-1 overflow-y-auto h-screen bg-white">
        {children}
      </main>
    </div>
  );
}