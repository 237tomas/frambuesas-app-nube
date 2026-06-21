import "server-only";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  hasValidAdminSession,
} from "@/lib/admin-session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function hasUsableAdminPassword(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 11);
}

function hasUsableSessionSecret(): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return Boolean(secret && secret.length >= 32);
}

export function isAdminAuthConfigured(): boolean {
  return hasUsableAdminPassword() && hasUsableSessionSecret();
}

export function matchesAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || !hasUsableAdminPassword()) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);

  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  );
}

export async function createAdminSession(): Promise<void> {
  const token = await createAdminSessionToken();
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  return hasValidAdminSession(token);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    redirect("/login");
  }
}
