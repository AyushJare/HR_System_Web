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
  employee: { fullName: string; email: string } | null;
}

const actionColors: Record<string, string> = {
  EMPLOYEE_CREATED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EMPLOYEE_UPDATED: "bg-blue-50 text-blue-700 border-blue-200",
  EMPLOYEE_DELETED: "bg-red-50 text-red-700 border-red-200",
  DEPARTMENT_CREATED: "bg-slate-100 text-slate-700 border-slate-200",
  LOGIN_WITH_LOCATION: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatAction(action: string) {
  return action
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/audit-logs")
      .then((res) => res.json())
      .then((data) => setLogs(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();

    return (
      formatAction(log.action).toLowerCase().includes(q) ||
      (log.entity ?? "").toLowerCase().includes(q) ||
      (log.employee?.fullName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <PermissionGate moduleName="Audit Log" action="view">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
            Audit Log
          </h1>

          <p className="text-slate-500 mt-2 font-normal text-sm">
            A complete, tamper-evident history of every action taken in the
            system.
          </p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by action, entity, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
          />
        </div>

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
                  Entity
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Performed By
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
                  Location Type
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Status
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                  Details
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

                const ipAddress =
                  typeof metadata?.ipAddress === "string"
                    ? metadata.ipAddress
                    : null;

                const deviceId =
                  typeof metadata?.deviceId === "string"
                    ? metadata.deviceId
                    : null;

                const isMockLocation =
                  metadata?.isMockLocation === true;

                const requiresApproval =
                  metadata?.requiresApproval === true;

                const isLocationLogin =
                  log.action === "LOGIN_WITH_LOCATION";

                return (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200"
                  >
                    {/* Timestamp */}
                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold border ${actionColors[log.action] ??
                          "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                      >
                        {formatAction(log.action)}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="px-6 py-3 text-slate-900 font-medium">
                      {log.entity ?? "—"}

                      {log.entityId && (
                        <span className="text-slate-500 text-xs block mt-0.5">
                          {log.entityId}
                        </span>
                      )}
                    </td>

                    {/* Performed By */}
                    <td className="px-6 py-3 text-slate-900">
                      {log.employee ? (
                        <>
                          <div className="font-medium">
                            {log.employee.fullName}
                          </div>

                          <div className="text-xs text-slate-500 mt-0.5">
                            {log.employee.email}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-600">
                          System
                        </span>
                      )}
                    </td>

                    {/* Location */}
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
                                Accuracy: {gpsAccuracy.toFixed(1)}m
                              </p>
                            )}

                          {distanceFromOffice !== null &&
                            !Number.isNaN(distanceFromOffice) && (
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

                    {/* IP Address */}
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {isLocationLogin
                        ? ipAddress || "—"
                        : "—"}
                    </td>

                    {/* Device */}
                    <td className="px-6 py-3 text-sm text-slate-600 max-w-[180px]">
                      {isLocationLogin && deviceId
                        ? deviceId.length > 30
                          ? `${deviceId.substring(0, 30)}...`
                          : deviceId
                        : "—"}
                    </td>

                    {/* Location Type */}
                    <td className="px-6 py-3 text-sm">
                      {isLocationLogin ? (
                        isMockLocation ? (
                          <span className="text-red-600 font-semibold whitespace-nowrap">
                            ⚠️ Mock Location
                          </span>
                        ) : (
                          <span className="text-green-600 whitespace-nowrap">
                            ✅ Real
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-3 text-sm">
                      {isLocationLogin && requiresApproval ? (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs whitespace-nowrap">
                          Approval Pending
                        </span>
                      ) : isLocationLogin ? (
                        <span className="text-green-600 text-xs font-medium">
                          Verified
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* Details */}
                    <td className="px-6 py-3 text-slate-600 text-xs max-w-xs truncate">
                      {log.metadata
                        ? JSON.stringify(log.metadata)
                        : "—"}
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