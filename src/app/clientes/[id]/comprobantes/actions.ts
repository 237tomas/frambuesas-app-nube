"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { crearComprobanteParaCliente } from "@/lib/comprobante-service";

const crearComprobanteSchema = z.object({
  clienteId: z.string().trim().min(1),
  kilos: z.coerce.number().positive(),
  precioKilo: z.coerce.number().int().positive(),
  observaciones: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
});

export async function crearComprobante(formData: FormData) {
  await requireAdmin();

  const parsed = crearComprobanteSchema.safeParse({
    clienteId: formData.get("clienteId"),
    kilos: formData.get("kilos"),
    precioKilo: formData.get("precioKilo"),
    observaciones: formData.get("observaciones") ?? "",
  });

  const rawClienteId = String(formData.get("clienteId") ?? "");

  if (!parsed.success) {
    redirect(`/clientes/${rawClienteId}/comprobantes?error=validacion`);
  }

  const result = await crearComprobanteParaCliente(parsed.data);

  if (!result.ok && result.reason === "cliente-no-encontrado") {
    redirect("/clientes?error=cliente-no-encontrado");
  }

  if (!result.ok) {
    redirect(`/clientes/${result.cliente.id}/comprobantes?error=${result.reason}`);
  }

  revalidatePath("/clientes");
  revalidatePath("/comprobantes");
  revalidatePath(`/clientes/${result.cliente.id}/comprobantes`);
  redirect(`/clientes/${result.cliente.id}/comprobantes?ok=creado`);
}
