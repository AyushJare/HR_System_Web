"use client";

import { useEffect, useState } from "react";

interface SummaryRow {
  employeeId: string;
  employeeCode: number;
  fullName: string;
  department: string;
  present: number;
  absent: number;
  halfDay: number;
  onLeave: number;
  totalMarked: number;
}

interface ConsolidatedData {
  daysInMonth: number;
  rows: { employeeId: string; employeeCode: number; fullName: string; days: string[] }[];
}

const statusLabel: Record<string, string> = {
  P: "Present",
  A: "Absent",
  H: "Half Day",
  L: "On Leave",
  "-": "Not marked",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"summary" | "consolidated">("summary");
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [consolidated, setConsolidated] = useState<ConsolidatedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "summary") {
      fetch(`/api/reports/summary?month=${month}`)
        .then((r) => r.json())
        .then(setSummary)
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/reports/consolidated?month=${month}`)
        .then((r) => r.json())
        .then(setConsolidated)
        .finally(() => setLoading(false));
    }
  }, [tab, month]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-950 tracking-tight">Reports</h1>
        <p className="text-slate-500 mt-2 font-normal text-sm">Attendance summary and consolidated views.</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-6 border-b border-slate-200">
          <button
            onClick={() => setTab("summary")}
            className={
              tab === "summary"
                ? "pb-3 text-sm font-semibold text-slate-900 border-b-2 border-slate-900 transition-colors duration-200"
                : "pb-3 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200"
            }
          >
            Summary
          </button>
          <button
            onClick={() => setTab("consolidated")}
            className={
              tab === "consolidated"
                ? "pb-3 text-sm font-semibold text-slate-900 border-b-2 border-slate-900 transition-colors duration-200"
                : "pb-3 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200"
            }
          >
            Consolidated
          </button>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
        />
      </div>

      {tab === "summary" && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Employee</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Department</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Present</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Absent</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Half Day</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">On Leave</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Total Marked</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              )}
              {!loading && summary.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No data for this month.</td></tr>
              )}
              {summary.map((row) => (
                <tr key={row.employeeId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200">
                  <td className="px-6 py-3 text-slate-900 font-medium">
                    {row.fullName} <span className="text-slate-500 text-xs">#{row.employeeCode}</span>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{row.department}</td>
                  <td className="px-6 py-3 text-center text-emerald-700 font-semibold">{row.present}</td>
                  <td className="px-6 py-3 text-center text-red-700 font-semibold">{row.absent}</td>
                  <td className="px-6 py-3 text-center text-amber-700 font-semibold">{row.halfDay}</td>
                  <td className="px-6 py-3 text-center text-blue-700 font-semibold">{row.onLeave}</td>
                  <td className="px-6 py-3 text-center text-slate-900 font-semibold">{row.totalMarked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "consolidated" && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto shadow-sm hover:shadow-md transition-shadow duration-200">
          {loading && <div className="p-8 text-center text-slate-500">Loading...</div>}
          {!loading && consolidated && (
            <table className="text-sm border-collapse">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide sticky left-0 bg-slate-50 whitespace-nowrap">
                    Employee
                  </th>
                  {Array.from({ length: consolidated.daysInMonth }, (_, i) => (
                    <th key={i} className="text-center px-2 py-4 text-xs font-bold text-slate-950 w-8">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidated.rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200">
                    <td className="px-6 py-3 text-slate-900 font-medium sticky left-0 bg-white hover:bg-slate-50 whitespace-nowrap">
                      {row.fullName} <span className="text-slate-500 text-xs">#{row.employeeCode}</span>
                    </td>
                    {row.days.map((code, i) => (
                      <td
                        key={i}
                        title={statusLabel[code] ?? code}
                        className={
                          "text-center px-2 py-3 text-xs font-semibold " +
                          (code === "P"
                            ? "text-emerald-700"
                            : code === "A"
                              ? "text-red-700"
                              : code === "H"
                                ? "text-amber-700"
                                : code === "L"
                                  ? "text-blue-700"
                                  : "text-slate-300")
                        }
                      >
                        {code}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="mt-4 text-xs text-slate-500">
        P = Present &nbsp; A = Absent &nbsp; H = Half Day &nbsp; L = On Leave &nbsp; — = Not marked
      </div>
    </div>
  );
}