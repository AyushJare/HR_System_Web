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
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <span className="font-semibold text-slate-800">HR Management</span>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active
                  ? "block px-6 py-2.5 text-sm font-medium transition bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                  : "block px-6 py-2.5 text-sm font-medium transition text-slate-600 hover:bg-slate-50"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
          <p className="text-xs text-slate-500 mb-3">{user.role}</p>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
