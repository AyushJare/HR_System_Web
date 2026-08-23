import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export type TokenPayload = {
  sub: string;   // employee id
  role: "ADMIN" | "EMPLOYEE";
  type?: "access" | "refresh";  // ← NEW: distinguishes token type
};

export async function signToken(
  payload: TokenPayload,
  expiresIn: string = "8h"  // ← NEW: configurable expiry (default 8h for now)
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)  // ← CHANGED: uses parameter instead of hardcoded
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}