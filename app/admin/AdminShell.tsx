"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Employees", href: "/admin/employees" },
  { label: "Attendance", href: "/admin/attendance" },
  { label: "Masters", href: "/admin/masters" },
  { label: "Approvals", href: "/admin/approvals" },
  { label: "Audit Log", href: "/admin/audit-log" },
  { label: "Reports", href: "/admin/reports" },
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
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r-2 border-slate-900 flex flex-col shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <span className="font-bold text-lg text-slate-950 tracking-tight">HR Management</span>
        </div>
        <nav className="flex-1 py-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "block px-6 py-3 text-sm font-semibold transition-all duration-200 bg-slate-50 text-slate-950 border-l-4 border-slate-900 ml-0"
                    : "block px-6 py-3 text-sm font-medium transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-4 border-transparent"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-950">{user.fullName}</p>
          <p className="text-xs text-slate-500 mb-3 mt-0.5">{user.role}</p>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-all duration-200"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-white">{children}</main>
    </div>
  );
}