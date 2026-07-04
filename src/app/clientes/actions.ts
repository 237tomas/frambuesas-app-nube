"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const estadoClienteSchema = z.object({
  id: z.string().trim().min(1),
  nextActivo: z.boolean(),
});

export async function toggleClienteActivo(formData: FormData) {
  await requireAdmin();

  const parsed = estadoClienteSchema.safeParse({
    id: formData.get("id"),
    nextActivo: formData.get("nextActivo") === "true",
  });

  if (!parsed.success) {
    redirect("/clientes?error=estado");
  }

  try {
    await prisma.cliente.update({
      where: { id: parsed.data.id },
      data: { activo: parsed.data.nextActivo },
    });
  } catch {
    redirect("/clientes?error=estado");
  }

  revalidatePath("/clientes");
  redirect("/clientes?ok=estado");
}
