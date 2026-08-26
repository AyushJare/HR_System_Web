"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Designation {
  id: string;
  name: string;
  description: string | null;
}

export default function DesignationsTab() {
  const [items, setItems] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = async () => {
    setLoading(true);

    const res = await fetch("/api/designations");
    setItems(await res.json());

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) return;

    const res = await fetch("/api/designations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newName,
        description: newDescription,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to add");
      return;
    }

    toast.success("Designation added");

    setNewName("");
    setNewDescription("");

    load();
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast.error("Designation name is required");
      return;
    }

    try {
      const res = await fetch(`/api/designations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(
          data.error || "Failed to update"
        );
        return;
      }

      toast.success("Designation updated");

      setEditingId(null);
      setEditName("");
      setEditDescription("");

      await load();
    } catch (error) {
      console.error(
        "Designation update error:",
        error
      );

      toast.error(
        "Unable to update designation"
      );
    }
  };
  const handleDelete = async (
    id: string,
    name: string
  ) => {
    if (!confirm(`Delete "${name}"?`)) return;

    const res = await fetch(
      `/api/designations/${id}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }

    toast.success("Deleted");

    load();
  };

  return (
    <div>
      {/* Add Designation */}
      <form
        onSubmit={handleAdd}
        className="flex gap-2 mb-4"
      >
        <input
          value={newName}
          onChange={(e) =>
            setNewName(e.target.value)
          }
          placeholder="New designation name"
          className="flex-1 max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          value={newDescription}
          onChange={(e) =>
            setNewDescription(
              e.target.value
            )
          }
          placeholder="Description"
          className="flex-1 max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-md">
          Add
        </button>
      </form>

      {/* Designation Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-28">
                Action
              </th>

              <th className="text-left px-4 py-3 font-medium text-slate-600">
                Designation Name
              </th>

              <th className="text-left px-4 py-3 font-medium text-slate-600">
                Description
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  Loading...
                </td>
              </tr>
            )}

            {!loading &&
              items.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    No designations yet.
                  </td>
                </tr>
              )}

            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="px-4 py-2.5">
                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdate(item.id)
                        }
                        className="text-green-600 text-xs font-medium mr-3"
                      >
                        Save
                      </button>

                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditName("");
                          setEditDescription("");
                        }}
                        className="text-slate-600 text-xs font-medium mr-3"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                        setEditDescription(
                          item.description || ""
                        );
                      }}
                      className="text-blue-600 text-xs font-medium mr-3"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    onClick={() =>
                      handleDelete(
                        item.id,
                        item.name
                      )
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
                        setEditName(
                          e.target.value
                        )
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full"
                    />
                  ) : (
                    item.name
                  )}
                </td>

                <td className="px-4 py-2.5 text-slate-700">
                  {editingId === item.id ? (
                    <input
                      value={editDescription}
                      onChange={(e) =>
                        setEditDescription(
                          e.target.value
                        )
                      }
                      placeholder="Description"
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full"
                    />
                  ) : (
                    item.description || "—"
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