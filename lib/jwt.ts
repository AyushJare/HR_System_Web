import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export type TokenPayload = {
  sub: string;   // employee id
  role: "ADMIN" | "EMPLOYEE";
};

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
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
