"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Holiday {
  id: string;
  name: string;
  date: string;
}

export default function HolidaysTab() {
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/holidays");
    setItems(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDate) return;
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, date: newDate }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to add");
      return;
    }
    toast.success("Holiday added");
    setNewName("");
    setNewDate("");
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Deleted");
    load();
  };

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Holiday name"
          className="flex-1 max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-md">
          Add
        </button>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">Action</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Holiday Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No holidays yet.</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">
                  <button onClick={() => handleDelete(item.id, item.name)} className="text-red-600 text-xs font-medium">Delete</button>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{item.name}</td>
                <td className="px-4 py-2.5 text-slate-700">
                  {new Date(item.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}