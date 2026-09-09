"use client";

import { useEffect, useState } from "react";
import PermissionGate from "../PermissionGate";

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
  rows: {
    employeeId: string;
    employeeCode: number;
    fullName: string;
    days: string[];
    attendanceTimes: Record<
      string,
      {
        checkIn: string | null;
        checkOut: string | null;
      }
    >;
  }[];
}

const statusLabel: Record<string, string> = {
  P: "Present",
  A: "Absent",
  H: "Half Day",
  L: "On Leave",
  WO: "Weekly Off",
  "-": "Not marked",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatAttendanceTime(value: string | null) {
  if (!value) return "--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"summary" | "consolidated">("summary");
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [consolidated, setConsolidated] =
    useState<ConsolidatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [consolidatedSearch, setConsolidatedSearch] = useState("");

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

  const consolidatedRows =
    consolidated?.rows.filter((row) =>
      row.fullName
        .toLowerCase()
        .includes(consolidatedSearch.trim().toLowerCase())
    ) ?? [];

  return (
    <PermissionGate moduleName="Reports" action="view">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">
            Reports
          </h1>
          <p className="mt-2 text-sm font-normal text-slate-500">
            Attendance summary and consolidated views.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-6 border-b border-slate-200">
            <button
              onClick={() => setTab("consolidated")}
              className={
                tab === "consolidated"
                  ? "border-b-2 border-slate-900 pb-3 text-sm font-semibold text-slate-900 transition-colors duration-200"
                  : "pb-3 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
              }
            >
              Consolidated
            </button>

            <button
              onClick={() => setTab("summary")}
              className={
                tab === "summary"
                  ? "border-b-2 border-slate-900 pb-3 text-sm font-semibold text-slate-900 transition-colors duration-200"
                  : "pb-3 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
              }
            >
              Summary
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400"
            />

            <a
              href={`/api/reports/export?month=${month}`}
              className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-800"
            >
              Export Excel
            </a>
          </div>
        </div>

        {tab === "summary" && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-950">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-950">
                    Department
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-950">
                    Present
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-950">
                    Absent
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-950">
                    Half Day
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-950">
                    On Leave
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-950">
                    Total Marked
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      Loading...
                    </td>
                  </tr>
                )}

                {!loading && summary.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No data for this month.
                    </td>
                  </tr>
                )}

                {summary.map((row) => (
                  <tr
                    key={row.employeeId}
                    className="border-b border-slate-100 transition-colors duration-200 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {row.fullName}{" "}
                      <span className="text-xs text-slate-500">
                        #{row.employeeCode}
                      </span>
                    </td>

                    <td className="px-6 py-3 text-slate-600">
                      {row.department}
                    </td>

                    <td className="px-6 py-3 text-center font-semibold text-emerald-700">
                      {row.present}
                    </td>

                    <td className="px-6 py-3 text-center font-semibold text-red-700">
                      {row.absent}
                    </td>

                    <td className="px-6 py-3 text-center font-semibold text-amber-700">
                      {row.halfDay}
                    </td>

                    <td className="px-6 py-3 text-center font-semibold text-blue-700">
                      {row.onLeave}
                    </td>

                    <td className="px-6 py-3 text-center font-semibold text-slate-900">
                      {row.totalMarked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "consolidated" && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
            <div className="border-b border-slate-200 bg-white p-4">
              <input
                type="text"
                value={consolidatedSearch}
                onChange={(e) => setConsolidatedSearch(e.target.value)}
                placeholder="Search employee by name..."
                className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-slate-400"
              />
            </div>

            <div className="overflow-x-auto">
              {loading && (
                <div className="p-8 text-center text-slate-500">
                  Loading...
                </div>
              )}

              {!loading && consolidated && (
                <table className="border-collapse text-sm">
                  <thead className="border-b-2 border-slate-200 bg-slate-50">
                    <tr>
                      <th className="sticky left-0 whitespace-nowrap bg-slate-50 px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-950">
                        Employee
                      </th>

                      {Array.from(
                        { length: consolidated.daysInMonth },
                        (_, i) => (
                          <th
                            key={i}
                            className="w-8 px-2 py-4 text-center text-xs font-bold text-slate-950"
                          >
                            {i + 1}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {consolidatedRows.map((row) => (
                      <tr
                        key={row.employeeId}
                        className="border-b border-slate-100 transition-colors duration-200 last:border-0 hover:bg-slate-50"
                      >
                        <td className="sticky left-0 whitespace-nowrap bg-white px-6 py-3 font-medium text-slate-900 hover:bg-slate-50">
                          {row.fullName}{" "}
                          <span className="text-xs text-slate-500">
                            #{row.employeeCode}
                          </span>
                        </td>

                        {row.days.map((code, i) => {
                          const dayNumber = String(i + 1);
                          const times = row.attendanceTimes?.[dayNumber];

                          const showTime = code === "P" || code === "H";

                          const checkIn = formatAttendanceTime(
                            times?.checkIn ?? null
                          );

                          const checkOut = formatAttendanceTime(
                            times?.checkOut ?? null
                          );

                          return (
                            <td
                              key={i}
                              title={
                                showTime
                                  ? `${statusLabel[code] ?? code}\nClock In: ${checkIn}\nClock Out: ${checkOut}`
                                  : statusLabel[code] ?? code
                              }
                              className="px-1.5 py-2 text-center"
                            >
                              <div className="flex min-w-12 flex-col items-center justify-center">
                                <span
                                  className={
                                    "text-xs font-bold " +
                                    (code === "P"
                                      ? "text-emerald-700"
                                      : code === "A"
                                        ? "text-red-700"
                                        : code === "H"
                                          ? "text-amber-700"
                                          : code === "L"
                                            ? "text-blue-700"
                                            : code === "WO"
                                              ? "text-slate-500"
                                              : "text-slate-300")
                                  }
                                >
                                  {code}
                                </span>

                                {showTime && (
                                  <span className="mt-0.5 whitespace-nowrap text-[9px] font-medium leading-tight text-slate-400">
                                    {checkIn}
                                  </span>
                                )}

                                {showTime && (
                                  <span className="whitespace-nowrap text-[9px] font-medium leading-tight text-slate-400">
                                    {checkOut}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {!loading && consolidatedRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={consolidated.daysInMonth + 1}
                          className="px-6 py-8 text-center text-slate-500"
                        >
                          No employees found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 px-4 pb-4 text-xs text-slate-500">
              P = Present &nbsp; A = Absent &nbsp; H = Half Day &nbsp; L = On
              Leave &nbsp; WO = Weekly Off &nbsp; — = Not marked
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}