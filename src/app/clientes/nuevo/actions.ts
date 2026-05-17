"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const nuevoClienteSchema = z.object({
  rut: z.string().trim().min(1, "El RUT es obligatorio."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  telefonoWhatsapp: z
    .string()
    .trim()
    .min(1, "El teléfono WhatsApp es obligatorio."),
  precioKiloActual: z.coerce
    .number()
    .int("El precio por kilo debe ser un número entero.")
    .nonnegative("El precio por kilo no puede ser negativo."),
  activo: z.boolean(),
  notas: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
});

export async function crearCliente(formData: FormData) {
  const rawData = {
    rut: formData.get("rut"),
    nombre: formData.get("nombre"),
    telefonoWhatsapp: formData.get("telefonoWhatsapp"),
    precioKiloActual: formData.get("precioKiloActual"),
    activo: formData.get("activo") === "on",
    notas: formData.get("notas") ?? "",
  };

  const parsed = nuevoClienteSchema.safeParse(rawData);

  if (!parsed.success) {
    redirect("/clientes/nuevo?error=validacion");
  }

  try {
    await prisma.cliente.create({
      data: parsed.data,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect("/clientes/nuevo?error=rut-duplicado");
    }

    redirect("/clientes/nuevo?error=guardar");
  }

  revalidatePath("/clientes/nuevo");
  redirect("/clientes/nuevo?ok=1");
}
