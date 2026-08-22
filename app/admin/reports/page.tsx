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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-600 mt-1">Attendance summary and consolidated views.</p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-6 border-b border-slate-200">
          <button
            onClick={() => setTab("summary")}
            className={
              tab === "summary"
                ? "pb-3 text-sm font-medium text-blue-700 border-b-2 border-blue-700"
                : "pb-3 text-sm font-medium text-slate-500 hover:text-slate-700"
            }
          >
            Summary
          </button>
          <button
            onClick={() => setTab("consolidated")}
            className={
              tab === "consolidated"
                ? "pb-3 text-sm font-medium text-blue-700 border-b-2 border-blue-700"
                : "pb-3 text-sm font-medium text-slate-500 hover:text-slate-700"
            }
          >
            Consolidated
          </button>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {tab === "summary" && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Department</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Present</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Absent</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Half Day</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">On Leave</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Total Marked</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              )}
              {!loading && summary.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No data for this month.</td></tr>
              )}
              {summary.map((row) => (
                <tr key={row.employeeId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-slate-700">
                    {row.fullName} <span className="text-slate-400 text-xs">#{row.employeeCode}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{row.department}</td>
                  <td className="px-4 py-2.5 text-center text-green-700 font-medium">{row.present}</td>
                  <td className="px-4 py-2.5 text-center text-red-700 font-medium">{row.absent}</td>
                  <td className="px-4 py-2.5 text-center text-amber-700 font-medium">{row.halfDay}</td>
                  <td className="px-4 py-2.5 text-center text-blue-700 font-medium">{row.onLeave}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{row.totalMarked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "consolidated" && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          {loading && <div className="p-8 text-center text-slate-400">Loading...</div>}
          {!loading && consolidated && (
            <table className="text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 sticky left-0 bg-slate-50 whitespace-nowrap">
                    Employee
                  </th>
                  {Array.from({ length: consolidated.daysInMonth }, (_, i) => (
                    <th key={i} className="text-center px-2 py-3 font-medium text-slate-500 w-8">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidated.rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                      {row.fullName} <span className="text-slate-400 text-xs">#{row.employeeCode}</span>
                    </td>
                    {row.days.map((code, i) => (
                      <td
                        key={i}
                        title={statusLabel[code] ?? code}
                        className={
                          "text-center px-2 py-2 text-xs font-medium " +
                          (code === "P"
                            ? "text-green-700"
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