"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  const [forgotFirstName, setForgotFirstName] =
    useState("");

  const [forgotEmployeeCode, setForgotEmployeeCode] =
    useState("");

  const [forgotMobile, setForgotMobile] =
    useState("");

  const [forgotNewPassword, setForgotNewPassword] =
    useState("");

  const [forgotConfirmPassword, setForgotConfirmPassword] =
    useState("");

  const [forgotError, setForgotError] =
    useState("");

  const [forgotSuccess, setForgotSuccess] =
    useState("");

  const [forgotLoading, setForgotLoading] =
    useState(false);

  // ============================================================
  // PASSWORD VALIDATION
  // ============================================================

  const hasMinimumLength =
    forgotNewPassword.length >= 8;

  const hasUppercase =
    /[A-Z]/.test(forgotNewPassword);

  const hasLowercase =
    /[a-z]/.test(forgotNewPassword);

  const hasNumber =
    /[0-9]/.test(forgotNewPassword);

  const hasSpecialCharacter =
    /[^A-Za-z0-9]/.test(forgotNewPassword);

  const isForgotPasswordValid =
    hasMinimumLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecialCharacter;

  const passwordsMatch =
    forgotNewPassword.length > 0 &&
    forgotConfirmPassword.length > 0 &&
    forgotNewPassword === forgotConfirmPassword;

  // ============================================================
  // LOGIN
  // ============================================================

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        "/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      let data: any = null;

      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          "Login failed"
        );
      }

      router.push("/admin/employees");
      router.refresh();
    } catch (err) {
      console.error(
        "Login error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  async function handleForgotPassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setForgotError("");
    setForgotSuccess("");

    // ----------------------------------------------------------
    // PASSWORD POLICY VALIDATION
    // ----------------------------------------------------------

    if (!isForgotPasswordValid) {
      setForgotError(
        "Please complete all password requirements before continuing."
      );
      return;
    }

    // ----------------------------------------------------------
    // CONFIRM PASSWORD VALIDATION
    // ----------------------------------------------------------

    if (
      forgotNewPassword !==
      forgotConfirmPassword
    ) {
      setForgotError(
        "New password and confirm password do not match."
      );
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(
        "/api/auth/forgot-password",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            firstName:
              forgotFirstName.trim(),

            employeeCode:
              forgotEmployeeCode.trim(),

            mobile:
              forgotMobile.trim(),

            newPassword:
              forgotNewPassword,
          }),
        }
      );

      let data: any = null;

      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          "Failed to reset password."
        );
      }

      setForgotSuccess(
        data?.message ||
        "Password changed successfully."
      );

      setForgotFirstName("");
      setForgotEmployeeCode("");
      setForgotMobile("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
    } catch (err) {
      console.error(
        "Forgot password error:",
        err
      );

      setForgotError(
        err instanceof Error
          ? err.message
          : "Failed to reset password."
      );
    } finally {
      setForgotLoading(false);
    }
  }

  // ============================================================
  // OPEN FORGOT PASSWORD
  // ============================================================

  function openForgotPassword() {
    setShowForgotPassword(true);

    setError("");
    setForgotError("");
    setForgotSuccess("");
  }

  // ============================================================
  // BACK TO LOGIN
  // ============================================================

  function backToLogin() {
    setShowForgotPassword(false);

    setForgotError("");
    setForgotSuccess("");

    setForgotFirstName("");
    setForgotEmployeeCode("");
    setForgotMobile("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="text-center mb-8">
          <img
            src="/images/vmc-logo.png"
            alt="VMC Logo"
            className="h-16 w-auto object-contain mx-auto mb-3"
          />

          <h1 className="text-3xl font-bold text-slate-950">
            VMC
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            {showForgotPassword
              ? "Reset your password"
              : "Sign in to your account"}
          </p>
        </div>

        {/* ================================================== */}
        {/* FORGOT PASSWORD FORM */}
        {/* ================================================== */}

        {showForgotPassword ? (
          <form
            onSubmit={handleForgotPassword}
            className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4"
          >

            {/* ================================================== */}
            {/* FIRST NAME */}
            {/* ================================================== */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name
              </label>

              <input
                type="text"
                required
                value={forgotFirstName}
                onChange={(e) =>
                  setForgotFirstName(
                    e.target.value
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your first name"
                autoComplete="given-name"
              />
            </div>

            {/* ================================================== */}
            {/* EMPLOYEE CODE */}
            {/* ================================================== */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Employee Code
              </label>

              <input
                type="text"
                required
                value={forgotEmployeeCode}
                onChange={(e) =>
                  setForgotEmployeeCode(
                    e.target.value
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your employee code"
              />
            </div>

            {/* ================================================== */}
            {/* MOBILE NUMBER */}
            {/* ================================================== */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mobile Number
              </label>

              <input
                type="tel"
                required
                value={forgotMobile}
                onChange={(e) =>
                  setForgotMobile(
                    e.target.value
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your mobile number"
                autoComplete="tel"
              />
            </div>

            {/* ================================================== */}
            {/* NEW PASSWORD */}
            {/* ================================================== */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New Password
              </label>

              <input
                type="password"
                required
                value={forgotNewPassword}
                onChange={(e) =>
                  setForgotNewPassword(
                    e.target.value
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your new password"
                autoComplete="new-password"
              />

              {/* ================================================== */}
              {/* PASSWORD POLICY */}
              {/* ================================================== */}

              {forgotNewPassword.length > 0 && (
                <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 px-3 py-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    Password requirements:
                  </p>

                  <div className="space-y-1">

                    <p
                      className={`text-xs ${hasMinimumLength
                        ? "text-green-600"
                        : "text-red-500"
                        }`}
                    >
                      {hasMinimumLength ? "✓" : "✗"}{" "}
                      At least 8 characters
                    </p>

                    <p
                      className={`text-xs ${hasUppercase
                        ? "text-green-600"
                        : "text-red-500"
                        }`}
                    >
                      {hasUppercase ? "✓" : "✗"}{" "}
                      At least one uppercase letter
                    </p>

                    <p
                      className={`text-xs ${hasLowercase
                        ? "text-green-600"
                        : "text-red-500"
                        }`}
                    >
                      {hasLowercase ? "✓" : "✗"}{" "}
                      At least one lowercase letter
                    </p>

                    <p
                      className={`text-xs ${hasNumber
                        ? "text-green-600"
                        : "text-red-500"
                        }`}
                    >
                      {hasNumber ? "✓" : "✗"}{" "}
                      At least one number
                    </p>

                    <p
                      className={`text-xs ${hasSpecialCharacter
                        ? "text-green-600"
                        : "text-red-500"
                        }`}
                    >
                      {hasSpecialCharacter ? "✓" : "✗"}{" "}
                      At least one special character
                    </p>

                  </div>

                  {!isForgotPasswordValid && (
                    <p className="text-xs text-red-500 mt-2">
                      Please complete the remaining requirements.
                    </p>
                  )}

                  {isForgotPasswordValid && (
                    <p className="text-xs text-green-600 mt-2">
                      ✓ Password meets all requirements.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ================================================== */}
            {/* CONFIRM PASSWORD */}
            {/* ================================================== */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirm New Password
              </label>

              <input
                type="password"
                required
                value={forgotConfirmPassword}
                onChange={(e) =>
                  setForgotConfirmPassword(
                    e.target.value
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm your new password"
                autoComplete="new-password"
              />

              {/* ================================================== */}
              {/* PASSWORD MATCH STATUS */}
              {/* ================================================== */}

              {forgotConfirmPassword.length > 0 && (
                <div className="mt-2">
                  {passwordsMatch ? (
                    <p className="text-xs text-green-600">
                      ✓ Passwords match.
                    </p>
                  ) : (
                    <p className="text-xs text-red-500">
                      ✗ Passwords do not match.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ================================================== */}
            {/* FORGOT PASSWORD ERROR */}
            {/* ================================================== */}

            {forgotError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">
                  {forgotError}
                </p>
              </div>
            )}

            {/* ================================================== */}
            {/* FORGOT PASSWORD SUCCESS */}
            {/* ================================================== */}

            {forgotSuccess && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2">
                <p className="text-sm text-green-600">
                  {forgotSuccess}
                </p>
              </div>
            )}

            {/* ================================================== */}
            {/* CHANGE PASSWORD BUTTON */}
            {/* ================================================== */}

            <button
              type="submit"
              disabled={
                forgotLoading ||
                !isForgotPasswordValid ||
                !passwordsMatch
              }
              className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 rounded-md transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {forgotLoading
                ? "Changing password..."
                : "Change Password"}
            </button>

            {/* ================================================== */}
            {/* BACK TO LOGIN */}
            {/* ================================================== */}

            <button
              type="button"
              onClick={backToLogin}
              className="w-full text-sm text-blue-700 hover:text-blue-800 font-medium py-2"
            >
              ← Back to Login
            </button>
          </form>
        ) : (

          /* ================================================== */
          /* LOGIN FORM */
          /* ================================================== */

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4"
          >

            {/* ================================================== */}
            {/* EMAIL */}
            {/* ================================================== */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@company.com"
                autoComplete="email"
              />
            </div>

            {/* ================================================== */}
            {/* PASSWORD */}
            {/* ================================================== */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>

              <input
                type="password"
                required
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="********"
                autoComplete="current-password"
              />

              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-sm text-blue-700 hover:text-blue-800 font-medium"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {/* ================================================== */}
            {/* LOGIN ERROR */}
            {/* ================================================== */}

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            {/* ================================================== */}
            {/* SIGN IN BUTTON */}
            {/* ================================================== */}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 rounded-md transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}