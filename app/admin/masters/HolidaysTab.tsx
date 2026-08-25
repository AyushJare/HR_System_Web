"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface UploadError {
  row: number;
  field: string;
  message: string;
}

export default function HolidaysTab() {
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] =
    useState<any>(null);

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

  const handleAdd = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!newName.trim() || !newDate) return;

    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newName,
        date: newDate,
      }),
    });

    if (!res.ok) {
      const err = await res.json();

      toast.error(
        err.error || "Failed to add"
      );

      return;
    }

    toast.success("Holiday added");

    setNewName("");
    setNewDate("");

    load();
  };

  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = async (
    id: string,
    name: string
  ) => {
    if (!confirm(`Delete "${name}"?`)) return;

    const res = await fetch(
      `/api/holidays/${id}`,
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
      console.error("Holiday template download error:", error);

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

  const handleUpload = async (
    e: React.FormEvent
  ) => {
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
          data.error ||
          "Holiday upload failed"
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

      const input =
        document.getElementById(
          "holiday-upload"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await load();
    } catch {
      toast.error(
        "Holiday upload failed"
      );
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
            Upload multiple holidays using an Excel
            file. A holiday will be created for every
            day between the Start Date and End Date.
          </p>
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={
              handleDownloadTemplate
            }
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
              setFile(
                e.target.files?.[0] ||
                null
              )
            }
            className="block rounded-md border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
          />

          <button
            type="submit"
            disabled={
              !file || uploading
            }
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Uploading..."
              : "Upload Holidays"}
          </button>
        </form>

        {/* ===================================================
            UPLOAD RESULTS
        ==================================================== */}

        {uploadResult && (
          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800">
              Upload Results
            </h3>

            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-green-700">
                ✓ Created:{" "}
                {uploadResult.success ??
                  0}
              </span>

              <span className="text-red-700">
                ✗ Failed:{" "}
                {uploadResult.failed ??
                  0}
              </span>
            </div>

            {uploadResult.errors
              ?.length > 0 && (
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
                      {(
                        uploadResult.errors as UploadError[]
                      ).map(
                        (
                          error,
                          index
                        ) => (
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
        className="mb-4 flex gap-2"
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

        <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          Add
        </button>
      </form>

      {/* =====================================================
          HOLIDAY TABLE
      ====================================================== */}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-24 px-4 py-3 text-left font-medium text-slate-600">
                Action
              </th>

              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Holiday Name
              </th>

              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Date
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
                  <button
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
                </td>

                <td className="px-4 py-2.5 text-slate-700">
                  {item.name}
                </td>

                <td className="px-4 py-2.5 text-slate-700">
                  {new Date(
                    item.date
                  ).toLocaleDateString(
                    undefined,
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }
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