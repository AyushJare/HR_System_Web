"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface EmployeeType {
  id: string;
  name: string;
  noticePeriod: number;
}

export default function EmployeeTypesTab() {
  const [items, setItems] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNotice, setNewNotice] = useState(30);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotice, setEditNotice] = useState(30);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/employee-types");
    setItems(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/employee-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, noticePeriod: newNotice }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to add");
      return;
    }
    toast.success("Employee type added");
    setNewName("");
    setNewNotice(30);
    load();
  };

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/employee-types/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, noticePeriod: editNotice }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Updated");
    setEditingId(null);
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/employee-types/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Deleted");
    load();
  };

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4 items-center">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New employee type"
          className="flex-1 max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
        />
        <input
          type="number"
          value={newNotice}
          onChange={(e) => setNewNotice(Number(e.target.value))}
          placeholder="Notice period (days)"
          className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
        />
        <button className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md">
          Add
        </button>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide w-24">Action</th>
              <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Employee Type</th>
              <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">Notice Period</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No employee types yet.</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200">
                <td className="px-4 py-2.5">
                  {editingId === item.id ? (
                    <button onClick={() => handleUpdate(item.id)} className="text-green-600 text-xs font-medium mr-3">Save</button>
                  ) : (
                    <button onClick={() => { setEditingId(item.id); setEditName(item.name); setEditNotice(item.noticePeriod); }} className="text-slate-700 hover:text-slate-900 text-xs font-medium mr-3">Edit</button>
                  )}
                  <button onClick={() => handleDelete(item.id, item.name)} className="text-red-600 text-xs font-medium">Delete</button>
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {editingId === item.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full max-w-xs" />
                  ) : (
                    item.name
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {editingId === item.id ? (
                    <input type="number" value={editNotice} onChange={(e) => setEditNotice(Number(e.target.value))} className="rounded-md border border-slate-300 px-2 py-1 text-sm w-24" />
                  ) : (
                    `${item.noticePeriod} days`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}