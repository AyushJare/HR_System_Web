"use client";

import { useRef, useState } from "react";
import DepartmentsTab from "./DepartmentsTab";
import DesignationsTab from "./DesignationsTab";
import EmployeeTypesTab from "./EmployeeTypesTab";
import HolidaysTab from "./HolidaysTab";
import LeaveTypesTab from "./LeaveTypesTab";
import WeeklyOffTab from "./WeeklyOffTab";

const tabs = [
  { key: "departments", label: "Departments" },
  { key: "designations", label: "Designations" },
  { key: "employeeTypes", label: "Employee Types" },
  { key: "holidays", label: "Holidays" },
  { key: "leaveTypes", label: "Leave Types" },
  { key: "weeklyOff", label: "Weekly Off" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function MastersPage() {
  const [active, setActive] = useState<TabKey>("departments");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBulkUpload() {
    if (!selectedFile) {
      setUploadError("Please select an Excel file first.");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadResult(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/masters/bulk-upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (result.errors?.length > 0) {
          setUploadError(
            result.errors
              .map(
                (error: {
                  sheet: string;
                  row: number;
                  field: string;
                  message: string;
                }) =>
                  `${error.sheet} - Row ${error.row} (${error.field}): ${error.message}`
              )
              .join("\n")
          );
        } else {
          setUploadError(
            result.error ||
            result.message ||
            "Bulk upload failed."
          );
        }

        return;
      }

      setUploadResult(result);
    } catch (error) {
      console.error("Bulk upload error:", error);

      setUploadError(
        "Something went wrong while uploading the file."
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Masters
          </h1>

          <p className="text-slate-600 mt-1">
            Manage the reference data used throughout the system.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowBulkUpload(true);
            setSelectedFile(null);
            setUploadError(null);
            setUploadResult(null);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Bulk Upload
        </button>
      </div>

      <div className="border-b border-slate-200 mb-6 flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={
              active === tab.key
                ? "pb-3 text-sm font-medium text-blue-700 border-b-2 border-blue-700"
                : "pb-3 text-sm font-medium text-slate-500 hover:text-slate-700"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "departments" && <DepartmentsTab />}
      {active === "designations" && <DesignationsTab />}
      {active === "employeeTypes" && <EmployeeTypesTab />}
      {active === "holidays" && <HolidaysTab />}
      {active === "leaveTypes" && <LeaveTypesTab />}
      {active === "weeklyOff" && <WeeklyOffTab />}

      {showBulkUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">

            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Bulk Upload Master Data
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Upload Departments, Designations, Employee Types,
                  Holidays, Leave Types and Weekly Off data using one Excel file.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkUpload(false)}
                disabled={uploading}
                className="text-xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-slate-800">
                Need the template?
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Download the Excel template, fill the required sheets,
                and upload it here.
              </p>

              <a
                href="/api/templates/masters"
                className="mt-3 inline-block rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Download Excel Template
              </a>
            </div>

            {!uploadResult && (
              <>
                <div className="mt-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;

                      if (file && !file.name.toLowerCase().endsWith(".xlsx")) {
                        setUploadError(
                          "Please select a valid .xlsx Excel file."
                        );
                        setSelectedFile(null);
                        return;
                      }

                      setSelectedFile(file);
                      setUploadError(null);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-blue-500 hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {selectedFile
                        ? selectedFile.name
                        : "Click to choose an Excel file"}
                    </span>

                    <span className="mt-1 text-xs text-slate-500">
                      Only .xlsx files are supported
                    </span>
                  </button>
                </div>

                {uploadError && (
                  <div className="mt-4 whitespace-pre-line rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {uploadError}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBulkUpload(false)}
                    disabled={uploading}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkUpload}
                    disabled={!selectedFile || uploading}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Upload Data"}
                  </button>
                </div>
              </>
            )}

            {uploadResult && (
              <div className="mt-6">
                <div className="rounded-md border border-green-200 bg-green-50 p-4">
                  <h3 className="font-medium text-green-800">
                    Master Data Uploaded Successfully
                  </h3>

                  <p className="mt-1 text-sm text-green-700">
                    Created: {uploadResult.summary.created} ·
                    Updated: {uploadResult.summary.updated} ·
                    Skipped: {uploadResult.summary.skipped}
                  </p>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    Departments — Created: {uploadResult.details.departments.created},
                    Updated: {uploadResult.details.departments.updated},
                    Skipped: {uploadResult.details.departments.skipped}
                  </div>

                  <div>
                    Designations — Created: {uploadResult.details.designations.created},
                    Updated: {uploadResult.details.designations.updated},
                    Skipped: {uploadResult.details.designations.skipped}
                  </div>

                  <div>
                    Employee Types — Created: {uploadResult.details.employeeTypes.created},
                    Updated: {uploadResult.details.employeeTypes.updated},
                    Skipped: {uploadResult.details.employeeTypes.skipped}
                  </div>

                  <div>
                    Holidays — Created: {uploadResult.details.holidays.created},
                    Updated: {uploadResult.details.holidays.updated},
                    Skipped: {uploadResult.details.holidays.skipped}
                  </div>

                  <div>
                    Leave Types — Created: {uploadResult.details.leaveTypes.created},
                    Updated: {uploadResult.details.leaveTypes.updated},
                    Skipped: {uploadResult.details.leaveTypes.skipped}
                  </div>

                  <div>
                    Weekly Off — Created: {uploadResult.details.weeklyOff.created},
                    Updated: {uploadResult.details.weeklyOff.updated},
                    Skipped: {uploadResult.details.weeklyOff.skipped}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkUpload(false);
                      window.location.reload();
                    }}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}