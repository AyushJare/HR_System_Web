"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

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
  } | null;
}

type Draft = { timeIn: string; timeOut: string; reason: string; status: string };
type DraftMap = Record<string, Draft>;

function toTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/attendance?date=${d}`);
    const data: AttendanceRow[] = await res.json();
    setRows(data);
    const nextDrafts: DraftMap = {};
    data.forEach((row) => {
      nextDrafts[row.employeeId] = {
        timeIn: toTimeInputValue(row.attendance?.timeIn ?? null),
        timeOut: toTimeInputValue(row.attendance?.timeOut ?? null),
        reason: row.attendance?.reason ?? "",
        status: row.attendance?.status ?? "PRESENT",
      };
    });
    setDrafts(nextDrafts);
    setLoading(false);
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
      [employeeId]: { ...prev[employeeId], [field]: value },
    }));
  };

  const handleSave = async (employeeId: string) => {
    setSavingId(employeeId);
    const draft = drafts[employeeId];
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          date,
          timeIn: draft.timeIn || null,
          timeOut: draft.timeOut || null,
          status: draft.status,
          reason: draft.reason || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Attendance saved");
      load(date);
    } catch {
      toast.error("Failed to save attendance");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-950 tracking-tight">Daily Attendance</h1>
        <p className="text-slate-500 mt-2 font-normal text-sm">Mark or update attendance for a specific date.</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-semibold text-slate-900">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Employee</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Status</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Time In</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Time Out</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Reason</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Save</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No employees found.</td></tr>
            )}
            {rows.map((row) => {
              const draft: Draft = drafts[row.employeeId] ?? {
                timeIn: "", timeOut: "", reason: "", status: "PRESENT",
              };
              return (
                <tr key={row.employeeId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-200 last:border-0">
                  <td className="px-6 py-3 text-slate-900">
                    <div className="font-semibold">{row.fullName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">#{row.employeeCode}</div>
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={draft.status}
                      onChange={(e) => updateDraft(row.employeeId, "status", e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    >
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="HALF_DAY">Half Day</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="time"
                      value={draft.timeIn}
                      onChange={(e) => updateDraft(row.employeeId, "timeIn", e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="time"
                      value={draft.timeOut}
                      onChange={(e) => updateDraft(row.employeeId, "timeOut", e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      value={draft.reason}
                      onChange={(e) => updateDraft(row.employeeId, "reason", e.target.value)}
                      placeholder="Reason (optional)"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleSave(row.employeeId)}
                      disabled={savingId === row.employeeId}
                      className="text-slate-900 hover:text-slate-700 font-semibold text-sm hover:bg-slate-100 px-2 py-1 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingId === row.employeeId ? "..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}