"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "📊" },
  { label: "Employees", href: "/admin/employees", icon: "👥" },
  { label: "Attendance", href: "/admin/attendance", icon: "✓" },
  { label: "Masters", href: "/admin/masters", icon: "⚙️" },
  { label: "Approvals", href: "/admin/approvals", icon: "⏱️" },
  { label: "Audit Log", href: "/admin/audit-log", icon: "📋" },
  { label: "Reports", href: "/admin/reports", icon: "📈" },
];

type User = { fullName: string; email: string; role: string };

export default function AdminShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Premium Sidebar - FIXED */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col shadow-2xl border-r border-slate-800 z-50">
        {/* Brand Section */}
        <div className="h-20 flex items-center px-8 border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              HR
            </div>
            <div>
              <span className="font-bold text-sm text-white tracking-tight">HR</span>
              <span className="font-bold text-sm text-slate-400 tracking-tight ml-1.5">Management</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
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
                <span className="text-lg group-hover:scale-110 transition-transform">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {active && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-lg">●</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-slate-800/40 bg-gradient-to-t from-slate-950 to-slate-900/50">
          <div className="mb-3 pb-3 border-b border-slate-800/40">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-500/30 flex items-center justify-center text-white font-bold text-sm">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/40 rounded-lg text-xs font-semibold text-emerald-300">
              <span>{user.role === "ADMIN" ? "🔑" : "👤"}</span>
              <span>{user.role === "ADMIN" ? "Admin" : "Employee"}</span>
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

      {/* Main Content - Scrollable with margin to account for fixed sidebar */}
      <main className="ml-72 flex-1 overflow-y-auto h-screen bg-white">
        {children}
      </main>
    </div>
  );
}