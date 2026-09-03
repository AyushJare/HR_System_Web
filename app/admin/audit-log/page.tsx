"use client";

import { useEffect, useState } from "react";
import PermissionGate from "../PermissionGate";

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  employee: {
    fullName: string;
    employeeCode: number;
    email: string;
  } | null;
}

const actionColors: Record<string, string> = {
  EMPLOYEE_CREATED:
    "bg-emerald-50 text-emerald-700 border-emerald-200",

  EMPLOYEE_UPDATED:
    "bg-blue-50 text-blue-700 border-blue-200",

  EMPLOYEE_DELETED:
    "bg-red-50 text-red-700 border-red-200",

  DEPARTMENT_CREATED:
    "bg-slate-100 text-slate-700 border-slate-200",

  LOGIN_WITH_LOCATION:
    "bg-purple-50 text-purple-700 border-purple-200",

  ATTENDANCE_LOGGED_IN:
    "bg-green-50 text-green-700 border-green-200",

  ATTENDANCE_LOGGED_OUT:
    "bg-orange-50 text-orange-700 border-orange-200",

  ATTENDANCE_MARKED:
    "bg-blue-50 text-blue-700 border-blue-200",

  ATTENDANCE_UPDATED:
    "bg-yellow-50 text-yellow-700 border-yellow-200",
};

