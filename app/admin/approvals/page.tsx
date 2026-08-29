"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PermissionGate from "../PermissionGate";


interface Employee {
  id: string;
  fullName: string;
  employeeCode: number;
}

interface ApprovalItem {
  id: string;
  type: "LEAVE" | "ATTENDANCE_CORRECTION";
  status: "PENDING" | "APPROVED" | "REJECTED";
  details: { date?: string; reason?: string; timeIn?: string; timeOut?: string; status?: string; leaveTypeId?: string } | null;
  remarks: string | null;
  createdAt: string;
  actor: { fullName: string; employeeCode: number };
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [showForm, setShowForm] = useState(false);

  const [formType, setFormType] = useState<"LEAVE" | "ATTENDANCE_CORRECTION">("LEAVE");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formTimeIn, setFormTimeIn] = useState("");
  const [formTimeOut, setFormTimeOut] = useState("");
  const [formStatus, setFormStatus] = useState("PRESENT");
  const [formLeaveTypeId, setFormLeaveTypeId] = useState("");
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; name: string; code: string }[]>([]);
  const [balances, setBalances] = useState<{ leaveTypeId: string; code: string; remaining: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [approvalsRes, employeesRes] = await Promise.all([
      fetch("/api/approvals").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setApprovals(approvalsRes);
    setEmployees(employeesRes);
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetch("/api/leave-types")
      .then((r) => r.json())
      .then(setLeaveTypes);
  }, []);

  useEffect(() => {
    if (!formEmployeeId) { setBalances([]); return; }
    fetch(`/api/leave-balances?employeeId=${formEmployeeId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBalances(Array.isArray(d) ? d : []))
      .catch(() => setBalances([]));
  }, [formEmployeeId]);

  const filtered = approvals.filter((a) => filter === "ALL" || a.status === filter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId || !formDate) {
      toast.error("Employee and date are required");
      return;
    }
    setSubmitting(true);
    try {
      if (formType === "LEAVE" && !formLeaveTypeId) {
        toast.error("Please select a leave type");
        setSubmitting(false);
        return;
      }

      const details =
        formType === "LEAVE"
          ? { date: formDate, reason: formReason, leaveTypeId: formLeaveTypeId }
          : { date: formDate, timeIn: formTimeIn || undefined, timeOut: formTimeOut || undefined, status: formStatus };

      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: formType, actorId: formEmployeeId, details }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create request");
      }
      toast.success("Request logged");
      setShowForm(false);
      setFormEmployeeId("");
      setFormDate("");
      setFormReason("");
      setFormTimeIn("");
      setFormTimeOut("");
      setFormLeaveTypeId("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (id: string, decision: "APPROVED" | "REJECTED") => {
    const res = await fetch(`/api/approvals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to update request");
      return;
    }
    toast.success(decision === "APPROVED" ? "Request approved" : "Request rejected");
    load();
  };

  return (
    <PermissionGate moduleName="Approvals" action="view">
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Approvals</h1>
            <p className="text-slate-600 mt-1">
              Leave requests and attendance corrections requiring sign-off.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md"
          >
            {showForm ? "Cancel" : "+ Log New Request"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Request Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as "LEAVE" | "ATTENDANCE_CORRECTION")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                >
                  <option value="LEAVE">Leave Request</option>
                  <option value="ATTENDANCE_CORRECTION">Attendance Correction</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} (#{e.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                />
              </div>

              {formType === "LEAVE" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type</label>
                    <select
                      value={formLeaveTypeId}
                      onChange={(e) => setFormLeaveTypeId(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">Select leave type</option>
                      {leaveTypes.map((lt) => {
                        const bal = balances.find((b) => b.leaveTypeId === lt.id);
                        return (
                          <option key={lt.id} value={lt.id}>
                            {lt.name} ({lt.code}){bal ? ` — ${bal.remaining} remaining` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                    <input
                      type="text"
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      placeholder="e.g. Family function"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </>
              )}

              {formType === "ATTENDANCE_CORRECTION" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Corrected Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    >
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="HALF_DAY">Half Day</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Corrected Time In</label>
                    <input
                      type="time"
                      value={formTimeIn}
                      onChange={(e) => setFormTimeIn(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Corrected Time Out</label>
                    <input
                      type="time"
                      value={formTimeOut}
                      onChange={(e) => setFormTimeOut(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        )}

        <div className="mb-4 flex gap-2">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "px-3 py-1.5 rounded-md text-sm font-semibold bg-slate-900 text-white"
                  : "px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-slate-300 text-slate-600"
              }
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Details</th>
                <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide w-40">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No requests found.</td></tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200">
                  <td className="px-4 py-3 text-slate-700">
                    {a.actor.fullName} <span className="text-slate-400 text-xs">#{a.actor.employeeCode}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {a.type === "LEAVE" ? "Leave" : "Attendance Correction"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {a.details?.date && <div>Date: {a.details.date}</div>}
                    {a.details?.leaveTypeId && (
                      <div>Type: {leaveTypes.find((lt) => lt.id === a.details?.leaveTypeId)?.name ?? "—"}</div>
                    )}
                    {a.details?.reason && <div>Reason: {a.details.reason}</div>}
                    {a.details?.timeIn && <div>Time In: {a.details.timeIn}</div>}
                    {a.details?.timeOut && <div>Time Out: {a.details.timeOut}</div>}
                    {a.details?.status && <div>Corrected Status: {a.details.status}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        a.status === "PENDING"
                          ? "inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                          : a.status === "APPROVED"
                            ? "inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecision(a.id, "APPROVED")}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(a.id, "REJECTED")}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PermissionGate>
  );
}