"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PermissionGate from "../PermissionGate";

interface AttendanceRow {
  employeeId: string;
  employeeCode: number;
  fullName: string;
  attendance: {
    id: string;
    timeIn: string | null;
    timeOut: string | null;
    status: string;
    reason: string | null;
    workedMinutes?: number | null;
    workedDuration?: string | null;
  } | null;
}

type Draft = {
  timeIn: string;
  timeOut: string;
  reason: string;
  status: string;
};

type DraftMap = Record<string, Draft>;

type UserRole = "ADMIN" | "EMPLOYEE";

function getLocalDateString(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toTimeInputValue(iso: string | null): string {
  if (!iso) return "";

  const d = new Date(iso);

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${hh}:${mm}`;
}

function calculateWorkedDuration(
  timeIn: string | null,
  timeOut: string | null
): string | null {
  if (!timeIn || !timeOut) {
    return null;
  }

  const start = new Date(timeIn).getTime();
  const end = new Date(timeOut).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return null;
  }

  const totalMinutes = Math.floor(
    (end - start) / (1000 * 60)
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export default function AttendancePage() {
  const today = getLocalDateString();

  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("EMPLOYEE");

  // Search is only used for admin/full attendance management view.
  const [searchTerm, setSearchTerm] = useState("");

  const load = async (d: string) => {
    setLoading(true);

    try {
      const res = await fetch(`/api/attendance?date=${d}`);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to load attendance"
        );
      }

      const rowsData = Array.isArray(data)
        ? data
        : data?.employees;

      if (!Array.isArray(rowsData)) {
        throw new Error("Invalid attendance response");
      }

      setRows(rowsData);

      if (data?.role === "ADMIN" || data?.role === "EMPLOYEE") {
        setUserRole(data.role);
      }

      const nextDrafts: DraftMap = {};

      rowsData.forEach((row: AttendanceRow) => {
        nextDrafts[row.employeeId] = {
          timeIn: toTimeInputValue(
            row.attendance?.timeIn ?? null
          ),
          timeOut: toTimeInputValue(
            row.attendance?.timeOut ?? null
          ),
          reason: row.attendance?.reason ?? "",
          status: row.attendance?.status ?? "PRESENT",
        };
      });

      setDrafts(nextDrafts);
    } catch (error) {
      console.error("Attendance load error:", error);

      setRows([]);
      setDrafts({});

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load attendance"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const updateDraft = (
    employeeId: string,
    field: "timeIn" | "timeOut" | "reason" | "status",
    value: string
  ) => {
    setDrafts((prev: DraftMap) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  /*
   * ============================================================
   * ADMIN SAVE
   * ============================================================
   *
   * Existing manual attendance functionality is preserved.
   */
  const handleSave = async (employeeId: string) => {
    setSavingId(employeeId);

    const draft = drafts[employeeId];

    if (!draft) {
      setSavingId(null);
      return;
    }

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          date,
          timeIn: draft.timeIn || null,
          timeOut: draft.timeOut || null,
          status: draft.status,
          reason: draft.reason || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to save attendance"
        );
      }

      toast.success("Attendance saved");

      await load(date);
    } catch (error) {
      console.error("Attendance save error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save attendance"
      );
    } finally {
      setSavingId(null);
    }
  };

  /*
   * ============================================================
   * EMPLOYEE LOGIN / LOGOUT
   * ============================================================
   *
   * LOGIN:
   *   Server records the actual current time as Time In.
   *
   * LOGOUT:
   *   Server records the actual current time as Time Out.
   */
  const handleEmployeeAttendance = async (
    employeeId: string,
    action: "LOGIN" | "LOGOUT"
  ) => {
    setSavingId(employeeId);

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          date,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
          `Failed to ${action === "LOGIN" ? "log in" : "log out"
          }`
        );
      }

      if (action === "LOGIN") {
        toast.success("Logged in successfully");
      } else {
        toast.success("Logged out successfully");
      }

      await load(date);
    } catch (error) {
      console.error(
        `Attendance ${action.toLowerCase()} error:`,
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${action === "LOGIN" ? "log in" : "log out"
          }`
      );
    } finally {
      setSavingId(null);
    }
  };

  const isEmployee = userRole === "EMPLOYEE";
  const isAdmin = userRole === "ADMIN";
  const isToday = date === today;

  /*
   * ============================================================
   * ADMIN SEARCH
   * ============================================================
   *
   * Searches by:
   *   - Employee full name
   *   - Employee code
   *
   * This filters the already-loaded rows, so no extra API
   * request is needed while typing.
   */
  const normalizedSearch = searchTerm
    .trim()
    .toLowerCase();

  const filteredRows = isAdmin
    ? rows.filter((row) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        row.fullName
          .toLowerCase()
          .includes(normalizedSearch) ||
        String(row.employeeCode).includes(
          normalizedSearch
        )
      );
    })
    : rows;

  return (
    <PermissionGate moduleName="Attendance" action="view">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
            Daily Attendance
          </h1>

          <p className="text-slate-500 mt-2 font-normal text-sm">
            {isEmployee
              ? "Log in and log out for your attendance."
              : "Mark or update attendance for a specific date."}
          </p>
        </div>

        {/* =====================================================
            DATE + ADMIN SEARCH
            ===================================================== */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-semibold text-slate-900">
            Date
          </label>

          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);

              // Clear search when changing attendance date.
              if (isAdmin) {
                setSearchTerm("");
              }
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
          />

          {isAdmin && (
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                placeholder="Search employee name or code..."
                aria-label="Search employee"
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear employee search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-lg leading-none transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {/* =====================================================
            ATTENDANCE TABLE
            ===================================================== */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Employee
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
                  Reason
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  {isEmployee ? "Attendance" : "Save"}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Loading...
                  </td>
                </tr>
              )}

              {!loading &&
                filteredRows.length === 0 &&
                rows.length > 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No employees match your search.
                    </td>
                  </tr>
                )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No employees found.
                  </td>
                </tr>
              )}

              {filteredRows.map((row) => {
                const draft: Draft =
                  drafts[row.employeeId] ?? {
                    timeIn: "",
                    timeOut: "",
                    reason: "",
                    status: "PRESENT",
                  };

                const hasLoggedIn =
                  Boolean(row.attendance?.timeIn);

                const hasLoggedOut =
                  Boolean(row.attendance?.timeOut);

                const isProcessing =
                  savingId === row.employeeId;

                const workedDuration =
                  row.attendance?.workedDuration ??
                  calculateWorkedDuration(
                    row.attendance?.timeIn ?? null,
                    row.attendance?.timeOut ?? null
                  );

                /*
                 * Employee button state:
                 *
                 * No Time In  -> Log In
                 * Time In     -> Log Out
                 * Time Out    -> Log Out disabled
                 */
                const employeeButtonLabel =
                  isProcessing
                    ? "..."
                    : !hasLoggedIn
                      ? "Log In"
                      : "Log Out";

                const employeeButtonDisabled =
                  isProcessing ||
                  !isToday ||
                  hasLoggedOut;

                return (
                  <tr
                    key={row.employeeId}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-200 last:border-0"
                  >
                    <td className="px-6 py-3 text-slate-900">
                      <div className="font-semibold">
                        {row.fullName}
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5">
                        #{row.employeeCode}
                      </div>
                    </td>

                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            updateDraft(
                              row.employeeId,
                              "status",
                              e.target.value
                            )
                          }
                          disabled={isEmployee}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                        >
                          <option value="PRESENT">
                            Present
                          </option>

                          <option value="ABSENT">
                            Absent
                          </option>

                          <option value="HALF_DAY">
                            Half Day
                          </option>

                          <option value="WORKED">
                            Worked
                          </option>

                          <option value="ON_LEAVE">
                            On Leave
                          </option>
                        </select>

                        {workedDuration && (
                          <span className="text-xs text-slate-500">
                            Worked: {workedDuration}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-3">
                      <input
                        type="time"
                        value={draft.timeIn}
                        onChange={(e) =>
                          updateDraft(
                            row.employeeId,
                            "timeIn",
                            e.target.value
                          )
                        }
                        disabled={isEmployee}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                      />
                    </td>

                    <td className="px-6 py-3">
                      <input
                        type="time"
                        value={draft.timeOut}
                        onChange={(e) =>
                          updateDraft(
                            row.employeeId,
                            "timeOut",
                            e.target.value
                          )
                        }
                        disabled={isEmployee}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                      />
                    </td>

                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={draft.reason}
                        onChange={(e) =>
                          updateDraft(
                            row.employeeId,
                            "reason",
                            e.target.value
                          )
                        }
                        disabled={isEmployee}
                        placeholder="Reason (optional)"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                      />
                    </td>

                    <td className="px-6 py-3">
                      {isEmployee ? (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() =>
                              handleEmployeeAttendance(
                                row.employeeId,
                                hasLoggedIn
                                  ? "LOGOUT"
                                  : "LOGIN"
                              )
                            }
                            disabled={
                              employeeButtonDisabled
                            }
                            className={
                              hasLoggedIn
                                ? "font-semibold text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                : "font-semibold text-sm text-green-600 hover:text-green-700 hover:bg-green-50 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            }
                          >
                            {employeeButtonLabel}
                          </button>

                          {!isToday && (
                            <span className="text-xs text-slate-400">
                              Today only
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleSave(row.employeeId)
                          }
                          disabled={
                            savingId === row.employeeId
                          }
                          className="text-slate-900 hover:text-slate-700 font-semibold text-sm hover:bg-slate-100 px-2 py-1 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingId === row.employeeId
                            ? "..."
                            : "Save"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PermissionGate>
  );
}