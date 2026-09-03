"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { validatePassword as validatePasswordUtil } from "@/lib/validators/password";
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  validateRequired,
  validateEmailFormat,
  validatePhoneFormat,
  validateMinLength,
  validateSelectField,
  handleApiError,
  validateArrayResponse,
} from "@/lib/utils/errorHandler";

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

interface Employee {
  id: string;
  fullName: string;
  email: string;
  mobile?: string | null;
  gender?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  employeeTypeId?: string | null;
  userTypeId?: string | null;
  role: string;
}

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingEmployee, setLoadingEmployee] = useState(true);
  const [loadingUserTypes, setLoadingUserTypes] = useState(true);
  const [loadingOtherData, setLoadingOtherData] = useState(true);

  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<Option[]>([]);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);

  const [currentUserType, setCurrentUserType] = useState<string | null>(null);

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
    password: [] as string[],
    mobile: [] as string[],
    gender: "",
    role: "",
    userTypeId: "",
    departmentId: "",
    designationId: "",
    employeeTypeId: "",
  });

  // Load employee data
  useEffect(() => {
    const loadEmployee = async () => {
      try {
        setLoadingEmployee(true);

        if (!employeeId) {
          throw new Error("Employee ID is required");
        }

        const res = await fetch(`/api/employees/${employeeId}`);

        if (!res.ok) {
          throw new Error(`Failed to load employee: HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!data || typeof data !== "object") {
          throw new Error("Invalid employee data format");
        }

        const employee = data.data || data;

        setFormData({
          fullName: employee.fullName || "",
          email: employee.email || "",
          password: "", // Never show the existing password
          mobile: employee.mobile || "",
          gender: employee.gender || "",
          departmentId: employee.departmentId || "",
          designationId: employee.designationId || "",
          employeeTypeId: employee.employeeTypeId || "",
          userTypeId: employee.userTypeId || "",
          role: employee.role || "EMPLOYEE",
        });

        // Store the current user type
        if (employee.userTypeId) {
          setCurrentUserType(employee.userTypeId);
        }
      } catch (error) {
        handleApiError(error, "Loading employee");

        setTimeout(() => {
          router.push("/admin/employees");
        }, 2000);
      } finally {
        setLoadingEmployee(false);
      }
    };

    loadEmployee();
  }, [employeeId, router]);

  // Load form options
  useEffect(() => {
    const loadAllOptions = async () => {
      try {
        setLoadingOtherData(true);

        const endpoints = [
          {
            url: "/api/departments",
            setState: setDepartments,
            name: "Departments",
          },
          {
            url: "/api/designations",
            setState: setDesignations,
            name: "Designations",
          },
          {
            url: "/api/employee-types",
            setState: setEmployeeTypes,
            name: "Employee Types",
          },
        ];

        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint.url);

            if (!res.ok) {
              throw new Error(`${endpoint.name}: HTTP ${res.status}`);
            }

            const data = await res.json();

            const validData = validateArrayResponse(
              data,
              endpoint.name
            );

            endpoint.setState(
              (Array.isArray(validData) ? validData : []) as Option[]
            );
          } catch (error) {
            handleApiError(error, `Loading ${endpoint.name}`);
            endpoint.setState([]);
          }
        }

        setLoadingOtherData(false);
      } catch (error) {
        handleApiError(error, "Loading form options");
        setLoadingOtherData(false);
      }
    };

    const loadUserTypes = async () => {
      try {
        setLoadingUserTypes(true);

        const res = await fetch("/api/user-types");

        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}: Failed to load User Types`
          );
        }

        const data = await res.json();

        if (!data || typeof data !== "object") {
          throw new Error(
            "Invalid User Types response format"
          );
        }

        const userTypesArray = data.data || data;

        setUserTypes(
          (validateArrayResponse(
            userTypesArray,
            "User Types"
          ) as UserTypeOption[]) || []
        );
      } catch (error) {
        handleApiError(error, "Loading User Types");
        setUserTypes([]);
      } finally {
        setLoadingUserTypes(false);
      }
    };

    loadAllOptions();
    loadUserTypes();
  }, []);

  // Validation functions
  const validateFullName = (value: string): string => {
    try {
      if (!validateRequired(value, "Full Name")) {
        return "Full name is required";
      }

      if (!validateMinLength(value, 2, "Full Name")) {
        return "Full name must be at least 2 characters";
      }

      if (value.length > 100) {
        showErrorToast(
          "Full Name Length",
          "Full name must not exceed 100 characters"
        );

        return "Full name must not exceed 100 characters";
      }

      return "";
    } catch (error) {
      handleApiError(error, "Full Name Validation");
      return "Validation error";
    }
  };

  const validateEmailField = (value: string): string => {
    try {
      if (!validateRequired(value, "Email")) {
        return "Email is required";
      }

      if (!validateEmailFormat(value)) {
        return "Please enter a valid email address";
      }

      if (value.length > 255) {
        showErrorToast(
          "Email Length",
          "Email must not exceed 255 characters"
        );

        return "Email must not exceed 255 characters";
      }

      return "";
    } catch (error) {
      handleApiError(error, "Email Validation");
      return "Validation error";
    }
  };

  const validatePasswordField = (value: string): string[] => {
    try {
      // Password is optional during edit.
      // Empty means keep the current password.
      if (!value) {
        return [];
      }

      const validation = validatePasswordUtil(value);

      if (
        validation.errors &&
        validation.errors.length > 0
      ) {
        return validation.errors;
      }

      return [];
    } catch (error) {
      handleApiError(error, "Password Validation");
      return ["Validation error occurred"];
    }
  };

  const validateMobileField = (value: string): string[] => {
    try {
      if (!value) return [];

      const cleaned = value.replace(/\D/g, "");
      const errors: string[] = [];

      if (cleaned.length !== value.length) {
        errors.push(
          "Phone number should contain only digits"
        );
      }

      if (cleaned.length !== 10) {
        errors.push(
          "Phone number must be exactly 10 digits"
        );
      }

      if (
        cleaned.length > 0 &&
        !cleaned.startsWith("9")
      ) {
        errors.push(
          "Phone number must start with 9"
        );
      }

      if (errors.length > 0) {
        showErrorToast(
          "Phone Number",
          errors[0]
        );
      }

      return errors;
    } catch (error) {
      handleApiError(error, "Phone Validation");
      return ["Validation error occurred"];
    }
  };

  const validateGenderField = (
    value: string
  ): string => {
    try {
      return "";
    } catch (error) {
      handleApiError(error, "Gender Validation");
      return "Validation error";
    }
  };

  const validateRoleField = (
    value: string
  ): string => {
    try {
      if (
        !validateSelectField(
          value,
          "Role",
          true
        )
      ) {
        return "Please select a role";
      }

      return "";
    } catch (error) {
      handleApiError(error, "Role Validation");
      return "Validation error";
    }
  };

  const validateUserTypeField = (
    value: string,
    role: string
  ): string => {
    try {
      if (role === "ADMIN") return "";

      if (
        !validateSelectField(
          value,
          "User Type",
          true
        )
      ) {
        return "Please select a User Type";
      }

      return "";
    } catch (error) {
      handleApiError(
        error,
        "User Type Validation"
      );

      return "Validation error";
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    try {
      const { name, value } = e.target;

      setFormData((prev) => {
        const updated = {
          ...prev,
          [name]: value,
        };

        try {
          if (name === "role") {
            setErrors((prevErrors) => ({
              ...prevErrors,
              role: validateRoleField(value),
              userTypeId:
                validateUserTypeField(
                  updated.userTypeId,
                  value
                ),
            }));
          } else if (name === "userTypeId") {
            setErrors((prevErrors) => ({
              ...prevErrors,
              userTypeId:
                validateUserTypeField(
                  value,
                  updated.role
                ),
            }));
          } else if (name === "fullName") {
            setErrors((prevErrors) => ({
              ...prevErrors,
              fullName:
                validateFullName(value),
            }));
          } else if (name === "email") {
            setErrors((prevErrors) => ({
              ...prevErrors,
              email:
                validateEmailField(value),
            }));
          } else if (name === "password") {
            // Revalidate password whenever it changes.
            // This also clears the server-side
            // "same password" error once the user
            // changes the password.
            const passwordErrors =
              validatePasswordField(value);

            setErrors((prevErrors) => ({
              ...prevErrors,
              password: passwordErrors,
            }));
          } else if (name === "mobile") {
            const mobileErrors =
              validateMobileField(value);

            setErrors((prevErrors) => ({
              ...prevErrors,
              mobile: mobileErrors,
            }));
          } else if (name === "gender") {
            setErrors((prevErrors) => ({
              ...prevErrors,
              gender:
                validateGenderField(value),
            }));
          }
        } catch (error) {
          handleApiError(
            error,
            `Validating ${name}`
          );
        }

        return updated;
      });
    } catch (error) {
      handleApiError(
        error,
        "Form change handler"
      );
    }
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      const fullNameError =
        validateFullName(formData.fullName);

      const emailError =
        validateEmailField(formData.email);

      const passwordError =
        validatePasswordField(
          formData.password
        );

      const mobileError =
        validateMobileField(
          formData.mobile
        );

      const roleError =
        validateRoleField(
          formData.role
        );

      const userTypeError =
        validateUserTypeField(
          formData.userTypeId,
          formData.role
        );

      setErrors({
        fullName: fullNameError,
        email: emailError,
        password: passwordError,
        mobile: mobileError,
        gender: "",
        role: roleError,
        userTypeId: userTypeError,
        departmentId: "",
        designationId: "",
        employeeTypeId: "",
      });

      if (
        fullNameError ||
        emailError ||
        passwordError.length > 0 ||
        mobileError.length > 0 ||
        roleError ||
        userTypeError
      ) {
        showErrorToast(
          "Validation Failed",
          "Please fix all errors before submitting"
        );

        return;
      }

      setLoading(true);

      showWarningToast(
        "Updating employee..."
      );

      const updateData: any = {
        fullName:
          formData.fullName.trim(),

        email:
          formData.email.trim(),

        mobile:
          formData.mobile || null,

        gender:
          formData.gender || null,

        departmentId:
          formData.departmentId || null,

        designationId:
          formData.designationId || null,

        employeeTypeId:
          formData.employeeTypeId || null,

        userTypeId:
          formData.role === "ADMIN"
            ? null
            : formData.userTypeId,

        role:
          formData.role,
      };

      // Only include password when
      // the admin actually entered one.
      if (formData.password) {
        updateData.password =
          formData.password;
      }

      const res = await fetch(
        `/api/employees/${employeeId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            updateData
          ),
        }
      );

      if (!res.ok) {
        let responseData: any = null;

        try {
          responseData =
            await res.json();
        } catch {
          responseData = null;
        }

        toast.dismiss();

        /*
         * IMPORTANT:
         *
         * The backend checks the supplied password
         * against the existing bcrypt password hash.
         *
         * If they are the same, the backend returns
         * HTTP 400 with an error message.
         *
         * We put that error directly into the password
         * field so the user sees exactly what went wrong.
         */
        if (
          res.status === 400 &&
          responseData?.error
        ) {
          const passwordError =
            responseData.error;

          setErrors((prevErrors) => ({
            ...prevErrors,
            password: [
              passwordError,
            ],
          }));

          showErrorToast(
            "Password Error",
            passwordError
          );

          return;
        }

        throw new Error(
          responseData?.error ||
          `HTTP ${res.status}`
        );
      }

      const responseData =
        await res.json();

      if (!responseData) {
        throw new Error(
          "Empty response from server"
        );
      }

      const updatedEmployee =
        responseData.data ??
        responseData;

      toast.dismiss();

      showSuccessToast(
        `Employee ${updatedEmployee.fullName ||
        formData.fullName
        } updated successfully!`
      );

      setTimeout(() => {
        router.push(
          "/admin/employees"
        );

        router.refresh();
      }, 1000);
    } catch (error) {
      toast.dismiss();

      console.error(
        "Update error:",
        error
      );

      handleApiError(
        error,
        "Employee Update"
      );
    } finally {
      setLoading(false);
    }
  };

  const isAdmin =
    formData.role === "ADMIN";

  const isLoading =
    loading ||
    loadingEmployee ||
    loadingUserTypes ||
    loadingOtherData;

  if (loadingEmployee) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600">
            Loading employee details...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
          Edit Employee
        </h1>

        <p className="text-slate-500 mt-2 font-normal text-sm">
          Update employee information
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
              placeholder="Enter full name"
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
              placeholder="Enter email address"
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
              Password
            </label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Leave empty to keep current password"
              autoComplete="new-password"
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.password.length > 0
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.password &&
              errors.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {errors.password.map(
                    (error, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2"
                      >
                        <span className="text-red-600 mt-0.5">
                          •
                        </span>

                        <p className="text-sm text-red-600">
                          {error}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}

            <p className="mt-1 text-xs text-slate-500">
              Only fill this if you want to change the password
            </p>
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
              placeholder="Enter 10-digit phone number"
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.mobile.length > 0
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.mobile &&
              errors.mobile.length > 0 && (
                <div className="mt-2 space-y-1">
                  {errors.mobile.map(
                    (error, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2"
                      >
                        <span className="text-red-600 mt-0.5">
                          •
                        </span>

                        <p className="text-sm text-red-600">
                          {error}
                        </p>
                      </div>
                    )
                  )}
                </div>
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
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.gender
                ? "border-red-500"
                : "border-slate-300"
                }`}
            >
              <option value="">
                Select gender
              </option>

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

            {errors.gender && (
              <p className="mt-1 text-sm text-red-600">
                {errors.gender}
              </p>
            )}
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
              disabled={
                isAdmin ||
                loadingUserTypes
              }
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 ${errors.userTypeId
                ? "border-red-500"
                : "border-slate-300"
                }`}
            >
              {currentUserType &&
                !loadingUserTypes ? (
                <>
                  <option
                    value={
                      currentUserType
                    }
                  >
                    {
                      userTypes.find(
                        (ut) =>
                          ut.id ===
                          currentUserType
                      )?.name ||
                      "Current User Type"
                    }

                    {userTypes.find(
                      (ut) =>
                        ut.id ===
                        currentUserType
                    )?.isSystem
                      ? " (System)"
                      : ""}
                  </option>

                  <option disabled>
                    ─────────────────
                  </option>

                  {userTypes.map(
                    (userType) => (
                      <option
                        key={
                          userType.id
                        }
                        value={
                          userType.id
                        }
                      >
                        {
                          userType.name
                        }

                        {userType.isSystem
                          ? " (System)"
                          : ""}
                      </option>
                    )
                  )}
                </>
              ) : (
                <>
                  <option value="">
                    {loadingUserTypes
                      ? "Loading User Types..."
                      : isAdmin
                        ? "Not required for Admin"
                        : "Select User Type"}
                  </option>

                  {!loadingUserTypes &&
                    userTypes &&
                    userTypes.length >
                    0 &&
                    userTypes.map(
                      (userType) => (
                        <option
                          key={
                            userType.id
                          }
                          value={
                            userType.id
                          }
                        >
                          {
                            userType.name
                          }

                          {userType.isSystem
                            ? " (System)"
                            : ""}
                        </option>
                      )
                    )}
                </>
              )}
            </select>

            {errors.userTypeId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.userTypeId}
              </p>
            )}

            {isAdmin ? (
              <p className="mt-2 text-xs text-slate-500">
                Admin users automatically have full system access.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                The selected User Type determines which modules this employee can access.
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
              disabled={loadingOtherData}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 ${errors.departmentId
                ? "border-red-500"
                : "border-slate-300"
                }`}
            >
              <option value="">
                {loadingOtherData
                  ? "Loading..."
                  : "Select department"}
              </option>

              {!loadingOtherData &&
                departments &&
                departments.length >
                0 &&
                departments.map(
                  (department) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {
                        department.name
                      }
                    </option>
                  )
                )}
            </select>

            {errors.departmentId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.departmentId}
              </p>
            )}
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
              disabled={loadingOtherData}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 ${errors.designationId
                ? "border-red-500"
                : "border-slate-300"
                }`}
            >
              <option value="">
                {loadingOtherData
                  ? "Loading..."
                  : "Select designation"}
              </option>

              {!loadingOtherData &&
                designations &&
                designations.length >
                0 &&
                designations.map(
                  (designation) => (
                    <option
                      key={
                        designation.id
                      }
                      value={
                        designation.id
                      }
                    >
                      {
                        designation.name
                      }
                    </option>
                  )
                )}
            </select>

            {errors.designationId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.designationId}
              </p>
            )}
          </div>

          {/* EMPLOYEE TYPE */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Employee Type
            </label>

            <select
              name="employeeTypeId"
              value={
                formData.employeeTypeId
              }
              onChange={handleChange}
              disabled={loadingOtherData}
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 ${errors.employeeTypeId
                ? "border-red-500"
                : "border-slate-300"
                }`}
            >
              <option value="">
                {loadingOtherData
                  ? "Loading..."
                  : "Select employee type"}
              </option>

              {!loadingOtherData &&
                employeeTypes &&
                employeeTypes.length >
                0 &&
                employeeTypes.map(
                  (employeeType) => (
                    <option
                      key={
                        employeeType.id
                      }
                      value={
                        employeeType.id
                      }
                    >
                      {
                        employeeType.name
                      }
                    </option>
                  )
                )}
            </select>

            {errors.employeeTypeId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.employeeTypeId}
              </p>
            )}
          </div>
        </div>

        {/* ADMIN INFORMATION */}
        {isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              Full Admin Access
            </p>

            <p className="mt-1 text-xs text-amber-700">
              This account will have full access to the system.
            </p>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? "Updating..."
              : "Update Employee"}
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin/employees"
              )
            }
            disabled={isLoading}
            className="border border-slate-300 text-slate-900 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}