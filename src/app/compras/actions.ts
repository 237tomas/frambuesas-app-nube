"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearComprobanteParaCliente } from "@/lib/comprobante-service";

const crearCompraSchema = z.object({
  clienteId: z.string().trim().min(1),
  kilos: z.coerce.number().positive(),
  precioKilo: z.coerce.number().int().positive(),
  observaciones: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
});

function buildRedirectUrl(params: {
  clienteId?: string;
  ok?: string;
  error?: string;
}): string {
  const searchParams = new URLSearchParams();

  if (params.clienteId) searchParams.set("clienteId", params.clienteId);
  if (params.ok) searchParams.set("ok", params.ok);
  if (params.error) searchParams.set("error", params.error);

  const queryString = searchParams.toString();
  return queryString ? `/compras?${queryString}` : "/compras";
}

export async function crearCompra(formData: FormData) {
  const rawClienteId = String(formData.get("clienteId") ?? "");
  const parsed = crearCompraSchema.safeParse({
    clienteId: rawClienteId,
    kilos: formData.get("kilos"),
    precioKilo: formData.get("precioKilo"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    redirect(
      buildRedirectUrl({
        clienteId: rawClienteId,
        error: "validacion",
      }),
    );
  }

  const result = await crearComprobanteParaCliente(parsed.data);

  if (!result.ok) {
    redirect(
      buildRedirectUrl({
        clienteId: rawClienteId,
        error: result.reason,
      }),
    );
  }

  revalidatePath("/compras");
  revalidatePath("/comprobantes");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${result.cliente.id}/comprobantes`);
  redirect(
    buildRedirectUrl({
      clienteId: result.cliente.id,
      ok: "creado",
    }),
  );
}
