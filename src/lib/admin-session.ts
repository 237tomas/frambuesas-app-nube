import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "frambuesas_admin_session";
const SESSION_ISSUER = "frambuesas-app-nube";
const SESSION_AUDIENCE = "admin";

function getSessionKey(): Uint8Array | null {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

export async function createAdminSessionToken(): Promise<string> {
  const key = getSessionKey();

  if (!key) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

export async function hasValidAdminSession(token: string | undefined): Promise<boolean> {
  const key = getSessionKey();

  if (!token || !key) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    return payload.sub === "admin" && payload.role === "admin";
  } catch {
    return false;
  }
}
