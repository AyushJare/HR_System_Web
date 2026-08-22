"use client";

import { useEffect, useState } from "react";

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
  EMPLOYEE_CREATED: "bg-green-50 text-green-700 border-green-200",
  EMPLOYEE_UPDATED: "bg-blue-50 text-blue-700 border-blue-200",
  EMPLOYEE_DELETED: "bg-red-50 text-red-700 border-red-200",
  DEPARTMENT_CREATED: "bg-purple-50 text-purple-700 border-purple-200",
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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-600 mt-1">
          A complete, tamper-evident history of every action taken in the system.
        </p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by action, entity, or user..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Timestamp</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Entity</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Performed By</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No audit log entries found.
                </td>
              </tr>
            )}
            {filtered.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                      actionColors[log.action] ?? "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {formatAction(log.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {log.entity ?? "—"}
                  {log.entityId && (
                    <span className="text-slate-400 text-xs block">{log.entityId}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {log.employee ? (
                    <>
                      <div>{log.employee.fullName}</div>
                      <div className="text-xs text-slate-400">{log.employee.email}</div>
                    </>
                  ) : (
                    "System"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                  {log.metadata ? JSON.stringify(log.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
