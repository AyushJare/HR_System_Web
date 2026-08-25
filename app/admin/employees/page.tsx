"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch");
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
    if (!confirm(`Delete ${name}? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setEmployees(employees.filter((e) => e.id !== id));
      toast.success(`${name} deleted`);
    } catch (error) {
      toast.error("Failed to delete employee");
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedEmployees = filteredEmployees.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Employees</h1>
          <p className="text-slate-600 mt-1">
            Manage all employees in the system
          </p>
        </div>
        <div className="flex gap-4">

          <button
            onClick={() => router.push("/admin/employees/bulk-upload")}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition flex items-center gap-2"
          >
            ⬆️ Bulk Upload
          </button>
          <button
            onClick={() => router.push("/admin/employees/add")}
            className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-6 rounded-lg transition"
          >
            + Add Employee
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1); // Reset to page 1 on search
          }}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <button
            onClick={() => router.push("/admin/employees/add")}
            className="text-blue-600 hover:underline"
          >
            Create one now.
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Designation
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                      <button
                        onClick={() => router.push(`/admin/employees/${emp.id}`)}
                        className="text-blue-700 hover:underline text-left"
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
                        className={`px-3 py-1 rounded-full text-xs font-medium ${emp.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                          }`}
                      >
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => router.push(`/admin/employees/${emp.id}/edit`)}
                        className="text-blue-600 hover:text-blue-800 font-medium mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id, emp.fullName)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
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
                Showing {paginatedEmployees.length > 0 ? (page - 1) * itemsPerPage + 1 : 0}
                -
                {Math.min(page * itemsPerPage, filteredEmployees.length)}
                of {filteredEmployees.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
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