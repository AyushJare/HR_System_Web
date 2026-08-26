"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (!data) return <div className="p-8 text-red-600">Failed to load dashboard.</div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-950 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-2 font-normal text-sm">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {data.todayStatus !== "WORKING_DAY" && (
        <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm px-4 py-3">
          <span className="font-medium">
            {data.todayStatus === "WEEK_OFF"
              ? "Today is a Week Off"
              : `Today is a Holiday: ${data.todayHolidayName}`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-8">
        {/* Active Employees Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Active</div>
          <div className="text-3xl font-bold text-slate-950">{data.activeEmployeeCount}</div>
          <div className="text-xs text-slate-500 mt-2">Employees</div>
        </div>

        {/* Present Today Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-2">Present</div>
          <div className="text-3xl font-bold text-emerald-700">
            {data.todayStatus === "WORKING_DAY" ? data.counts.present : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-2">Today</div>
        </div>

        {/* Absent Today Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">Absent</div>
          <div className="text-3xl font-bold text-red-700">
            {data.todayStatus === "WORKING_DAY" ? data.counts.absent : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-2">Today</div>
        </div>

        {/* On Leave Today Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">On Leave</div>
          <div className="text-3xl font-bold text-blue-700">
            {data.todayStatus === "WORKING_DAY" ? data.counts.onLeave : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-2">Today</div>
        </div>

        {/* Pending Approvals Card - Clickable */}
        <button
          onClick={() => router.push("/admin/approvals")}
          className="bg-white rounded-lg border border-slate-200 p-6 text-left hover:shadow-md hover:border-amber-300 transition-all duration-200 group"
        >
          <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-2 group-hover:text-amber-700">Pending</div>
          <div className="text-3xl font-bold text-amber-700">{data.pendingApprovalsCount}</div>
          <div className="text-xs text-slate-500 mt-2 group-hover:text-slate-600">Approvals</div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Pending Approvals Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-900 rounded-full"></div>
            <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Pending Approvals</h2>
          </div>
          {data.pendingApprovals.length === 0 && (
            <p className="text-sm text-slate-500 italic">No pending requests.</p>
          )}
          <ul className="space-y-3">
            {data.pendingApprovals.map((a) => (
              <li key={a.id} className="text-sm border-l-2 border-slate-100 pl-3">
                <div className="font-semibold text-slate-950">{a.actor.fullName}</div>
                <div className="text-slate-500 text-xs mt-0.5">
                  {a.type === "LEAVE" ? "Leave request" : "Attendance correction"} · {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
          {data.pendingApprovals.length > 0 && (
            <button
              onClick={() => router.push("/admin/approvals")}
              className="text-xs font-semibold text-slate-900 hover:text-slate-700 mt-4 hover:underline"
            >
              View all →
            </button>
          )}
        </div>

        {/* Upcoming Holidays Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-900 rounded-full"></div>
            <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Upcoming Holidays</h2>
          </div>
          {data.upcomingHolidays.length === 0 && (
            <p className="text-sm text-slate-500 italic">No upcoming holidays.</p>
          )}
          <ul className="space-y-3">
            {data.upcomingHolidays.map((h) => (
              <li key={h.id} className="text-sm flex justify-between items-center">
                <span className="font-medium text-slate-900">{h.name}</span>
                <span className="text-slate-500 text-xs">
                  {new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-900 rounded-full"></div>
            <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Recent Activity</h2>
          </div>
          <ul className="space-y-3">
            {data.recentLogs.map((log) => (
              <li key={log.id} className="text-sm">
                <div className="font-medium text-slate-900">{formatAction(log.action)}</div>
                <div className="text-slate-500 text-xs mt-0.5">
                  {log.employee?.fullName ?? "System"} · {new Date(log.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.push("/admin/audit-log")}
            className="text-xs font-semibold text-slate-900 hover:text-slate-700 mt-4 hover:underline"
          >
            View full log →
          </button>
        </div>
      </div>
    </div>
  );
}