"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const editarClienteSchema = z.object({
  id: z.string().trim().min(1),
  rut: z.string().trim().min(1),
  nombre: z.string().trim().min(1),
  telefonoWhatsapp: z.string().trim().min(1),
  precioKiloActual: z.coerce.number().int().nonnegative(),
  activo: z.boolean(),
  notas: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
});

export async function actualizarCliente(formData: FormData) {
  await requireAdmin();

  const rawData = {
    id: formData.get("id"),
    rut: formData.get("rut"),
    nombre: formData.get("nombre"),
    telefonoWhatsapp: formData.get("telefonoWhatsapp"),
    precioKiloActual: formData.get("precioKiloActual"),
    activo: formData.get("activo") === "on",
    notas: formData.get("notas") ?? "",
  };

  const parsed = editarClienteSchema.safeParse(rawData);

  if (!parsed.success) {
    const id = String(formData.get("id") ?? "");
    redirect(`/clientes/${id}/editar?error=validacion`);
  }

  try {
    await prisma.cliente.update({
      where: { id: parsed.data.id },
      data: {
        rut: parsed.data.rut,
        nombre: parsed.data.nombre,
        telefonoWhatsapp: parsed.data.telefonoWhatsapp,
        precioKiloActual: parsed.data.precioKiloActual,
        activo: parsed.data.activo,
        notas: parsed.data.notas,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect(`/clientes/${parsed.data.id}/editar?error=rut-duplicado`);
    }

    redirect(`/clientes/${parsed.data.id}/editar?error=guardar`);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${parsed.data.id}/editar`);
  redirect(`/clientes/${parsed.data.id}/editar?ok=1`);
}
