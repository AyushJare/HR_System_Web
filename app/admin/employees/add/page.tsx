"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { validatePassword as validatePasswordUtil } from "@/lib/validators/password";

import {
  showErrorToast,
  showSuccessToast,
  handleApiError,
  validateArrayResponse,
} from "@/lib/utils/errorHandler";

// ============================================================
// TYPES
// ============================================================

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

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  mobile: string;
  gender: string;
  departmentId: string;
  designationId: string;
  employeeTypeId: string;
  userTypeId: string;
  role: string;
}

interface FormErrors {
  fullName: string;
  email: string;
  password: string[];
  confirmPassword: string;
  mobile: string[];
  gender: string;
  role: string;
  userTypeId: string;
  departmentId: string;
  designationId: string;
  employeeTypeId: string;
}

// ============================================================
// INITIAL VALUES
// ============================================================

const initialFormData: FormData = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  mobile: "",
  gender: "",
  departmentId: "",
  designationId: "",
  employeeTypeId: "",
  userTypeId: "",
  role: "EMPLOYEE",
};

const initialErrors: FormErrors = {
  fullName: "",
  email: "",
  password: [],
  confirmPassword: "",
  mobile: [],
  gender: "",
  role: "",
  userTypeId: "",
  departmentId: "",
  designationId: "",
  employeeTypeId: "",
};

// ============================================================
// PAGE
// ============================================================

