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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {data.todayStatus !== "WORKING_DAY" && (
        <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3">
          {data.todayStatus === "WEEK_OFF"
            ? "Today is a Week Off."
            : `Today is a Holiday: ${data.todayHolidayName}`}
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="text-2xl font-bold text-slate-900">{data.activeEmployeeCount}</div>
          <div className="text-sm text-slate-500 mt-1">Active Employees</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="text-2xl font-bold text-green-700">
            {data.todayStatus === "WORKING_DAY" ? data.counts.present : "—"}
          </div>
          <div className="text-sm text-slate-500 mt-1">Present Today</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="text-2xl font-bold text-red-700">
            {data.todayStatus === "WORKING_DAY" ? data.counts.absent : "—"}
          </div>
          <div className="text-sm text-slate-500 mt-1">Absent Today</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="text-2xl font-bold text-blue-700">
            {data.todayStatus === "WORKING_DAY" ? data.counts.onLeave : "—"}
          </div>
          <div className="text-sm text-slate-500 mt-1">On Leave Today</div>
        </div>
        <button
          onClick={() => router.push("/admin/approvals")}
          className="bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 p-5 text-left transition"
        >
          <div className="text-2xl font-bold text-amber-700">{data.pendingApprovalsCount}</div>
          <div className="text-sm text-amber-700 mt-1">Pending Approvals</div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Pending Approvals</h2>
          {data.pendingApprovals.length === 0 && (
            <p className="text-sm text-slate-400">No pending requests.</p>
          )}
          <ul className="space-y-3">
            {data.pendingApprovals.map((a) => (
              <li key={a.id} className="text-sm">
                <div className="text-slate-700 font-medium">{a.actor.fullName}</div>
                <div className="text-slate-500 text-xs">
                  {a.type === "LEAVE" ? "Leave request" : "Attendance correction"} ·{" "}
                  {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
          {data.pendingApprovals.length > 0 && (
            <button
              onClick={() => router.push("/admin/approvals")}
              className="text-xs text-blue-700 hover:underline mt-4"
            >
              View all →
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Upcoming Holidays</h2>
          {data.upcomingHolidays.length === 0 && (
            <p className="text-sm text-slate-400">No upcoming holidays.</p>
          )}
          <ul className="space-y-3">
            {data.upcomingHolidays.map((h) => (
              <li key={h.id} className="text-sm flex justify-between">
                <span className="text-slate-700">{h.name}</span>
                <span className="text-slate-500 text-xs">
                  {new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent Activity</h2>
          <ul className="space-y-3">
            {data.recentLogs.map((log) => (
              <li key={log.id} className="text-sm">
                <div className="text-slate-700">{formatAction(log.action)}</div>
                <div className="text-slate-400 text-xs">
                  {log.employee?.fullName ?? "System"} ·{" "}
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.push("/admin/audit-log")}
            className="text-xs text-blue-700 hover:underline mt-4"
          >
            View full log →
          </button>
        </div>
      </div>
    </div>
  );
}