"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAdminSession,
  isAdminAuthConfigured,
  matchesAdminPassword,
} from "@/lib/admin-auth";
import {
  clearLoginRateLimit,
  isLoginBlocked,
  registerFailedLogin,
} from "@/lib/login-rate-limit";

function getSafeNextPath(value: FormDataEntryValue | null): string {
  const nextPath = typeof value === "string" ? value : "/";

  return nextPath.startsWith("/") &&
    !nextPath.startsWith("//") &&
    !nextPath.includes("\\")
    ? nextPath
    : "/";
}

async function getClientKey(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function iniciarSesion(formData: FormData) {
  const nextPath = getSafeNextPath(formData.get("next"));
  const loginUrl = new URL("/login", "http://localhost");
  loginUrl.searchParams.set("next", nextPath);

  if (!isAdminAuthConfigured()) {
    loginUrl.searchParams.set("error", "configuracion");
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const clientKey = await getClientKey();

  if (isLoginBlocked(clientKey)) {
    loginUrl.searchParams.set("error", "bloqueo");
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const password = String(formData.get("password") ?? "");

  if (!matchesAdminPassword(password)) {
    registerFailedLogin(clientKey);
    loginUrl.searchParams.set("error", "credenciales");
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  clearLoginRateLimit(clientKey);
  await createAdminSession();
  redirect(nextPath);
}
