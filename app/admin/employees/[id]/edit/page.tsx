"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Option {
  id: string;
  name: string;
}

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<Option[]>([]);

  const [formData, setFormData] = useState({
    fullName: "",
    mobile: "",
    gender: "",
    isActive: true,
    role: "EMPLOYEE",
    departmentId: "",
    designationId: "",
    employeeTypeId: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [empRes, deptsRes, desigsRes, typesRes] =
          await Promise.all([
            fetch(`/api/employees/${id}`),
            fetch("/api/departments"),
            fetch("/api/designations"),
            fetch("/api/employee-types"),
          ]);

        const emp = await empRes.json();
        const depts = await deptsRes.json();
        const desigs = await desigsRes.json();
        const types = await typesRes.json();

        // Employee
        if (!empRes.ok) {
          throw new Error(
            emp.error || "Failed to load employee"
          );
        }

        // Options APIs may return permission errors.
        // Always keep state as arrays.
        if (!deptsRes.ok) {
          console.error("Departments API:", depts);
          toast.error(
            depts.error || "Failed to load departments"
          );
        }

        if (!desigsRes.ok) {
          console.error("Designations API:", desigs);
          toast.error(
            desigs.error || "Failed to load designations"
          );
        }

        if (!typesRes.ok) {
          console.error("Employee Types API:", types);
          toast.error(
            types.error || "Failed to load employee types"
          );
        }

        setFormData({
          fullName: emp.fullName ?? "",
          mobile: emp.mobile ?? "",
          gender: emp.gender ?? "",
          isActive: emp.isActive,
          role: emp.role,
          departmentId: emp.department?.id ?? "",
          designationId: emp.designation?.id ?? "",
          employeeTypeId: emp.employeeType?.id ?? "",
        });

        setDepartments(
          Array.isArray(depts) ? depts : []
        );

        setDesignations(
          Array.isArray(desigs) ? desigs : []
        );

        setEmployeeTypes(
          Array.isArray(types) ? types : []
        );
      } catch (error) {
        console.error("Failed to load edit employee:", error);

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load employee"
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          mobile: formData.mobile || null,
          gender: formData.gender || null,
          isActive: formData.isActive,
          role: formData.role,
          departmentId: formData.departmentId || null,
          designationId: formData.designationId || null,
          employeeTypeId: formData.employeeTypeId || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update employee");
      }

      toast.success("Employee updated");
      router.push(`/admin/employees/${id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-2xl">
      <button
        onClick={() => router.push(`/admin/employees/${id}`)}
        className="text-sm text-slate-900 hover:text-slate-700 font-semibold transition-colors duration-200 mb-6"
      >
        ← Back to Employee
      </button>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-950 tracking-tight">Edit Employee</h1>
        <p className="text-slate-500 mt-2 font-normal text-sm">Update employee details</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Full Name</label>
            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Mobile</label>
            <input
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Department</label>
            <select
              name="departmentId"
              value={formData.departmentId}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Designation</label>
            <select
              name="designationId"
              value={formData.designationId}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">Select designation</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Employee Type</label>
            <select
              name="employeeTypeId"
              value={formData.employeeTypeId}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">Select employee type</option>
              {employeeTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Status</label>
            <select
              name="isActive"
              value={formData.isActive ? "true" : "false"}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/admin/employees/${id}`)}
            className="border border-slate-300 text-slate-900 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}