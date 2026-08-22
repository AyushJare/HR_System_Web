import { cookies } from "next/headers";
import { verifyToken, type TokenPayload } from "./jwt";

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
  if (session.role !== "ADMIN") {
    return { ok: false, status: 403, error: "Admin access required" };
  }
  return { ok: true, session };
}
