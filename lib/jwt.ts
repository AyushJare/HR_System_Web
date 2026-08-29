import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export type TokenAccountType = "EMPLOYEE" | "USER_TYPE";

export type TokenPayload = {
  sub: string;
  role: "ADMIN" | "EMPLOYEE";

  // Identifies what kind of account is logged in
  accountType?: TokenAccountType;

  // Present when a User Type account logs in
  userTypeId?: string;

  type?: "access" | "refresh";
};

export async function signToken(
  payload: TokenPayload,
  expiresIn: string = "8h"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}