"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { usePermission } from "@/lib/hooks/userPermission";

interface Employee {
  id: string;
  employeeCode: number;
  fullName: string;
  email: string;
  mobile?: string;
  role: "ADMIN" | "EMPLOYEE";
  isActive: boolean;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  createdAt: string;
}

export default function EmployeesPage() {
  const router = useRouter();

  // Module access
  const {
    hasPermission: canView,
    loading: viewLoading,
    error: viewError,
  } = usePermission("Employee", "view");

  // Action permissions
  const {
    hasPermission: canAdd,
    loading: addLoading,
  } = usePermission("Employee List", "add");

  const {
    hasPermission: canEdit,
    loading: editLoading,
  } = usePermission("Employee List", "edit");

  const {
    hasPermission: canDelete,
    loading: deleteLoading,
  } = usePermission("Employee List", "delete");

  const {
    hasPermission: canImport,
    loading: importLoading,
  } = usePermission("Employee Bulk Upload", "import");

  const {
    hasPermission: canViewExport,
    loading: exportViewLoading,
  } = usePermission("Employee Export", "view");

  const {
    hasPermission: canExportEmployees,
    loading: employeeExportLoading,
  } = usePermission("Employee Export", "export");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const itemsPerPage = 10;

  const permissionLoading =
    viewLoading ||
    addLoading ||
    editLoading ||
    deleteLoading ||
    importLoading ||
    exportViewLoading ||
    employeeExportLoading;

  useEffect(() => {
    if (!viewLoading && canView) {
      fetchEmployees();
    } else if (!viewLoading && !canView) {
      setLoading(false);
    }
  }, [viewLoading, canView]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/employees");

      if (!res.ok) {
        if (res.status === 403) {
          toast.error("You do not have permission to view employees");
        } else {
          throw new Error("Failed to fetch");
        }

        return;
      }

      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      toast.error("Failed to load employees");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete employees");
      return;
    }

    if (!confirm(`Delete ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        if (res.status === 403) {
          toast.error("You do not have permission to delete employees");
        } else {
          throw new Error("Failed to delete");
        }

        return;
      }

      setEmployees((current) =>
        current.filter((employee) => employee.id !== id)
      );

      toast.success(`${name} deleted`);
    } catch (error) {
      toast.error("Failed to delete employee");
      console.error(error);
    }
  };

  // Permission loading
  if (permissionLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-slate-500">
          Loading permissions...
        </div>
      </div>
    );
  }

  // Permission denied
  if (viewError || !canView) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl font-bold text-red-600">!</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-950">
            Access Denied
          </h1>

          <p className="mt-3 text-slate-600">
            You don't have permission to view the Employee module.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Please contact your administrator if you need access.
          </p>

          <button
            onClick={() => router.push("/admin/dashboard")}
            className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedEmployees = filteredEmployees.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(
    filteredEmployees.length / itemsPerPage
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
            Employees
          </h1>

          <p className="text-slate-500 mt-2 font-normal text-sm">
            Manage all employees in the system
          </p>
        </div>

        <div className="flex gap-3">
          {/* Employee Export permission */}
          {canViewExport && canExportEmployees && (
            <button
              onClick={async () => {
                if (!canExportEmployees) {
                  toast.error(
                    "You do not have permission to export employees"
                  );
                  return;
                }

                try {
                  const res = await fetch(
                    "/api/employees/export"
                  );

                  if (!res.ok) {
                    if (res.status === 403) {
                      toast.error(
                        "You do not have permission to export employees"
                      );
                    } else {
                      toast.error(
                        "Failed to export employees"
                      );
                    }

                    return;
                  }

                  const blob = await res.blob();

                  const url =
                    window.URL.createObjectURL(blob);

                  const a =
                    document.createElement("a");

                  a.href = url;
                  a.download = "employees.xlsx";

                  document.body.appendChild(a);

                  a.click();

                  a.remove();

                  window.URL.revokeObjectURL(url);

                  toast.success(
                    "Employees exported successfully"
                  );
                } catch (error) {
                  console.error(
                    "Employee export error:",
                    error
                  );

                  toast.error(
                    "Failed to export employees"
                  );
                }
              }}
              disabled={!canExportEmployees}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md"
            >
              Export Excel
            </button>
          )}

          {/* Import permission */}
          {canImport && (
            <button
              onClick={() =>
                router.push("/admin/employees/bulk-upload")
              }
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md flex items-center gap-2"
            >
              Bulk Upload
            </button>
          )}

          {/* Add permission */}
          {canAdd && (
            <button
              onClick={() =>
                router.push("/admin/employees/add")
              }
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md"
            >
              + Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">
          Loading employees...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg text-slate-500">
          No employees found.{" "}

          {canAdd && (
            <button
              onClick={() =>
                router.push("/admin/employees/add")
              }
              className="text-slate-900 hover:underline font-semibold"
            >
              Create one now.
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <table className="w-full">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Name
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Email
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Designation
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Department
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Status
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-950 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-200"
                  >
                    <td className="px-6 py-4 text-sm text-slate-900 font-semibold">
                      <button
                        onClick={() =>
                          router.push(
                            `/admin/employees/${emp.id}`
                          )
                        }
                        className="text-slate-900 hover:text-slate-700 hover:underline text-left font-semibold"
                      >
                        {emp.fullName}
                      </button>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {emp.email}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {emp.designation?.name || "—"}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {emp.department?.name || "—"}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${emp.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                          }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${emp.isActive
                            ? "bg-emerald-600"
                            : "bg-red-600"
                            }`}
                        />

                        {emp.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm space-x-3">
                      {/* Edit permission */}
                      {canEdit && (
                        <button
                          onClick={() =>
                            router.push(
                              `/admin/employees/${emp.id}/edit`
                            )
                          }
                          className="text-slate-900 hover:text-slate-700 font-semibold hover:bg-slate-100 px-2 py-1 rounded transition-all duration-200"
                        >
                          Edit
                        </button>
                      )}

                      {/* Delete permission */}
                      {canDelete && (
                        <button
                          onClick={() =>
                            handleDelete(
                              emp.id,
                              emp.fullName
                            )
                          }
                          className="text-red-600 hover:text-red-700 font-semibold hover:bg-red-50 px-2 py-1 rounded transition-all duration-200"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-slate-600">
                Showing{" "}
                {paginatedEmployees.length > 0
                  ? (page - 1) * itemsPerPage + 1
                  : 0}
                -
                {Math.min(
                  page * itemsPerPage,
                  filteredEmployees.length
                )}{" "}
                of {filteredEmployees.length}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setPage((p) => Math.max(1, p - 1))
                  }
                  disabled={page === 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-medium text-sm"
                >
                  Previous
                </button>

                <span className="px-4 py-2 text-slate-700 font-medium">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() =>
                    setPage((p) =>
                      Math.min(totalPages, p + 1)
                    )
                  }
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-medium text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}