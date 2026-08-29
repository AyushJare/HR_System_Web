"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultAnnualQuota: number;
}

export default function LeaveTypesTab() {
  const [items, setItems] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newQuota, setNewQuota] = useState(12);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editQuota, setEditQuota] = useState(12);

  const load = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/leave-types", {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load leave types");
      }

      // API must return an array.
      if (!Array.isArray(data)) {
        throw new Error("Invalid leave types response");
      }

      setItems(data);
    } catch (error) {
      console.error("Failed to load leave types:", error);
      setItems([]);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load leave types"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim() || !newCode.trim()) return;

    try {
      const res = await fetch("/api/leave-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim(),
          defaultAnnualQuota: newQuota,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to add");
      }

      toast.success("Leave type added");

      setNewName("");
      setNewCode("");
      setNewQuota(12);

      await load();
    } catch (error) {
      console.error("Failed to add leave type:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add leave type"
      );
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/leave-types/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim(),
          defaultAnnualQuota: editQuota,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update");
      }

      toast.success("Updated");

      setEditingId(null);

      await load();
    } catch (error) {
      console.error("Failed to update leave type:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update"
      );
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/leave-types/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete");
      }

      toast.success("Deleted");

      await load();
    } catch (error) {
      console.error("Failed to delete leave type:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete"
      );
    }
  };

  return (
    <div>
      <form
        onSubmit={handleAdd}
        className="flex gap-2 mb-4 items-center"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Leave type name (e.g. Casual Leave)"
          className="flex-1 max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
        />

        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Code (e.g. CL)"
          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
        />

        <input
          type="number"
          value={newQuota}
          onChange={(e) =>
            setNewQuota(Number(e.target.value))
          }
          placeholder="Annual quota"
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
        />

        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md"
        >
          Add
        </button>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide w-24">
                Action
              </th>

              <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                Name
              </th>

              <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                Code
              </th>

              <th className="text-left px-4 py-4 text-xs font-bold text-slate-950 uppercase tracking-wide">
                Annual Quota
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  Loading...
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No leave types yet.
                </td>
              </tr>
            )}

            {!loading &&
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200"
                >
                  <td className="px-4 py-2.5">
                    {editingId === item.id ? (
                      <button
                        onClick={() =>
                          handleUpdate(item.id)
                        }
                        className="text-green-600 text-xs font-medium mr-3"
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditName(item.name);
                          setEditCode(item.code);
                          setEditQuota(
                            item.defaultAnnualQuota
                          );
                        }}
                        className="text-slate-700 hover:text-slate-900 text-xs font-medium mr-3"
                      >
                        Edit
                      </button>
                    )}

                    <button
                      onClick={() =>
                        handleDelete(item.id, item.name)
                      }
                      className="text-red-600 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>

                  <td className="px-4 py-2.5 text-slate-700">
                    {editingId === item.id ? (
                      <input
                        value={editName}
                        onChange={(e) =>
                          setEditName(e.target.value)
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full max-w-xs"
                      />
                    ) : (
                      item.name
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-slate-700">
                    {editingId === item.id ? (
                      <input
                        value={editCode}
                        onChange={(e) =>
                          setEditCode(e.target.value)
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm w-24"
                      />
                    ) : (
                      item.code
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-slate-700">
                    {editingId === item.id ? (
                      <input
                        type="number"
                        value={editQuota}
                        onChange={(e) =>
                          setEditQuota(
                            Number(e.target.value)
                          )
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm w-24"
                      />
                    ) : (
                      `${item.defaultAnnualQuota} / year`
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