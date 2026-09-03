"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PermissionGate from "../PermissionGate";


interface DashboardData {
  activeEmployeeCount: number;
  todayStatus: "WEEK_OFF" | "HOLIDAY" | "WORKING_DAY";
  todayHolidayName: string | null;
  counts: { present: number; absent: number; halfDay: number; onLeave: number; notMarked: number };
  pendingApprovalsCount: number;
  pendingApprovals: {
    id: string;
    type: string;
    createdAt: string;
    actor: { fullName: string; employeeCode: number };
  }[];
  upcomingHolidays: { id: string; name: string; date: string }[];
  recentLogs: {
    id: string;
    action: string;
    createdAt: string;
    employee: { fullName: string } | null;
  }[];
}

function formatAction(action: string) {
  return action
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PermissionGate moduleName="Dashboard" action="view">
    <div className="p-12 text-slate-400">Loading...</div>;    </PermissionGate>

  if (!data) return <PermissionGate moduleName="Dashboard" action="view">
    <div className="p-12 text-red-400">Failed to load dashboard.</div>;    </PermissionGate>


  const attendancePercentage =
    data.activeEmployeeCount > 0
      ? Math.round(
        (data.counts.present / data.activeEmployeeCount) * 100
      )
      : 0;

  return (
    <PermissionGate moduleName="Dashboard" action="view">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
        {/* Decorative Blurs */}
        <div className="fixed top-20 right-0 w-96 h-96 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="fixed bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-300/20 to-blue-300/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          {/* Premium Header */}
          <div className="mb-12">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Daily Summary</div>
                <h1 className="text-4xl font-bold text-slate-950 tracking-tight mb-1 font-serif">
                  Dashboard
                </h1>
                <p className="text-slate-600 font-normal text-xs">
                  {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>

              {/* Glass Attendance Card */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                <div className="relative bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/60 shadow-xl">
                  <div className="text-xs text-slate-600 font-medium mb-2">Attendance Today</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">{attendancePercentage}%</div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-1 bg-white/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${attendancePercentage}%` }}
                      ></div>                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Alert */}
          {data.todayStatus !== "WORKING_DAY" && (
            <div className="mb-10 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl px-6 py-4 shadow-lg">
              <div className="flex items-center gap-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {data.todayStatus === "WEEK_OFF"
                      ? "Today is a Week Off"
                      : `Today is a Holiday: ${data.todayHolidayName}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KPI Section - Glass Cards */}
          <div className="grid grid-cols-5 gap-6 mb-10">
            {/* Total Employees */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-200 to-slate-300 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Total</div>
                <div className="text-4xl font-bold text-slate-900 mb-1">{data.activeEmployeeCount}</div>
                <div className="text-slate-600 text-xs font-medium mb-4">Active Employees</div>
                <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-slate-500 to-slate-600"></div>
                </div>
              </div>
            </div>

            {/* Present Today */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-300 to-green-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">Present</div>
                <div className="text-4xl font-bold text-emerald-600 mb-1">
                  {data.todayStatus === "WORKING_DAY" ? data.counts.present : "—"}
                </div>
                <div className="text-slate-600 text-xs font-medium mb-4">Today</div>
                <div className="h-1 bg-emerald-200 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-emerald-500 to-green-500"></div>
                </div>
              </div>
            </div>

            {/* Absent Today */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-300 to-pink-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-3">Absent</div>
                <div className="text-4xl font-bold text-red-600 mb-1">
                  {data.todayStatus === "WORKING_DAY" ? data.counts.absent : "—"}
                </div>
                <div className="text-slate-600 text-xs font-medium mb-4">Today</div>
                <div className="h-1 bg-red-200 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-red-500 to-pink-500"></div>
                </div>
              </div>
            </div>

            {/* On Leave */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-300 to-cyan-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Leave</div>
                <div className="text-4xl font-bold text-blue-600 mb-1">
                  {data.todayStatus === "WORKING_DAY" ? data.counts.onLeave : "—"}
                </div>
                <div className="text-slate-600 text-xs font-medium mb-4">Today</div>
                <div className="h-1 bg-blue-200 rounded-full overflow-hidden">
                  <div className="h-full w-1/4 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                </div>
              </div>
            </div>

            {/* Pending Approvals */}
            <button
              onClick={() => router.push("/admin/approvals")}
              className="group relative active:scale-95 transition-transform"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-300 to-orange-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300 text-left">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">Action</div>
                <div className="text-4xl font-bold text-amber-600 mb-1">{data.pendingApprovalsCount}</div>
                <div className="text-slate-600 text-xs font-medium mb-4">Pending Approvals</div>
                <div className="h-1 bg-amber-200 rounded-full overflow-hidden mb-3">
                  <div className="h-full w-3/4 bg-gradient-to-r from-amber-500 to-orange-500"></div>
                </div>
                <div className="text-xs text-slate-600 group-hover:text-amber-600 transition-colors font-medium">Review now →</div>
              </div>
            </button>
          </div>

          {/* Insights Section */}
          <div className="grid grid-cols-3 gap-6">
            {/* Pending Approvals */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-200 to-orange-300 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-300"></div>
              <div className="relative bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-7 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full"></div>
                  <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">Pending Approvals</h2>
                </div>
                {data.pendingApprovals.length === 0 && (
                  <p className="text-sm text-slate-600 italic py-10 text-center">All caught up! ✨</p>
                )}
                <ul className="space-y-4">
                  {data.pendingApprovals.slice(0, 3).map((a) => (
                    <li
                      key={a.id}
                      className="pb-4 border-b border-white/40 last:border-b-0 last:pb-0 group/item cursor-pointer"
                    >
                      <div className="font-semibold text-slate-950 group-hover/item:text-amber-700 transition-colors mb-0.5 text-sm">{a.actor.fullName}</div>
                      <div className="text-slate-600 text-xs font-medium">
                        {a.type === "LEAVE" ? "🏖️ Leave request" : "📝 Attendance correction"} · {new Date(a.createdAt).toLocaleDateString()}
                      </div>
                    </li>
                  ))}
                </ul>
                {data.pendingApprovals.length > 0 && (
                  <button
                    onClick={() => router.push("/admin/approvals")}
                    className="text-xs font-bold text-amber-700 hover:text-amber-600 mt-6 transition-colors"
                  >
                    View all ({data.pendingApprovals.length}) →
                  </button>
                )}
              </div>
            </div>

            {/* Upcoming Holidays */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-200 to-pink-300 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-300"></div>
              <div className="relative bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-7 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full"></div>
                  <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">Upcoming Holidays</h2>
                </div>
                {data.upcomingHolidays.length === 0 && (
                  <p className="text-sm text-slate-600 italic py-10 text-center">No holidays coming soon</p>
                )}
                <ul className="space-y-4">
                  {data.upcomingHolidays.slice(0, 3).map((h) => (
                    <li key={h.id} className="pb-4 border-b border-white/40 last:border-b-0 last:pb-0 flex justify-between items-start group/item cursor-default">
                      <span className="font-semibold text-slate-950 group-hover/item:text-purple-700 transition-colors text-sm">{h.name}</span>
                      <span className="text-xs font-medium text-slate-600 bg-white/60 group-hover/item:bg-purple-100 px-2 py-1 rounded-lg transition-colors">
                        {new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </li>
                  ))}
                </ul>
                {data.upcomingHolidays.length > 0 && (
                  <button
                    onClick={() => router.push("/admin/reports")}
                    className="text-xs font-bold text-purple-700 hover:text-purple-600 mt-6 transition-colors"
                  >
                    View calendar →
                  </button>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-200 to-cyan-300 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-300"></div>
              <div className="relative bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-7 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
                  <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider">Recent Activity</h2>
                </div>
                <ul className="space-y-4">
                  {data.recentLogs.slice(0, 4).map((log) => (
                    <li key={log.id} className="pb-4 border-b border-white/40 last:border-b-0 last:pb-0 group/item cursor-default">
                      <div className="font-semibold text-slate-950 group-hover/item:text-blue-700 transition-colors mb-0.5 text-sm">{formatAction(log.action)}</div>
                      <div className="text-slate-600 text-xs font-medium">
                        {log.employee?.fullName ?? "System"} · {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push("/admin/audit-log")}
                  className="text-xs font-bold text-blue-700 hover:text-blue-600 mt-6 transition-colors"
                >
                  View full log →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}