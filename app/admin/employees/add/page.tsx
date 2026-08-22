"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Option {
  id: string;
  name: string;
}

export default function AddEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<Option[]>([]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    mobile: "",
    gender: "",
    departmentId: "",
    designationId: "",
    employeeTypeId: "",
    role: "EMPLOYEE",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/departments").then((r) => r.json()),
      fetch("/api/designations").then((r) => r.json()),
      fetch("/api/employee-types").then((r) => r.json()),
    ]).then(([depts, desigs, types]) => {
      setDepartments(depts);
      setDesignations(desigs);
      setEmployeeTypes(types);
    });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.fullName || !formData.email || !formData.password) {
        toast.error("Name, email, and password are required");
        setLoading(false);
        return;
      }

      if (formData.password.length < 8) {
        toast.error("Password must be at least 8 characters");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          mobile: formData.mobile || null,
          gender: formData.gender || null,
          departmentId: formData.departmentId || null,
          designationId: formData.designationId || null,
          employeeTypeId: formData.employeeTypeId || null,
          role: formData.role,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create employee");
      }

      const newEmployee = await res.json();
      toast.success(`Employee ${newEmployee.fullName} created!`);
      router.push("/admin/employees");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Add Employee</h1>
        <p className="text-slate-600 mt-1">Create a new employee account</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
            <input
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select
              name="departmentId"
              value={formData.departmentId}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
            <select
              name="designationId"
              value={formData.designationId}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select designation</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee Type</label>
            <select
              name="employeeTypeId"
              value={formData.employeeTypeId}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select employee type</option>
              {employeeTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2 rounded-md disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Employee"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/employees")}
            className="text-sm font-medium text-slate-600 px-5 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}