function formatAction(action: string) {
  return action
    .split("_")
    .map(
      (word) =>
        word.charAt(0) + word.slice(1).toLowerCase()
    )
    .join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatTime(value: unknown) {
  if (!value || typeof value !== "string") {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getString(
  metadata: Record<string, unknown> | null,
  key: string
): string | null {
  const value = metadata?.[key];

  return typeof value === "string" ? value : null;
}

function getBoolean(
  metadata: Record<string, unknown> | null,
  key: string
): boolean {
  return metadata?.[key] === true;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const res = await fetch("/api/audit-logs");

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.error || "Failed to load audit logs"
          );
        }

        setLogs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Audit log load error:", error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, []);

  const filtered = logs.filter((log) => {
    const q = search.trim().toLowerCase();

    if (!q) return true;

    const metadataText = log.metadata
      ? JSON.stringify(log.metadata)
      : "";

    return (
      formatAction(log.action)
        .toLowerCase()
        .includes(q) ||
      (log.entity ?? "").toLowerCase().includes(q) ||
      (log.employee?.fullName ?? "")
        .toLowerCase()
        .includes(q) ||
      (log.employee?.email ?? "")
        .toLowerCase()
        .includes(q) ||
      metadataText.toLowerCase().includes(q)
    );
  });

  return (
    <PermissionGate moduleName="Audit Log" action="view">
      <div className="p-8">
        {/* =====================================================
            HEADER
            ===================================================== */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
            Audit Log
          </h1>

          <p className="text-slate-500 mt-2 font-normal text-sm">
            A complete, tamper-evident history of every action
            taken in the system.
          </p>
        </div>

        {/* =====================================================
            SEARCH
            ===================================================== */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by action, employee, entity, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
          />
        </div>

        {/* =====================================================
            TABLE
            ===================================================== */}
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md border border-slate-200 overflow-x-auto transition-shadow duration-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Timestamp
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Action
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Employee
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Performed By
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Attendance Time
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Location
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  IP Address
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Device
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Status
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Message
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No audit log entries found.
                  </td>
                </tr>
              )}

              {filtered.map((log) => {
                const metadata = log.metadata;

                const latitude =
                  metadata?.latitude !== undefined
                    ? Number(metadata.latitude)
                    : null;

                const longitude =
                  metadata?.longitude !== undefined
                    ? Number(metadata.longitude)
                    : null;

                const gpsAccuracy =
                  metadata?.gpsAccuracy !== undefined
                    ? Number(metadata.gpsAccuracy)
                    : null;

                const distanceFromOffice =
                  metadata?.distanceFromOffice !== undefined &&
                    metadata?.distanceFromOffice !== null
                    ? Number(metadata.distanceFromOffice)
                    : null;

                const ipAddress = getString(
                  metadata,
                  "ipAddress"
                );

                const deviceId = getString(
                  metadata,
                  "deviceId"
                );

                const message = getString(
                  metadata,
                  "message"
                );

                const targetEmployeeName = getString(
                  metadata,
                  "targetEmployeeName"
                );

                const oldTimeIn = getString(
                  metadata,
                  "oldTimeIn"
                );

                const newTimeIn = getString(
                  metadata,
                  "newTimeIn"
                );

                const oldTimeOut = getString(
                  metadata,
                  "oldTimeOut"
                );

                const newTimeOut = getString(
                  metadata,
                  "newTimeOut"
                );

                const isMockLocation = getBoolean(
                  metadata,
                  "isMockLocation"
                );

                const requiresApproval = getBoolean(
                  metadata,
                  "requiresApproval"
                );

                const isLocationLogin =
                  log.action === "LOGIN_WITH_LOCATION";

                const isAttendanceLogin =
                  log.action === "ATTENDANCE_LOGGED_IN";

                const isAttendanceLogout =
                  log.action === "ATTENDANCE_LOGGED_OUT";

                const isAttendanceChange =
                  log.action === "ATTENDANCE_MARKED" ||
                  log.action === "ATTENDANCE_UPDATED";

                return (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200"
                  >
                    {/* =================================================
                        TIMESTAMP
                        ================================================= */}
                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {formatDateTime(log.createdAt)}
                    </td>

                    {/* =================================================
                        ACTION
                        ================================================= */}
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold border ${actionColors[log.action] ??
                          "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                      >
                        {formatAction(log.action)}
                      </span>
                    </td>

                    {/* =================================================
                        TARGET EMPLOYEE
                        ================================================= */}
                    <td className="px-6 py-3 text-slate-900">
                      {targetEmployeeName ? (
                        <div className="font-medium">
                          {targetEmployeeName}
                        </div>
                      ) : log.employee ? (
                        <div className="font-medium">
                          {log.employee.fullName}
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          System
                        </span>
                      )}

                      {log.entity && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {log.entity}
                        </div>
                      )}
                    </td>

                    {/* =================================================
                        PERFORMED BY
                        ================================================= */}
                    <td className="px-6 py-3 text-slate-900">
                      {log.employee ? (
                        <>
                          <div className="font-medium">
                            {log.employee.fullName}
                          </div>

                          <div className="text-xs text-slate-500 mt-0.5">
                            #{log.employee.employeeCode}
                          </div>

                          <div className="text-xs text-slate-500">
                            {log.employee.email}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-600">
                          System
                        </span>
                      )}
                    </td>

                    {/* =================================================
                        ATTENDANCE TIME
                        ================================================= */}
                    <td className="px-6 py-3 text-xs whitespace-nowrap">
                      {isAttendanceLogin && (
                        <div>
                          <div className="font-semibold text-green-700">
                            Time In:{" "}
                            {formatTime(
                              metadata?.attendanceTime
                            )}
                          </div>
                        </div>
                      )}

                      {isAttendanceLogout && (
                        <div>
                          <div className="font-semibold text-orange-700">
                            Time Out:{" "}
                            {formatTime(
                              metadata?.attendanceTime
                            )}
                          </div>
                        </div>
                      )}

                      {isAttendanceChange && (
                        <div className="space-y-1">
                          <div>
                            <span className="font-semibold">
                              Time In:
                            </span>{" "}
                            {formatTime(oldTimeIn)} →{" "}
                            <span className="font-semibold">
                              {formatTime(newTimeIn)}
                            </span>
                          </div>

                          <div>
                            <span className="font-semibold">
                              Time Out:
                            </span>{" "}
                            {formatTime(oldTimeOut)} →{" "}
                            <span className="font-semibold">
                              {formatTime(newTimeOut)}
                            </span>
                          </div>
                        </div>
                      )}

                      {!isAttendanceLogin &&
                        !isAttendanceLogout &&
                        !isAttendanceChange && (
                          <span className="text-slate-400">
                            —
                          </span>
                        )}
                    </td>

                    {/* =================================================
                        LOCATION
                        ================================================= */}
                    <td className="px-6 py-3 text-sm">
                      {isLocationLogin &&
                        latitude !== null &&
                        longitude !== null &&
                        !Number.isNaN(latitude) &&
                        !Number.isNaN(longitude) ? (
                        <div className="text-xs space-y-1 whitespace-nowrap">
                          <p>
                            📍 {latitude.toFixed(4)},{" "}
                            {longitude.toFixed(4)}
                          </p>

                          {gpsAccuracy !== null &&
                            !Number.isNaN(gpsAccuracy) && (
                              <p className="text-slate-600">
                                Accuracy:{" "}
                                {gpsAccuracy.toFixed(1)}m
                              </p>
                            )}

                          {distanceFromOffice !== null &&
                            !Number.isNaN(
                              distanceFromOffice
                            ) && (
                              <p
                                className={
                                  distanceFromOffice > 100
                                    ? "text-red-600 font-medium"
                                    : "text-green-600 font-medium"
                                }
                              >
                                {distanceFromOffice.toFixed(1)}m
                                {" from office"}
                              </p>
                            )}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          {isLocationLogin
                            ? "No location"
                            : "—"}
                        </span>
                      )}
                    </td>

                    {/* =================================================
                        IP ADDRESS
                        ================================================= */}
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {isLocationLogin
                        ? ipAddress || "—"
                        : "—"}
                    </td>

                    {/* =================================================
                        DEVICE
                        ================================================= */}
                    <td className="px-6 py-3 text-sm text-slate-600 max-w-[180px]">
                      {isLocationLogin && deviceId
                        ? deviceId.length > 30
                          ? `${deviceId.substring(
                            0,
                            30
                          )}...`
                          : deviceId
                        : "—"}
                    </td>

                    {/* =================================================
                        STATUS
                        ================================================= */}
                    <td className="px-6 py-3 text-sm">
                      {isLocationLogin &&
                        requiresApproval ? (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs whitespace-nowrap">
                          Approval Pending
                        </span>
                      ) : isLocationLogin ? (
                        <span className="text-green-600 text-xs font-medium">
                          Verified
                        </span>
                      ) : isAttendanceLogin ? (
                        <span className="text-green-600 text-xs font-medium">
                          Logged In
                        </span>
                      ) : isAttendanceLogout ? (
                        <span className="text-orange-600 text-xs font-medium">
                          Logged Out
                        </span>
                      ) : isAttendanceChange ? (
                        <span className="text-blue-600 text-xs font-medium">
                          Updated
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* =================================================
                        MESSAGE
                        ================================================= */}
                    <td className="px-6 py-3 text-slate-600 text-xs min-w-[300px]">
                      {message ? (
                        <div className="whitespace-normal">
                          {message}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          {log.metadata
                            ? JSON.stringify(
                              log.metadata
                            )
                            : "—"}
                        </span>
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