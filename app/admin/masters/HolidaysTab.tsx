"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Holiday {
  id: string;
  name: string;
  description: string | null;
  date: string;
}

interface UploadError {
  row: number;
  field: string;
  message: string;
}

interface UploadResult {
  success?: number;
  failed?: number;
  errors?: UploadError[];
  error?: string;
}

export default function HolidaysTab() {
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Single holiday
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Individual edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  // Group edit
  const [editingGroup, setEditingGroup] = useState<Holiday[] | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupStartDate, setGroupStartDate] = useState("");
  const [groupEndDate, setGroupEndDate] = useState("");

  // Bulk upload
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const load = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/holidays");

      if (!res.ok) {
        throw new Error("Failed to load holidays");
      }

      const data = await res.json();
      setItems(data);
    } catch {
      toast.error("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // =========================================================
  // ADD SINGLE HOLIDAY
  // =========================================================

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim() || !newDate) {
      toast.error("Holiday name and date are required");
      return;
    }

    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDescription.trim() || null,
        date: newDate,
      }),
    });

    if (!res.ok) {
      const err = await res.json();

      toast.error(err.error || "Failed to add");
      return;
    }

    toast.success("Holiday added");

    setNewName("");
    setNewDate("");
    setNewDescription("");

    await load();
  };

  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;

    const res = await fetch(`/api/holidays/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      let message = "Failed to delete";

      try {
        const err = await res.json();
        message = err.error || message;
      } catch { }

      toast.error(message);
      return;
    }

    toast.success("Deleted");

    await load();
  };

  // =========================================================
  // INDIVIDUAL EDIT
  // =========================================================

  const handleEdit = async (id: string) => {
    if (!editingName.trim() || !editingDate) {
      toast.error("Holiday name and date are required");
      return;
    }

    const res = await fetch(`/api/holidays/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: editingName.trim(),
        description: editingDescription.trim() || null,
        date: editingDate,
      }),
    });

    if (!res.ok) {
      let message = "Failed to update";

      try {
        const err = await res.json();
        message = err.error || message;
      } catch { }

      toast.error(message);
      return;
    }

    toast.success("Holiday updated");

    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingDate("");

    await load();
  };

  // =========================================================
  // GROUP HELPERS
  // =========================================================

  const formatDateForInput = (date: string) => {
    return new Date(date).toISOString().split("T")[0];
  };

  const getDateDifference = (first: string, second: string) => {
    const firstDate = new Date(first);
    const secondDate = new Date(second);

    firstDate.setHours(0, 0, 0, 0);
    secondDate.setHours(0, 0, 0, 0);

    return Math.round(
      (secondDate.getTime() - firstDate.getTime()) /
      (1000 * 60 * 60 * 24)
    );
  };

  const getHolidayGroup = (item: Holiday) => {
    const sameName = items
      .filter((holiday) => holiday.name === item.name)
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );

    if (sameName.length === 0) {
      return [item];
    }

    const itemIndex = sameName.findIndex(
      (holiday) => holiday.id === item.id
    );

    let startIndex = itemIndex;
    let endIndex = itemIndex;

    while (
      startIndex > 0 &&
      getDateDifference(
        sameName[startIndex - 1].date,
        sameName[startIndex].date
      ) === 1
    ) {
      startIndex--;
    }

    while (
      endIndex < sameName.length - 1 &&
      getDateDifference(
        sameName[endIndex].date,
        sameName[endIndex + 1].date
      ) === 1
    ) {
      endIndex++;
    }

    return sameName.slice(startIndex, endIndex + 1);
  };

  // =========================================================
  // START GROUP EDIT
  // =========================================================

  const startGroupEdit = (item: Holiday) => {
    const group = getHolidayGroup(item);

    setEditingGroup(group);
    setGroupName(group[0].name);
    setGroupDescription(group[0].description || "");
    setGroupStartDate(formatDateForInput(group[0].date));
    setGroupEndDate(
      formatDateForInput(group[group.length - 1].date)
    );

    setEditingId(null);
  };

  // =========================================================
  // GROUP EDIT
  // =========================================================

  const handleGroupEdit = async () => {
    if (
      !editingGroup ||
      !groupName.trim() ||
      !groupStartDate ||
      !groupEndDate
    ) {
      toast.error("Group name and dates are required");
      return;
    }

    if (groupStartDate > groupEndDate) {
      toast.error("Start date cannot be after end date");
      return;
    }

    const start = new Date(groupStartDate);
    const end = new Date(groupEndDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);

      current.setDate(current.getDate() + 1);
    }

    try {
      // Update existing records
      const existingCount = Math.min(
        editingGroup.length,
        dates.length
      );

      for (let i = 0; i < existingCount; i++) {
        const res = await fetch(
          `/api/holidays/${editingGroup[i].id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: groupName.trim(),
              description: groupDescription.trim() || null,
              date: dates[i],
            }),
          }
        );

        if (!res.ok) {
          let message = "Failed to update holiday group";

          try {
            const err = await res.json();
            message = err.error || message;
          } catch { }

          throw new Error(message);
        }
      }

      // Delete extra records if range becomes shorter
      if (editingGroup.length > dates.length) {
        for (
          let i = dates.length;
          i < editingGroup.length;
          i++
        ) {
          const res = await fetch(
            `/api/holidays/${editingGroup[i].id}`,
            {
              method: "DELETE",
            }
          );

          if (!res.ok) {
            throw new Error(
              "Failed to remove extra holiday dates"
            );
          }
        }
      }

      // Create additional records if range becomes longer
      if (dates.length > editingGroup.length) {
        for (
          let i = editingGroup.length;
          i < dates.length;
          i++
        ) {
          const res = await fetch("/api/holidays", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: groupName.trim(),
              description: groupDescription.trim() || null,
              date: dates[i],
            }),
          });

          if (!res.ok) {
            let message = "Failed to create holiday date";

            try {
              const err = await res.json();
              message = err.error || message;
            } catch { }

            throw new Error(message);
          }
        }
      }

      toast.success("Holiday group updated");

      setEditingGroup(null);
      setGroupName("");
      setGroupDescription("");
      setGroupStartDate("");
      setGroupEndDate("");

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update holiday group"
      );
    }
  };

  // =========================================================
  // DOWNLOAD TEMPLATE
  // =========================================================

  const handleDownloadTemplate = async () => {
    try {
      toast.loading("Preparing template...", {
        id: "holiday-template",
      });

      const res = await fetch("/api/templates/holiday", {
        method: "GET",
      });

      if (!res.ok) {
        const text = await res.text();

        console.error(
          "Template API error:",
          res.status,
          text
        );

        throw new Error(
          `Template download failed (${res.status})`
        );
      }

      const blob = await res.blob();

      if (blob.size === 0) {
        throw new Error("Template file is empty");
      }

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "holiday_template.xlsx";

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(url);

      toast.success("Template downloaded", {
        id: "holiday-template",
      });
    } catch (error) {
      console.error(
        "Holiday template download error:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to download template",
        {
          id: "holiday-template",
        }
      );
    }
  };

  // =========================================================
  // BULK UPLOAD
  // =========================================================

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please select an Excel file");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        "/api/holidays/bulk-upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(
          data.error || "Holiday upload failed"
        );

        setUploadResult(data);
        return;
      }

      setUploadResult(data);

      if (data.success > 0) {
        toast.success(
          `${data.success} holiday day(s) imported`
        );
      }

      if (data.failed > 0) {
        toast.error(
          `${data.failed} row(s) failed`
        );
      }

      setFile(null);

      const input = document.getElementById(
        "holiday-upload"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await load();
    } catch {
      toast.error("Holiday upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* =====================================================
          BULK UPLOAD
      ====================================================== */}

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Bulk Upload Holidays
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Upload multiple holidays using an Excel file.
            A holiday will be created for every day between
            the Start Date and End Date.
          </p>
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            📥 Download Holiday Template
          </button>
        </div>

        <form
          onSubmit={handleUpload}
          className="flex flex-wrap items-center gap-3"
        >
          <input
            id="holiday-upload"
            type="file"
            accept=".xlsx"
            onChange={(e) =>
              setFile(e.target.files?.[0] || null)
            }
            className="block rounded-md border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
          />

          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Uploading..."
              : "Upload Holidays"}
          </button>
        </form>

        {uploadResult && (
          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800">
              Upload Results
            </h3>

            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-green-700">
                ✓ Created: {uploadResult.success ?? 0}
              </span>

              <span className="text-red-700">
                ✗ Failed: {uploadResult.failed ?? 0}
              </span>
            </div>

            {uploadResult.errors &&
              uploadResult.errors.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left">
                          Field
                        </th>
                        <th className="px-3 py-2 text-left">
                          Error
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {uploadResult.errors.map(
                        (error, index) => (
                          <tr
                            key={index}
                            className="border-b border-slate-100"
                          >
                            <td className="px-3 py-2">
                              {error.row}
                            </td>
                            <td className="px-3 py-2">
                              {error.field}
                            </td>
                            <td className="px-3 py-2 text-red-600">
                              {error.message}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}
      </div>

      {/* =====================================================
          SINGLE HOLIDAY
      ====================================================== */}

      <form
        onSubmit={handleAdd}
        className="mb-4 flex flex-wrap gap-2"
      >
        <input
          value={newName}
          onChange={(e) =>
            setNewName(e.target.value)
          }
          placeholder="Holiday name"
          className="max-w-sm flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="date"
          value={newDate}
          onChange={(e) =>
            setNewDate(e.target.value)
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          value={newDescription}
          onChange={(e) =>
            setNewDescription(e.target.value)
          }
          placeholder="Description"
          className="max-w-sm flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Add
        </button>
      </form>

      {/* =====================================================
          GROUP EDIT
      ====================================================== */}

      {editingGroup && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Edit Holiday Group
            </h3>

            <p className="mt-1 text-xs text-slate-600">
              This group contains{" "}
              {editingGroup.length} consecutive day(s).
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Holiday Name
              </label>

              <input
                value={groupName}
                onChange={(e) =>
                  setGroupName(e.target.value)
                }
                className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Description
              </label>

              <input
                value={groupDescription}
                onChange={(e) =>
                  setGroupDescription(e.target.value)
                }
                placeholder="Description"
                className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Start Date
              </label>

              <input
                type="date"
                value={groupStartDate}
                onChange={(e) =>
                  setGroupStartDate(e.target.value)
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                End Date
              </label>

              <input
                type="date"
                value={groupEndDate}
                onChange={(e) =>
                  setGroupEndDate(e.target.value)
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleGroupEdit}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Save Group
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingGroup(null);
                setGroupName("");
                setGroupDescription("");
                setGroupStartDate("");
                setGroupEndDate("");
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          HOLIDAY TABLE
      ====================================================== */}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-40 px-4 py-3 text-left font-medium text-slate-600">
                Action
              </th>

              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Holiday Name
              </th>

              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Date
              </th>

              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Description
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
                  No holidays yet.
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleEdit(item.id)
                        }
                        className="text-xs font-medium text-green-600"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                          setEditingDescription("");
                          setEditingDate("");
                        }}
                        className="text-xs font-medium text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingName(item.name);
                          setEditingDate(
                            formatDateForInput(item.date)
                          );
                          setEditingDescription(
                            item.description || ""
                          );
                          setEditingGroup(null);
                        }}
                        className="text-xs font-medium text-blue-600"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          startGroupEdit(item)
                        }
                        className="text-xs font-medium text-purple-600"
                      >
                        Edit Group
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            item.id,
                            item.name
                          )
                        }
                        className="text-xs font-medium text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>

                <td className="px-4 py-2.5 text-slate-700">
                  {editingId === item.id ? (
                    <input
                      value={editingName}
                      onChange={(e) =>
                        setEditingName(e.target.value)
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    item.name
                  )}
                </td>

                <td className="px-4 py-2.5 text-slate-700">
                  {editingId === item.id ? (
                    <input
                      type="date"
                      value={editingDate}
                      onChange={(e) =>
                        setEditingDate(e.target.value)
                      }
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    new Date(item.date).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )
                  )}
                </td>

                <td className="px-4 py-2.5 text-slate-700">
                  {editingId === item.id ? (
                    <input
                      value={editingDescription}
                      onChange={(e) =>
                        setEditingDescription(
                          e.target.value
                        )
                      }
                      placeholder="Description"
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    item.description || "-"
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