export default function AddEmployeePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [loadingUserTypes, setLoadingUserTypes] = useState(true);
  const [loadingOtherData, setLoadingOtherData] = useState(true);

  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<Option[]>([]);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);

  const [formData, setFormData] =
    useState<FormData>(initialFormData);

  const [errors, setErrors] =
    useState<FormErrors>(initialErrors);

  // ============================================================
  // PASSWORD SUGGESTION
  // ============================================================

  const [showPasswordSuggestion, setShowPasswordSuggestion] =
    useState(false);

  const [suggestedPassword, setSuggestedPassword] =
    useState("");

  // ============================================================
  // LOAD FORM OPTIONS
  // ============================================================

  useEffect(() => {
    const loadOtherData = async () => {
      try {
        setLoadingOtherData(true);

        const endpoints: {
          url: string;
          name: string;
          setState: Dispatch<SetStateAction<Option[]>>;
        }[] = [
            {
              url: "/api/departments",
              name: "Departments",
              setState: setDepartments,
            },
            {
              url: "/api/designations",
              name: "Designations",
              setState: setDesignations,
            },
            {
              url: "/api/employee-types",
              name: "Employee Types",
              setState: setEmployeeTypes,
            },
          ];

        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint.url);

            if (!res.ok) {
              throw new Error(
                `${endpoint.name}: HTTP ${res.status}`
              );
            }

            const data: unknown = await res.json();

            const validData =
              validateArrayResponse(data, endpoint.name);

            // validateArrayResponse returns unknown[],
            // so explicitly verify/cast before updating state.
            const options: Option[] = validData.filter(
              (item): item is Option => {
                return (
                  typeof item === "object" &&
                  item !== null &&
                  "id" in item &&
                  "name" in item &&
                  typeof (item as { id?: unknown }).id === "string" &&
                  typeof (item as { name?: unknown }).name === "string"
                );
              }
            );

            endpoint.setState(options);
          } catch (error) {
            handleApiError(
              error,
              `Loading ${endpoint.name}`
            );

            endpoint.setState([]);
          }
        }
      } catch (error) {
        handleApiError(
          error,
          "Loading form options"
        );
      } finally {
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

        const data: unknown = await res.json();

        let userTypesArray: unknown = data;

        // Support both:
        // [ ... ]
        //
        // and:
        // { data: [ ... ] }
        if (
          data !== null &&
          typeof data === "object" &&
          "data" in data
        ) {
          userTypesArray = (
            data as {
              data?: unknown;
            }
          ).data;
        }

        const validData =
          validateArrayResponse(
            userTypesArray,
            "User Types"
          );

        const validUserTypes: UserTypeOption[] =
          validData.filter(
            (item): item is UserTypeOption => {
              return (
                typeof item === "object" &&
                item !== null &&
                "id" in item &&
                "name" in item &&
                typeof (item as { id?: unknown }).id === "string" &&
                typeof (item as { name?: unknown }).name === "string"
              );
            }
          );

        setUserTypes(validUserTypes);
      } catch (error) {
        handleApiError(
          error,
          "Loading User Types"
        );

        setUserTypes([]);
      } finally {
        setLoadingUserTypes(false);
      }
    };

    loadOtherData();
    loadUserTypes();
  }, []);

  // ============================================================
  // VALIDATION
  //
  // IMPORTANT:
  // These functions DO NOT show toasts.
  //
  // Errors are displayed directly below the relevant field.
  // ============================================================

  const validateFullName = (
    value: string
  ): string => {
    if (!value || !value.trim()) {
      return "Full name is required";
    }

    if (value.trim().length < 2) {
      return "Full name must be at least 2 characters";
    }

    if (value.trim().length > 100) {
      return "Full name must not exceed 100 characters";
    }

    return "";
  };

  const validateEmailField = (
    value: string
  ): string => {
    if (!value || !value.trim()) {
      return "Email is required";
    }

    const email = value.trim();

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }

    if (email.length > 255) {
      return "Email must not exceed 255 characters";
    }

    return "";
  };

  const validatePasswordField = (
    value: string
  ): string[] => {
    if (!value) {
      return ["Password is required"];
    }

    try {
      const validation =
        validatePasswordUtil(value);

      if (
        validation.errors &&
        validation.errors.length > 0
      ) {
        return validation.errors;
      }

      return [];
    } catch (error) {
      console.error(
        "Password validation error:",
        error
      );

      return ["Unable to validate password"];
    }
  };

  const validateConfirmPasswordField = (
    value: string,
    password: string
  ): string => {
    if (!value) {
      return "Please confirm your password";
    }

    if (value !== password) {
      return "Passwords do not match";
    }

    return "";
  };

  const validateMobileField = (
    value: string
  ): string[] => {
    if (!value || !value.trim()) {
      return ["Phone number is required"];
    }

    const mobile = value.trim();
    const mobileErrors: string[] = [];

    if (!/^\d+$/.test(mobile)) {
      mobileErrors.push(
        "Phone number should contain only digits"
      );

      return mobileErrors;
    }

    if (mobile.length !== 10) {
      mobileErrors.push(
        "Phone number must be exactly 10 digits"
      );
    }

    return mobileErrors;
  };

  const validateRoleField = (
    value: string
  ): string => {
    if (!value) {
      return "Please select a role";
    }

    return "";
  };

  const validateUserTypeField = (
    value: string,
    role: string
  ): string => {
    // Admin does not require User Type.
    if (role === "ADMIN") {
      return "";
    }

    if (!value) {
      return "Please select a User Type";
    }

    return "";
  };

  // ============================================================
  // PASSWORD SUGGESTION
  // ============================================================

  const generateSuggestedPassword = (): string => {
    const uppercase =
      "ABCDEFGHJKLMNPQRSTUVWXYZ";

    const lowercase =
      "abcdefghijkmnopqrstuvwxyz";

    const numbers =
      "23456789";

    const symbols =
      "!@#$%^&*";

    const allCharacters =
      uppercase +
      lowercase +
      numbers +
      symbols;

    const randomCharacter = (
      characters: string
    ): string => {
      const randomValues =
        new Uint32Array(1);

      crypto.getRandomValues(
        randomValues
      );

      return characters[
        randomValues[0] % characters.length
      ];
    };

    // Guarantee at least one character
    // from each required category.
    const passwordCharacters = [
      randomCharacter(uppercase),
      randomCharacter(lowercase),
      randomCharacter(numbers),
      randomCharacter(symbols),
    ];

    // Add remaining random characters.
    for (
      let i = passwordCharacters.length;
      i < 16;
      i++
    ) {
      passwordCharacters.push(
        randomCharacter(allCharacters)
      );
    }

    // Securely shuffle the generated password.
    for (
      let i = passwordCharacters.length - 1;
      i > 0;
      i--
    ) {
      const randomValues =
        new Uint32Array(1);

      crypto.getRandomValues(
        randomValues
      );

      const j =
        randomValues[0] % (i + 1);

      [
        passwordCharacters[i],
        passwordCharacters[j],
      ] = [
          passwordCharacters[j],
          passwordCharacters[i],
        ];
    }

    return passwordCharacters.join("");
  };

  const handlePasswordFocus = () => {
    if (!formData.password) {
      const generatedPassword =
        generateSuggestedPassword();

      setSuggestedPassword(
        generatedPassword
      );

      setShowPasswordSuggestion(true);
    }
  };

  const handleUseSuggestedPassword = () => {
    if (!suggestedPassword) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      password: suggestedPassword,
      confirmPassword: suggestedPassword,
    }));

    setErrors((prev) => ({
      ...prev,
      password: [],
      confirmPassword: "",
    }));

    setShowPasswordSuggestion(false);
  };

  const handleGenerateAnotherPassword = () => {
    const generatedPassword =
      generateSuggestedPassword();

    setSuggestedPassword(
      generatedPassword
    );
  };

  // ============================================================
  // CHANGE HANDLER
  //
  // No validation toast while typing.
  // Clear the existing inline error when user edits.
  // ============================================================

  const handleChange = (
    e: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => {
      const next = { ...prev };

      switch (name) {
        case "fullName":
          next.fullName = "";
          break;

        case "email":
          next.email = "";
          break;

        case "password":
          next.password = [];
          break;

        case "confirmPassword":
          next.confirmPassword = "";
          break;

        case "mobile":
          next.mobile = [];
          break;

        case "gender":
          next.gender = "";
          break;

        case "role":
          next.role = "";
          next.userTypeId = "";
          break;

        case "userTypeId":
          next.userTypeId = "";
          break;

        case "departmentId":
          next.departmentId = "";
          break;

        case "designationId":
          next.designationId = "";
          break;

        case "employeeTypeId":
          next.employeeTypeId = "";
          break;

        default:
          break;
      }

      return next;
    });
  };

  // ============================================================
  // BLUR HANDLER
  //
  // Validation happens here but ONLY updates inline errors.
  // NO TOASTS.
  // ============================================================

  const handleBlur = (
    e: FocusEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    switch (name) {
      case "fullName":
        setErrors((prev) => ({
          ...prev,
          fullName: validateFullName(value),
        }));
        break;

      case "email":
        setErrors((prev) => ({
          ...prev,
          email: validateEmailField(value),
        }));
        break;

      case "password":
        setErrors((prev) => ({
          ...prev,
          password: validatePasswordField(value),
        }));
        break;

      case "confirmPassword":
        setErrors((prev) => ({
          ...prev,
          confirmPassword:
            validateConfirmPasswordField(
              value,
              formData.password
            ),
        }));
        break;

      case "mobile":
        setErrors((prev) => ({
          ...prev,
          mobile: validateMobileField(value),
        }));
        break;

      case "role":
        setErrors((prev) => ({
          ...prev,
          role: validateRoleField(value),
          userTypeId:
            validateUserTypeField(
              formData.userTypeId,
              value
            ),
        }));
        break;

      case "userTypeId":
        setErrors((prev) => ({
          ...prev,
          userTypeId:
            validateUserTypeField(
              value,
              formData.role
            ),
        }));
        break;

      default:
        break;
    }
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    // Validate everything.
    // IMPORTANT: validation functions do NOT show toasts.
    const fullNameError =
      validateFullName(formData.fullName);

    const emailError =
      validateEmailField(formData.email);

    const passwordError =
      validatePasswordField(
        formData.password
      );

    const confirmPasswordError =
      validateConfirmPasswordField(
        formData.confirmPassword,
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

    const newErrors: FormErrors = {
      fullName: fullNameError,
      email: emailError,
      password: passwordError,
      confirmPassword:
        confirmPasswordError,
      mobile: mobileError,
      gender: "",
      role: roleError,
      userTypeId: userTypeError,
      departmentId: "",
      designationId: "",
      employeeTypeId: "",
    };

    setErrors(newErrors);

    const hasErrors =
      Boolean(fullNameError) ||
      Boolean(emailError) ||
      passwordError.length > 0 ||
      Boolean(confirmPasswordError) ||
      mobileError.length > 0 ||
      Boolean(roleError) ||
      Boolean(userTypeError);

    if (hasErrors) {
      // ONLY ONE general toast.
      // Individual errors remain below their fields.
      showErrorToast(
        "Validation Failed",
        "Please fix the highlighted fields before submitting"
      );

      return;
    }

    // ========================================================
    // API REQUEST
    // ========================================================

    let loadingToast:
      | string
      | undefined;

    try {
      setLoading(true);

      loadingToast = toast.loading(
        "Creating employee..."
      );

      const res = await fetch(
        "/api/employees",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            fullName:
              formData.fullName.trim(),

            email:
              formData.email.trim(),

            password:
              formData.password,

            mobile:
              formData.mobile.trim() ||
              null,

            gender:
              formData.gender || null,

            departmentId:
              formData.departmentId ||
              null,

            designationId:
              formData.designationId ||
              null,

            employeeTypeId:
              formData.employeeTypeId ||
              null,

            userTypeId:
              formData.role === "ADMIN"
                ? null
                : formData.userTypeId,

            role:
              formData.role,
          }),
        }
      );

      let responseData: unknown =
        null;

      try {
        responseData =
          await res.json();
      } catch {
        responseData = null;
      }

      // ======================================================
      // API ERROR
      // ======================================================

      if (!res.ok) {
        let errorMessage =
          `HTTP ${res.status}`;

        if (
          responseData !== null &&
          typeof responseData ===
          "object"
        ) {
          const responseObject =
            responseData as {
              error?: unknown;
              message?: unknown;
            };

          if (
            typeof responseObject.error ===
            "string"
          ) {
            errorMessage =
              responseObject.error;
          } else if (
            typeof responseObject.message ===
            "string"
          ) {
            errorMessage =
              responseObject.message;
          }
        }

        throw new Error(
          errorMessage
        );
      }

      if (!responseData) {
        throw new Error(
          "Empty response from server"
        );
      }

      // ======================================================
      // GET CREATED EMPLOYEE NAME
      // ======================================================

      let employeeName =
        formData.fullName;

      if (
        typeof responseData ===
        "object" &&
        responseData !== null
      ) {
        const responseObject =
          responseData as {
            data?: unknown;
            fullName?: unknown;
          };

        const possibleEmployee =
          responseObject.data ??
          responseData;

        if (
          typeof possibleEmployee ===
          "object" &&
          possibleEmployee !== null
        ) {
          const employeeObject =
            possibleEmployee as {
              fullName?: unknown;
            };

          if (
            typeof employeeObject.fullName ===
            "string"
          ) {
            employeeName =
              employeeObject.fullName;
          }
        }
      }

      // ======================================================
      // SUCCESS
      // ======================================================

      if (loadingToast) {
        toast.dismiss(
          loadingToast
        );
      }

      showSuccessToast(
        `Employee ${employeeName} created successfully!`
      );

      setTimeout(() => {
        router.push(
          "/admin/employees"
        );

        router.refresh();
      }, 1000);

    } catch (error) {
      if (loadingToast) {
        toast.dismiss(
          loadingToast
        );
      }

      console.error(
        "Submission error:",
        error
      );

      // API/server errors ARE allowed to use toast.
      handleApiError(
        error,
        "Employee Creation"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RESET
  // ============================================================

  const handleReset = () => {
    try {
      toast.dismiss();

      setFormData({
        ...initialFormData,
      });

      setErrors({
        ...initialErrors,
      });

      setSuggestedPassword("");

      setShowPasswordSuggestion(false);

      showSuccessToast(
        "Form reset successfully"
      );
    } catch (error) {
      handleApiError(
        error,
        "Form reset"
      );
    }
  };

  // ============================================================
  // FLAGS
  // ============================================================

  const isAdmin =
    formData.role === "ADMIN";

  const isLoading =
    loading ||
    loadingUserTypes ||
    loadingOtherData;

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="p-8 max-w-2xl">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-950 tracking-tight">
          Add Employee
        </h1>

        <p className="text-slate-500 mt-2 font-normal text-sm">
          Create a new employee account
        </p>
      </div>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg border border-slate-200 p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div className="grid grid-cols-2 gap-6">

          {/* ================================================== */}
          {/* FULL NAME */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Full Name *
            </label>

            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              onBlur={handleBlur}
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

          {/* ================================================== */}
          {/* EMAIL */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Email *
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
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

          {/* ================================================== */}
          {/* PASSWORD */}
          {/* ================================================== */}

          <div className="relative">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Password *
            </label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={handlePasswordFocus}
              onBlur={(e) => {
                handleBlur(e);

                setTimeout(() => {
                  setShowPasswordSuggestion(
                    false
                  );
                }, 150);
              }}
              placeholder="Enter password"
              autoComplete="new-password"
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.password.length > 0
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {/* SUGGESTED PASSWORD */}
            {showPasswordSuggestion && (
              <div className="absolute z-20 left-0 right-0 mt-2 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Suggested password
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Use a strong, randomly generated password.
                    </p>
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) =>
                      e.preventDefault()
                    }
                    onClick={
                      handleGenerateAnotherPassword
                    }
                    className="text-xs font-semibold text-slate-700 hover:text-slate-950"
                  >
                    Generate another
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <code className="text-sm text-slate-800 break-all">
                      {suggestedPassword}
                    </code>
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) =>
                      e.preventDefault()
                    }
                    onClick={
                      handleUseSuggestedPassword
                    }
                    className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    Use password
                  </button>
                </div>
              </div>
            )}

            {errors.password.length > 0 && (
              <div className="mt-2 space-y-1">
                {errors.password.map(
                  (error, index) => (
                    <div
                      key={`${error}-${index}`}
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

          {/* ================================================== */}
          {/* CONFIRM PASSWORD */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Confirm Password *
            </label>

            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Confirm password"
              autoComplete="new-password"
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.confirmPassword
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* ================================================== */}
          {/* MOBILE */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Phone Number *
            </label>

            <input
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              onBlur={handleBlur}
              inputMode="numeric"
              placeholder="Enter 10-digit phone number"
              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all duration-200 ${errors.mobile.length > 0
                ? "border-red-500"
                : "border-slate-300"
                }`}
            />

            {errors.mobile.length > 0 && (
              <div className="mt-2 space-y-1">
                {errors.mobile.map(
                  (error, index) => (
                    <div
                      key={`${error}-${index}`}
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

          {/* ================================================== */}
          {/* GENDER */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Gender
            </label>

            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              onBlur={handleBlur}
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

          {/* ================================================== */}
          {/* ROLE */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Role *
            </label>

            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              onBlur={handleBlur}
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

          {/* ================================================== */}
          {/* USER TYPE */}
          {/* ================================================== */}

          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              User Type {!isAdmin && "*"}
            </label>

            <select
              name="userTypeId"
              value={formData.userTypeId}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={
                isAdmin ||
                loadingUserTypes
              }
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
                userTypes.map(
                  (userType) => (
                    <option
                      key={userType.id}
                      value={userType.id}
                    >
                      {userType.name}
                      {userType.isSystem
                        ? " (System)"
                        : ""}
                    </option>
                  )
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

          {/* ================================================== */}
          {/* DEPARTMENT */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Department
            </label>

            <select
              name="departmentId"
              value={formData.departmentId}
              onChange={handleChange}
              onBlur={handleBlur}
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
                departments.map(
                  (department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
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

          {/* ================================================== */}
          {/* DESIGNATION */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Designation
            </label>

            <select
              name="designationId"
              value={formData.designationId}
              onChange={handleChange}
              onBlur={handleBlur}
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
                designations.map(
                  (designation) => (
                    <option
                      key={designation.id}
                      value={designation.id}
                    >
                      {designation.name}
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

          {/* ================================================== */}
          {/* EMPLOYEE TYPE */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Employee Type
            </label>

            <select
              name="employeeTypeId"
              value={formData.employeeTypeId}
              onChange={handleChange}
              onBlur={handleBlur}
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
                employeeTypes.map(
                  (employeeType) => (
                    <option
                      key={employeeType.id}
                      value={employeeType.id}
                    >
                      {employeeType.name}
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

        {/* ==================================================== */}
        {/* ADMIN INFORMATION */}
        {/* ==================================================== */}

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

        {/* ==================================================== */}
        {/* ACTIONS */}
        {/* ==================================================== */}

        <div className="flex gap-3 pt-4 border-t border-slate-100">

          <button
            type="submit"
            disabled={isLoading}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? "Creating..."
              : "Create Employee"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="border border-slate-300 text-slate-900 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Reset Form
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