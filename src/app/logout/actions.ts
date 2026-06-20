"use server";

import { redirect } from "next/navigation";
import { deleteAdminSession } from "@/lib/admin-auth";

export async function cerrarSesion() {
  await deleteAdminSession();
  redirect("/login");
}
