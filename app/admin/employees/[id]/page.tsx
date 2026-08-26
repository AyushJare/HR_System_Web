"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface DayEntry {
  day: number;
  dateStr: string;
  dayOfWeek: number;
  status: string;
  timeIn: string | null;
  timeOut: string | null;
  reason: string | null;
  holidayName: string | null;
}

interface SummaryData {
  employee: {
    fullName: string;
    employeeCode: number;
    email: string;
    department: { name: string } | null;
    designation: { name: string } | null;
  };
  daysInMonth: number;
  days: DayEntry[];
  counts: {
    present: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    weekOff: number;
    holiday: number;
    notMarked: number;
  };
}

const statusStyles: Record<string, string> = {
  PRESENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ABSENT: "bg-red-50 text-red-700 border-red-200",
  HALF_DAY: "bg-amber-50 text-amber-700 border-amber-200",
  ON_LEAVE: "bg-blue-50 text-blue-700 border-blue-200",
  ON_LEAVE_SCHEDULED: "bg-blue-50 text-blue-500 border-blue-100 border-dashed",
  WEEK_OFF: "bg-slate-50 text-slate-400 border-slate-100",
  HOLIDAY: "bg-slate-100 text-slate-700 border-slate-200",
  FUTURE: "bg-white text-slate-300 border-slate-100",
  NOT_MARKED: "bg-white text-slate-400 border-slate-200 border-dashed",
};

const statusLabels: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  ON_LEAVE: "On Leave",
  ON_LEAVE_SCHEDULED: "On Leave (scheduled)",
  WEEK_OFF: "Week Off",
  HOLIDAY: "Holiday",
  FUTURE: "—",
  NOT_MARKED: "Not Marked",
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/employees/${id}/attendance-summary?month=${month}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, month]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/admin/employees")}
          className="text-sm text-slate-900 hover:text-slate-700 font-semibold transition-colors duration-200"
        >
          ← Back to Employees
        </button>
        <button
          onClick={() => router.push(`/admin/employees/${id}/edit`)}
          className="text-sm font-semibold text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg px-4 py-2 transition-all duration-200"
        >
          Edit Employee
        </button>
      </div>

      {loading && <div className="text-slate-500">Loading...</div>}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-950 tracking-tight">{data.employee.fullName}</h1>
              <p className="text-slate-500 mt-2 font-normal text-sm">
                #{data.employee.employeeCode} &nbsp;•&nbsp; {data.employee.email}
                {data.employee.department && <> &nbsp;•&nbsp; {data.employee.department.name}</>}
                {data.employee.designation && <> &nbsp;•&nbsp; {data.employee.designation.name}</>}
              </p>
            </div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="grid grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-emerald-700">{data.counts.present}</div>
              <div className="text-xs text-slate-500 mt-2">Present</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-red-700">{data.counts.absent}</div>
              <div className="text-xs text-slate-500 mt-2">Absent</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-amber-700">{data.counts.halfDay}</div>
              <div className="text-xs text-slate-500 mt-2">Half Day</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-blue-700">{data.counts.onLeave}</div>
              <div className="text-xs text-slate-500 mt-2">On Leave</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-slate-500">{data.counts.weekOff}</div>
              <div className="text-xs text-slate-500 mt-2">Week Off</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-slate-700">{data.counts.holiday}</div>
              <div className="text-xs text-slate-500 mt-2">Holiday</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Date</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Time In</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Time Out</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => (
                  <tr key={day.day} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200">
                    <td className="px-6 py-3 text-slate-900 font-medium">
                      {day.dateStr}
                      <span className="text-slate-500 text-xs ml-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.dayOfWeek]}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold border ${statusStyles[day.status] ?? "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                      >
                        {statusLabels[day.status] ?? day.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{formatTime(day.timeIn)}</td>
                    <td className="px-6 py-3 text-slate-600">{formatTime(day.timeOut)}</td>
                    <td className="px-6 py-3 text-slate-600 text-xs">
                      {day.holidayName ?? day.reason ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}