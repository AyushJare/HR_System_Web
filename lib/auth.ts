import { cookies } from "next/headers";
import { verifyToken, type TokenPayload } from "./jwt";
import { checkPermission, type PermissionAction } from "./permissions";

export type AdminCheckResult =
  | { ok: true; session: TokenPayload }
  | { ok: false; status: number; error: string };

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAdmin(): Promise<AdminCheckResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  if (session.role !== "ADMIN" || session.accountType === "USER_TYPE") {
    return { ok: false, status: 403, error: "Admin access required" };
  }

  return { ok: true, session };
}

/**
 * Allow if:
 *  - session role is ADMIN, OR
 *  - the employee's UserType grants the given permission.
 *
 * `moduleName` must match a leaf key in PERMISSION_MODULES,
 * e.g. "Masters", "Departments", "Holidays", "Holiday Bulk Upload",
 * "Leave Types", "Dashboard", "Masters Bulk Upload", etc.
 */
export async function requirePermissionOrAdmin(
  moduleName: string,
  action: PermissionAction = "view"
): Promise<AdminCheckResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  // User-type login tokens should never impersonate an employee
  if (session.accountType === "USER_TYPE") {
    return {
      ok: false,
      status: 403,
      error: "Access denied for user-type accounts",
    };
  }

  if (session.role === "ADMIN") {
    return { ok: true, session };
  }

  const allowed = await checkPermission(session.sub, moduleName, action);

  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden – requires ${moduleName} ${action} permission`,
    };
  }

  return { ok: true, session };
}