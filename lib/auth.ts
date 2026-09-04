import { cookies } from "next/headers";
import { verifyToken, type TokenPayload } from "./jwt";
import { checkPermission, type PermissionAction } from "./permissions";

export type AdminCheckResult =
  | { ok: true; session: TokenPayload }
  | { ok: false; status: number; error: string };

export async function getSession(
  request?: Request
): Promise<TokenPayload | null> {
  // ---------------------------------------------------------
  // 1. Try the normal web session cookie
  // ---------------------------------------------------------
  const cookieStore = await cookies();

  let token = cookieStore.get("session")?.value;

  // ---------------------------------------------------------
  // 2. If there is no cookie, support Flutter/mobile clients
  //    through Authorization: Bearer <accessToken>
  // ---------------------------------------------------------
  if (!token && request) {
    const authorization = request.headers.get("authorization");

    if (authorization?.startsWith("Bearer ")) {
      const bearerToken = authorization.substring(7).trim();

      if (bearerToken) {
        token = bearerToken;
      }
    }
  }

  // ---------------------------------------------------------
  // 3. No authentication token
  // ---------------------------------------------------------
  if (!token) {
    return null;
  }

  // ---------------------------------------------------------
  // 4. Verify JWT
  // ---------------------------------------------------------
  return verifyToken(token);
}

export async function requireAdmin(): Promise<AdminCheckResult> {
  const session = await getSession();

  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Not authenticated",
    };
  }

  if (
    session.role !== "ADMIN" ||
    session.accountType === "USER_TYPE"
  ) {
    return {
      ok: false,
      status: 403,
      error: "Admin access required",
    };
  }

  return {
    ok: true,
    session,
  };
}

/**
 * Allows:
 *
 * 1. ADMIN accounts
 * 2. Employee accounts with the requested permission
 *
 * User-type login tokens are never allowed to impersonate
 * an employee account.
 */
export async function requirePermissionOrAdmin(
  moduleName: string,
  action: PermissionAction = "view",
  request?: Request
): Promise<AdminCheckResult> {
  const session = await getSession(request);

  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Not authenticated",
    };
  }

  // User-type accounts cannot impersonate employee accounts.
  if (session.accountType === "USER_TYPE") {
    return {
      ok: false,
      status: 403,
      error: "Access denied for user-type accounts",
    };
  }

  // ADMIN has unrestricted admin access.
  if (session.role === "ADMIN") {
    return {
      ok: true,
      session,
    };
  }

  // Normal employee permission check.
  const allowed = await checkPermission(
    session.sub,
    moduleName,
    action
  );

  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden – requires ${moduleName} ${action} permission`,
    };
  }

  return {
    ok: true,
    session,
  };
}