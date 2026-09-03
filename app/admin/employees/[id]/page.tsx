"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePermission } from "@/lib/hooks/userPermission";

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
  PRESENT:
    "bg-emerald-50 text-emerald-700 border-emerald-200",

  ABSENT:
    "bg-red-50 text-red-700 border-red-200",

  HALF_DAY:
    "bg-amber-50 text-amber-700 border-amber-200",

  ON_LEAVE:
    "bg-blue-50 text-blue-700 border-blue-200",

  ON_LEAVE_SCHEDULED:
    "bg-blue-50 text-blue-500 border-blue-100 border-dashed",

  WEEK_OFF:
    "bg-slate-50 text-slate-400 border-slate-100",

  HOLIDAY:
    "bg-slate-100 text-slate-700 border-slate-200",

  FUTURE:
    "bg-white text-slate-300 border-slate-100",

  NOT_MARKED:
    "bg-white text-slate-400 border-slate-200 border-dashed",
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

  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function currentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  /*
   * ==========================================================
   * PERMISSIONS
   * ==========================================================
   */

  const {
    hasPermission: canViewAttendanceSummary,
    loading: attendanceSummaryViewLoading,
  } = usePermission(
    "Employee Attendance Summary",
    "view"
  );

  const {
    hasPermission: canExportAttendanceSummary,
    loading: attendanceSummaryExportLoading,
  } = usePermission(
    "Employee Attendance Summary",
    "export"
  );

  const [month, setMonth] = useState(currentMonth());

  const [data, setData] =
    useState<SummaryData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * ==========================================================
   * LOAD ATTENDANCE SUMMARY
   * ==========================================================
   */

  useEffect(() => {
    /*
     * Wait until permission checking is complete.
     */
    if (attendanceSummaryViewLoading) {
      return;
    }

    /*
     * Do not request attendance summary if the
     * current user does not have permission.
     */
    if (!canViewAttendanceSummary) {
      setLoading(false);
      setData(null);
      setError(
        "You don't have permission to view this employee's attendance summary."
      );
      return;
    }

    let cancelled = false;

    const loadAttendanceSummary =
      async () => {
        try {
          setLoading(true);
          setError("");

          const response =
            await fetch(
              `/api/employees/${id}/attendance-summary?month=${month}`
            );

          if (!response.ok) {
            const errorData =
              await response
                .json()
                .catch(() => null);

            throw new Error(
              errorData?.error ||
              "Failed to load attendance summary"
            );
          }

          const result =
            await response.json();

          if (!cancelled) {
            setData(result);
          }
        } catch (error) {
          if (!cancelled) {
            setError(
              error instanceof Error
                ? error.message
                : "Failed to load attendance summary"
            );

            setData(null);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    loadAttendanceSummary();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    month,
    canViewAttendanceSummary,
    attendanceSummaryViewLoading,
  ]);

  /*
   * ==========================================================
   * EXPORT ATTENDANCE SUMMARY
   * ==========================================================
   */

  const handleExportAttendanceSummary =
    async () => {
      try {
        setError("");

        const response = await fetch(
          `/api/employees/${id}/attendance-summary/export?month=${month}`
        );

        if (!response.ok) {
          const errorData =
            await response
              .json()
              .catch(() => null);

          throw new Error(
            errorData?.error ||
            "Failed to export attendance summary"
          );
        }

        const blob =
          await response.blob();

        const url =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement("a");

        link.href = url;

        const safeName =
          data?.employee.fullName
            ?.replace(
              /[^a-zA-Z0-9-_]+/g,
              "_"
            )
            .replace(
              /^_+|_+$/g,
              ""
            ) || "employee";

        link.download =
          `${safeName}_Attendance_Summary_${month}.xlsx`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        window.URL.revokeObjectURL(
          url
        );
      } catch (error) {
        console.error(
          "Attendance summary export error:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to export attendance summary"
        );
      }
    };

  /*
   * ==========================================================
   * PERMISSION LOADING
   * ==========================================================
   */

  if (attendanceSummaryViewLoading) {
    return (
      <div className="p-8">
        <div className="text-slate-500">
          Checking permissions...
        </div>
      </div>
    );
  }

  /*
   * ==========================================================
   * NO VIEW PERMISSION
   * ==========================================================
   */

  if (!canViewAttendanceSummary) {
    return (
      <div className="p-8">
        <button
          onClick={() =>
            router.push("/admin/employees")
          }
          className="text-sm text-slate-900 hover:text-slate-700 font-semibold transition-colors duration-200"
        >
          ← Back to Employees
        </button>

        <div className="mt-8 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          You don't have permission to view this
          employee's attendance summary.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* =====================================================
          TOP NAVIGATION
          ===================================================== */}

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() =>
            router.push("/admin/employees")
          }
          className="text-sm text-slate-900 hover:text-slate-700 font-semibold transition-colors duration-200"
        >
          ← Back to Employees
        </button>

        <button
          onClick={() =>
            router.push(
              `/admin/employees/${id}/edit`
            )
          }
          className="text-sm font-semibold text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg px-4 py-2 transition-all duration-200"
        >
          Edit Employee
        </button>
      </div>

      {/* =====================================================
          LOADING / ERROR
          ===================================================== */}

      {loading && (
        <div className="text-slate-500">
          Loading...
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6 whitespace-pre-line">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* =================================================
              EMPLOYEE HEADER
              ================================================= */}

          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
                {data.employee.fullName}
              </h1>

              <p className="text-slate-500 mt-2 font-normal text-sm">
                #{data.employee.employeeCode}
                &nbsp;•&nbsp;
                {data.employee.email}

                {data.employee.department && (
                  <>
                    &nbsp;•&nbsp;
                    {data.employee.department.name}
                  </>
                )}

                {data.employee.designation && (
                  <>
                    &nbsp;•&nbsp;
                    {data.employee.designation.name}
                  </>
                )}
              </p>
            </div>

            {/* =============================================
                MONTH + EXPORT
                ============================================= */}

            <div className="flex items-center gap-3">
              <input
                type="month"
                value={month}
                onChange={(e) =>
                  setMonth(e.target.value)
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
              />

              {canExportAttendanceSummary && (
                <button
                  onClick={
                    handleExportAttendanceSummary
                  }
                  disabled={
                    attendanceSummaryExportLoading
                  }
                  className="text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg px-4 py-2 transition-all duration-200"
                >
                  {attendanceSummaryExportLoading
                    ? "Exporting..."
                    : "Export Excel"}
                </button>
              )}
            </div>
          </div>

          {/* =================================================
              SUMMARY CARDS
              ================================================= */}

          <div className="grid grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-emerald-700">
                {data.counts.present}
              </div>

              <div className="text-xs text-slate-500 mt-2">
                Present
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-red-700">
                {data.counts.absent}
              </div>

              <div className="text-xs text-slate-500 mt-2">
                Absent
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-amber-700">
                {data.counts.halfDay}
              </div>

              <div className="text-xs text-slate-500 mt-2">
                Half Day
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-blue-700">
                {data.counts.onLeave}
              </div>

              <div className="text-xs text-slate-500 mt-2">
                On Leave
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-slate-500">
                {data.counts.weekOff}
              </div>

              <div className="text-xs text-slate-500 mt-2">
                Week Off
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center">
              <div className="text-3xl font-bold text-slate-700">
                {data.counts.holiday}
              </div>

              <div className="text-xs text-slate-500 mt-2">
                Holiday
              </div>
            </div>
          </div>

          {/* =================================================
              ATTENDANCE TABLE
              ================================================= */}

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Date
                  </th>

                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Status
                  </th>

                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Time In
                  </th>

                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Time Out
                  </th>

                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Note
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.days.map((day) => (
                  <tr
                    key={day.day}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200"
                  >
                    <td className="px-6 py-3 text-slate-900 font-medium">
                      {day.dateStr}

                      <span className="text-slate-500 text-xs ml-2">
                        {
                          [
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ][day.dayOfWeek]
                        }
                      </span>
                    </td>

                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold border ${statusStyles[
                          day.status
                        ] ??
                          "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                      >
                        {statusLabels[
                          day.status
                        ] ?? day.status}
                      </span>
                    </td>

                    <td className="px-6 py-3 text-slate-600">
                      {formatTime(
                        day.timeIn
                      )}
                    </td>

                    <td className="px-6 py-3 text-slate-600">
                      {formatTime(
                        day.timeOut
                      )}
                    </td>

                    <td className="px-6 py-3 text-slate-600 text-xs">
                      {day.holidayName ??
                        day.reason ??
                        ""}
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