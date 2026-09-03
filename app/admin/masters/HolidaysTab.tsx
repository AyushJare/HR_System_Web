"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { usePermission } from "@/lib/hooks/userPermission";

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

  const {
    hasPermission: canExportHolidays,
    loading: exportPermissionLoading,
  } = usePermission("Holidays", "export");

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

  // =========================================================
  // LOAD HOLIDAYS
  // =========================================================

  const load = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/holidays");

      if (!res.ok) {
        throw new Error("Failed to load holidays");
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid holidays response");
      }

      setItems(data);
    } catch (error) {
      console.error("Failed to load holidays:", error);
      toast.error("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // =========================================================
  // DATE HELPER
  // =========================================================

  const formatDateForInput = (date: string) => {
    return new Date(date).toISOString().split("T")[0];
  };

  // =========================================================
  // DUPLICATE HOLIDAY CHECK
  // =========================================================

  const isDuplicateHoliday = (
    name: string,
    date: string,
    excludeId?: string
  ): boolean => {
    const normalizedName = name.trim().toLowerCase();

    return items.some((holiday) => {
      // Don't compare the record against itself while editing
      if (excludeId && holiday.id === excludeId) {
        return false;
      }

      const existingName = holiday.name.trim().toLowerCase();
      const existingDate = formatDateForInput(holiday.date);

      return existingName === normalizedName && existingDate === date;
    });
  };

  // =========================================================
  // ADD SINGLE HOLIDAY
  // =========================================================

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = newName.trim();

    // Required validation
    if (!trimmedName || !newDate) {
      toast.error("Holiday name and date are required");
      return;
    }

    // =====================================================
    // DUPLICATE CHECK
    // =====================================================

    if (isDuplicateHoliday(trimmedName, newDate)) {
      toast.error(`${trimmedName} is already added for this date.`);
      return;
    }

    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: newDescription.trim() || null,
          date: newDate,
        }),
      });

      let data: any = null;

      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        toast.error(data?.error || "Failed to add holiday");
        return;
      }

      toast.success("Holiday added");

      setNewName("");
      setNewDate("");
      setNewDescription("");

      await load();
    } catch (error) {
      console.error("Add holiday error:", error);
      toast.error("Failed to add holiday");
    }
  };

  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = async (id: string, name: string) => {
    const holiday = items.find((h) => h.id === id);

    if (!holiday) return;

    const group = getHolidayGroup(holiday);
    const dateRange = formatDateRange(holiday);

    const confirmMsg =
      group.length === 1
        ? `Delete "${name}" (${dateRange})?`
        : `Delete all ${group.length} days of "${name}" (${dateRange})?`;

    if (!confirm(confirmMsg)) return;

    try {
      const deletePromises = group.map((h) =>
        fetch(`/api/holidays/${h.id}`, {
          method: "DELETE",
        })
      );

      const results = await Promise.all(deletePromises);

      const allSuccessful = results.every((res) => res.ok);

      if (!allSuccessful) {
        toast.error("Failed to delete some holidays");
        return;
      }

      toast.success(
        group.length === 1
          ? "Holiday deleted"
          : `${group.length} days deleted`
      );

      await load();
    } catch (error) {
      console.error("Delete holiday error:", error);
      toast.error("Failed to delete");
    }
  };

  // =========================================================
  // INDIVIDUAL EDIT
  // =========================================================

  const handleEdit = async (id: string) => {
    const trimmedName = editingName.trim();

    if (!trimmedName || !editingDate) {
      toast.error("Holiday name and date are required");
      return;
    }

    // Prevent editing into an existing duplicate
    if (isDuplicateHoliday(trimmedName, editingDate, id)) {
      toast.error(`${trimmedName} is already added for this date.`);
      return;
    }

    try {
      const res = await fetch(`/api/holidays/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: editingDescription.trim() || null,
          date: editingDate,
        }),
      });

      if (!res.ok) {
        let message = "Failed to update";

        try {
          const err = await res.json();
          message = err.error || message;
        } catch {
          // Ignore JSON parsing error
        }

        toast.error(message);
        return;
      }

      toast.success("Holiday updated");

      setEditingId(null);
      setEditingName("");
      setEditingDescription("");
      setEditingDate("");

      await load();
    } catch (error) {
      console.error("Holiday edit error:", error);
      toast.error("Failed to update holiday");
    }
  };

  // =========================================================
  // DATE DIFFERENCE
  // =========================================================

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

  // =========================================================
  // GROUP HELPERS
  // =========================================================

  const getHolidayGroup = (item: Holiday) => {
    const sameName = items
      .filter(
        (holiday) =>
          holiday.name.trim().toLowerCase() ===
          item.name.trim().toLowerCase()
      )
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

    if (sameName.length === 0) {
      return [item];
    }

    const itemIndex = sameName.findIndex(
      (holiday) => holiday.id === item.id
    );

    if (itemIndex === -1) {
      return [item];
    }

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

  const isFirstInGroup = (item: Holiday): boolean => {
    const group = getHolidayGroup(item);

    return group.length > 0 && group[0].id === item.id;
  };

  const formatDateRange = (item: Holiday): string => {
    const group = getHolidayGroup(item);

    if (group.length === 0) {
      return "";
    }

    const startDate = new Date(group[0].date);
    const endDate = new Date(group[group.length - 1].date);

    if (group.length === 1) {
      return startDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    const startStr = startDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const endStr = endDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${startStr} to ${endStr}`;
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

    try {
      const res = await fetch("/api/holidays/group", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: editingGroup.map((holiday) => holiday.id),
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          startDate: groupStartDate,
          endDate: groupEndDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to update holiday group"
        );
      }

      toast.success("Holiday group updated");

      setEditingGroup(null);
      setGroupName("");
      setGroupDescription("");
      setGroupStartDate("");
      setGroupEndDate("");

      await load();
    } catch (error) {
      console.error("Holiday group update error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update holiday group"
      );
    }
  };

  // =========================================================
  // GROUP EDIT SAVE FROM TABLE
  // =========================================================

  const handleGroupEditSave = async (firstHolidayId: string) => {
    const holiday = items.find((h) => h.id === firstHolidayId);

    if (!holiday) return;

    const group = getHolidayGroup(holiday);

    if (!editingName.trim() || !groupStartDate || !groupEndDate) {
      toast.error("Holiday name and dates are required");
      return;
    }

    if (groupStartDate > groupEndDate) {
      toast.error("Start date cannot be after end date");
      return;
    }

    try {
      const res = await fetch("/api/holidays/group", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: group.map((h) => h.id),
          name: editingName.trim(),
          description: editingDescription.trim() || null,
          startDate: groupStartDate,
          endDate: groupEndDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to update holiday group"
        );
      }

      toast.success("Holiday group updated");

      setEditingId(null);
      setEditingName("");
      setEditingDescription("");
      setEditingDate("");
      setGroupStartDate("");
      setGroupEndDate("");

      await load();
    } catch (error) {
      console.error("Holiday group save error:", error);

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
      const res = await fetch("/api/holidays/bulk-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Holiday upload failed");

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
        toast.error(`${data.failed} row(s) failed`);
      }

      setFile(null);

      const input = document.getElementById(
        "holiday-upload"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await load();
    } catch (error) {
      console.error("Holiday upload error:", error);

      toast.error("Holiday upload failed");
    } finally {
      setUploading(false);
    }
  };

  // =========================================================
  // RESET GROUP EDIT
  // =========================================================

  const cancelGroupEdit = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupDescription("");
    setGroupStartDate("");
    setGroupEndDate("");
  };

  // =========================================================
  // RESET INLINE EDIT
  // =========================================================

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingDate("");
    setGroupStartDate("");
    setGroupEndDate("");
  };

  // =========================================================
  // UI
  // =========================================================

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
            Upload multiple holidays using an Excel
            file. A holiday will be created for every
            day between the Start Date and End Date.
          </p>
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="rounded-lg border border-slate-300 bg-slate-50 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 transition-all duration-200"
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
            className="rounded-lg bg-slate-900 px-6 py-2.5 font-semibold text-white transition-all duration-200 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Holidays"}
          </button>
        </form>

        {uploadResult && (
          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800">
              Upload Results
            </h3>

            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-emerald-700">
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
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Holiday name"
          className="max-w-sm flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
        />

        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
        />

        <input
          value={newDescription}
          onChange={(e) =>
            setNewDescription(e.target.value)
          }
          placeholder="Description"
          className="max-w-sm flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
        />

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-6 py-2.5 font-semibold text-white transition-all duration-200 hover:bg-slate-800 hover:shadow-md"
        >
          Add
        </button>

        {!exportPermissionLoading && canExportHolidays && (
          <a
            href="/api/holidays/export"
            className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 font-semibold text-slate-900 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50"
          >
            Export Excel
          </a>
        )}
      </form>

      {/* =====================================================
          GROUP EDIT
      ====================================================== */}

      {editingGroup && (
        <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Edit Holiday Group
            </h3>

            <p className="mt-1 text-xs text-slate-600">
              This group contains {editingGroup.length} consecutive
              day(s).
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
                className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
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
                className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
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
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
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
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
              />
            </div>

            <button
              type="button"
              onClick={handleGroupEdit}
              className="rounded-lg bg-slate-900 px-6 py-2.5 font-semibold text-white transition-all duration-200 hover:bg-slate-800 hover:shadow-md"
            >
              Save Group
            </button>

            <button
              type="button"
              onClick={cancelGroupEdit}
              className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200"
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
          <thead className="border-b-2 border-slate-200 bg-slate-50">
            <tr>
              <th className="w-40 px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-950">
                Action
              </th>

              <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-950">
                Holiday Name
              </th>

              <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-950">
                Date
              </th>

              <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-950">
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

            {items.map((item) =>
              isFirstInGroup(item) ? (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-200"
                >
                  {/* ACTION */}
                  <td className="px-4 py-2.5">
                    {editingId === item.id ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const group =
                              getHolidayGroup(item);

                            if (group.length === 1) {
                              handleEdit(item.id);
                            } else {
                              handleGroupEditSave(item.id);
                            }
                          }}
                          className="text-xs font-medium text-green-600 hover:text-green-700"
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={cancelInlineEdit}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const group =
                              getHolidayGroup(item);

                            setEditingId(item.id);
                            setEditingName(item.name);
                            setEditingDescription(
                              item.description || ""
                            );
                            setEditingGroup(null);

                            if (group.length === 1) {
                              setEditingDate(
                                formatDateForInput(item.date)
                              );
                              setGroupStartDate("");
                              setGroupEndDate("");
                            } else {
                              setEditingDate("");
                              setGroupStartDate(
                                formatDateForInput(group[0].date)
                              );
                              setGroupEndDate(
                                formatDateForInput(
                                  group[group.length - 1].date
                                )
                              );
                            }
                          }}
                          className="text-xs font-medium text-slate-700 hover:text-slate-900"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              item.id,
                              item.name
                            )
                          }
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>

                  {/* HOLIDAY NAME */}
                  <td className="px-4 py-2.5 text-slate-700">
                    {editingId === item.id ? (
                      <input
                        value={editingName}
                        onChange={(e) =>
                          setEditingName(e.target.value)
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
                      />
                    ) : (
                      item.name
                    )}
                  </td>

                  {/* DATE */}
                  <td className="px-4 py-2.5 text-slate-700">
                    {editingId === item.id ? (
                      getHolidayGroup(item).length === 1 ? (
                        <input
                          type="date"
                          value={editingDate}
                          onChange={(e) =>
                            setEditingDate(e.target.value)
                          }
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
                        />
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={groupStartDate}
                            onChange={(e) =>
                              setGroupStartDate(e.target.value)
                            }
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
                          />

                          <span className="text-slate-400">
                            to
                          </span>

                          <input
                            type="date"
                            value={groupEndDate}
                            onChange={(e) =>
                              setGroupEndDate(e.target.value)
                            }
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
                          />
                        </div>
                      )
                    ) : (
                      formatDateRange(item)
                    )}
                  </td>

                  {/* DESCRIPTION */}
                  <td className="max-w-xs px-4 py-2.5 text-slate-700">
                    {editingId === item.id ? (
                      <input
                        value={editingDescription}
                        onChange={(e) =>
                          setEditingDescription(e.target.value)
                        }
                        placeholder="Description (optional)"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
                      />
                    ) : (
                      <span className="truncate">
                        {item.description || "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ) : null
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}