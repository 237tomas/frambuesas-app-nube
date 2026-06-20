"use server";

import { redirect } from "next/navigation";
import {
  createAdminSession,
  isAdminAuthConfigured,
  matchesAdminPassword,
} from "@/lib/admin-auth";

function getSafeNextPath(value: FormDataEntryValue | null): string {
  const nextPath = typeof value === "string" ? value : "/";

  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
}

export async function iniciarSesion(formData: FormData) {
  const nextPath = getSafeNextPath(formData.get("next"));
  const loginUrl = new URL("/login", "http://localhost");
  loginUrl.searchParams.set("next", nextPath);

  if (!isAdminAuthConfigured()) {
    loginUrl.searchParams.set("error", "configuracion");
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const password = String(formData.get("password") ?? "");

  if (!matchesAdminPassword(password)) {
    loginUrl.searchParams.set("error", "credenciales");
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  await createAdminSession();
  redirect(nextPath);
}
