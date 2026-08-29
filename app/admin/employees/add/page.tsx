"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Option {
  id: string;
  name: string;
}

interface UserTypeOption {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
}

export default function AddEmployeePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [loadingUserTypes, setLoadingUserTypes] = useState(true);

  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<Option[]>([]);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    mobile: "",
    gender: "",
    departmentId: "",
    designationId: "",
    employeeTypeId: "",
    userTypeId: "",
    role: "EMPLOYEE",
  });

  const [errors, setErrors] = useState({
    fullName: "",
    email: "",
    password: "",
    mobile: "",
    role: "",
    userTypeId: "",
  });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [
          departmentsRes,
          designationsRes,
          employeeTypesRes,
          userTypesRes,
        ] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/designations"),
          fetch("/api/employee-types"),
          fetch("/api/user-types"),
        ]);

        const [
          departmentsData,
          designationsData,
          employeeTypesData,
          userTypesData,
        ] = await Promise.all([
          departmentsRes.json(),
          designationsRes.json(),
          employeeTypesRes.json(),
          userTypesRes.json(),
        ]);

        if (departmentsRes.ok) {
          setDepartments(
            Array.isArray(departmentsData)
              ? departmentsData
              : departmentsData.data ?? []
          );
        }

        if (designationsRes.ok) {
          setDesignations(
            Array.isArray(designationsData)
              ? designationsData
              : designationsData.data ?? []
          );
        }

        if (employeeTypesRes.ok) {
          setEmployeeTypes(
            Array.isArray(employeeTypesData)
              ? employeeTypesData
              : employeeTypesData.data ?? []
          );
        }

        if (!userTypesRes.ok) {
          throw new Error(
            userTypesData.error || "Failed to load User Types"
          );
        }

        setUserTypes(userTypesData.data ?? []);
      } catch (error) {
        console.error("Failed to load form options:", error);

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load form options"
        );
      } finally {
        setLoadingUserTypes(false);
      }
    };

    loadOptions();
  }, []);

  const validateFullName = (value: string) => {
    if (!value.trim()) {
      return "Full name is required";
    }

    if (value.trim().length < 2) {
      return "Full name must be at least 2 characters";
    }

    return "";
  };

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      return "Email is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value.trim())) {
      return "Please enter a valid email address";
    }

    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) {
      return "Password is required";
    }

    if (value.length < 8) {
      return "Password must be at least 8 characters";
    }

    return "";
  };

  const validateMobile = (value: string) => {
    if (!value) {
      return "";
    }

    const cleaned = value.replace(/\D/g, "");

    if (cleaned.length !== value.length) {
      return "Phone number should contain only digits";
    }

    if (cleaned.length !== 10) {
      return "Phone number must be exactly 10 digits";
    }

    return "";
  };

  const validateRole = (value: string) => {
    if (!value) {
      return "Please select a role";
    }

    return "";
  };

  const validateUserType = (
    value: string,
    role: string
  ) => {
    // Main Admin does not need a UserType because
    // ADMIN automatically has full access.
    if (role === "ADMIN") {
      return "";
    }

    if (!value) {
      return "Please select a User Type";
    }

    return "";
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: value,
      };

      // If role changes to ADMIN, UserType is not required.
      // If role changes back to EMPLOYEE, validate UserType.
      if (name === "role") {
        setErrors((prevErrors) => ({
          ...prevErrors,
          role: validateRole(value),
          userTypeId: validateUserType(
            updated.userTypeId,
            value
          ),
        }));
      } else if (name === "userTypeId") {
        setErrors((prevErrors) => ({
          ...prevErrors,
          userTypeId: validateUserType(
            value,
            updated.role
          ),
        }));
      } else {
        let errorMessage = "";

        if (name === "fullName") {
          errorMessage = validateFullName(value);
        } else if (name === "email") {
          errorMessage = validateEmail(value);
        } else if (name === "password") {
          errorMessage = validatePassword(value);
        } else if (name === "mobile") {
          errorMessage = validateMobile(value);
        }

        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: errorMessage,
        }));
      }

      return updated;
    });
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const fullNameError = validateFullName(
      formData.fullName
    );

    const emailError = validateEmail(
      formData.email
    );

    const passwordError = validatePassword(
      formData.password
    );

    const mobileError = validateMobile(
      formData.mobile
    );

    const roleError = validateRole(
      formData.role
    );

    const userTypeError = validateUserType(
      formData.userTypeId,
      formData.role
    );

    setErrors({
      fullName: fullNameError,
      email: emailError,
      password: passwordError,
      mobile: mobileError,
      role: roleError,
      userTypeId: userTypeError,
    });

    if (
      fullNameError ||
      emailError ||
      passwordError ||
      mobileError ||
      roleError ||
      userTypeError
    ) {
      toast.error(
        "Please fix the errors before submitting"
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          password: formData.password,
          mobile: formData.mobile || null,
          gender: formData.gender || null,
          departmentId:
            formData.departmentId || null,
          designationId:
            formData.designationId || null,
          employeeTypeId:
            formData.employeeTypeId || null,

          // ADMIN does not need a UserType.
          // EMPLOYEE gets permissions from this UserType.
          userTypeId:
            formData.role === "ADMIN"
              ? null
              : formData.userTypeId,

          role: formData.role,
        }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(
          responseData.error ||
          "Failed to create employee"
        );
      }

      const newEmployee =
        responseData.data ?? responseData;

      toast.success(
        `Employee ${newEmployee.fullName ||
        formData.fullName
        } created!`
      );

      router.push("/admin/employees");
      router.refresh();
    } catch (error) {
      console.error(
        "Failed to create employee:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "An error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = formData.role === "ADMIN";

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
          Add Employee
        </h1>

        <p className="text-slate-500 mt-2 font-normal text-sm">
          Create a new employee account
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg border border-slate-200 p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div className="grid grid-cols-2 gap-6">
          {/* FULL NAME */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Full Name *
            </label>

            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.fullName
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.fullName && (
              <p className="mt-1 text-sm text-red-600">
                {errors.fullName}
              </p>
            )}
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Email *
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.email
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.email && (
              <p className="mt-1 text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Password *
            </label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.password
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.password && (
              <p className="mt-1 text-sm text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          {/* MOBILE */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Mobile
            </label>

            <input
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              inputMode="numeric"
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.mobile
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.mobile && (
              <p className="mt-1 text-sm text-red-600">
                {errors.mobile}
              </p>
            )}
          </div>

          {/* GENDER */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Gender
            </label>

            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">Select</option>
              <option value="male">
                Male
              </option>
              <option value="female">
                Female
              </option>
              <option value="other">
                Other
              </option>
            </select>
          </div>

          {/* ROLE */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Role *
            </label>

            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.role
                ? "border-red-500"
                : "border-slate-300"
                }`}
            >
              <option value="EMPLOYEE">
                Employee
              </option>

              <option value="ADMIN">
                Admin
              </option>
            </select>

            {errors.role && (
              <p className="mt-1 text-sm text-red-600">
                {errors.role}
              </p>
            )}
          </div>

          {/* USER TYPE */}
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              User Type {!isAdmin && "*"}
            </label>

            <select
              name="userTypeId"
              value={formData.userTypeId}
              onChange={handleChange}
              disabled={isAdmin || loadingUserTypes}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 ${errors.userTypeId
                ? "border-red-500"
                : "border-slate-300"
                }`}
            >
              <option value="">
                {loadingUserTypes
                  ? "Loading User Types..."
                  : isAdmin
                    ? "Not required for Admin"
                    : "Select User Type"}
              </option>

              {!loadingUserTypes &&
                userTypes.map((userType) => (
                  <option
                    key={userType.id}
                    value={userType.id}
                  >
                    {userType.name}
                    {userType.isSystem
                      ? " (System)"
                      : ""}
                  </option>
                ))}
            </select>

            {errors.userTypeId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.userTypeId}
              </p>
            )}

            {isAdmin ? (
              <p className="mt-2 text-xs text-slate-500">
                Admin users automatically have full
                system access. A User Type is not
                required.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                The selected User Type determines
                which modules and actions this employee
                can access.
              </p>
            )}
          </div>

          {/* DEPARTMENT */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Department
            </label>

            <select
              name="departmentId"
              value={formData.departmentId}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">
                Select department
              </option>

              {departments.map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          {/* DESIGNATION */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Designation
            </label>

            <select
              name="designationId"
              value={formData.designationId}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">
                Select designation
              </option>

              {designations.map((designation) => (
                <option
                  key={designation.id}
                  value={designation.id}
                >
                  {designation.name}
                </option>
              ))}
            </select>
          </div>

          {/* EMPLOYEE TYPE */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Employee Type
            </label>

            <select
              name="employeeTypeId"
              value={formData.employeeTypeId}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200"
            >
              <option value="">
                Select employee type
              </option>

              {employeeTypes.map((employeeType) => (
                <option
                  key={employeeType.id}
                  value={employeeType.id}
                >
                  {employeeType.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ADMIN INFORMATION */}
        {isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              Full Admin Access
            </p>

            <p className="mt-1 text-xs text-amber-700">
              This account will have full access to
              the system regardless of User Type
              permissions.
            </p>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={
              loading ||
              loadingUserTypes
            }
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? "Creating..."
              : "Create Employee"}
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/admin/employees")
            }
            className="border border-slate-300 text-slate-900 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}