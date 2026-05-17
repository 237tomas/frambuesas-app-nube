"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generarComprobantePdfBuffer } from "@/lib/comprobante-pdf";
import {
  getComprobantesBucket,
  getSupabaseAdminClient,
} from "@/lib/supabase-admin";

const crearComprobanteSchema = z.object({
  clienteId: z.string().trim().min(1),
  kilos: z.coerce.number().positive(),
  precioKilo: z.coerce.number().int().positive(),
  observaciones: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
});

function buildFolio(date: Date): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 9000) + 1000;

  return `CP-${y}${m}${d}-${hh}${mm}${ss}-${rnd}`;
}

function buildShortCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

async function createUniqueShortCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildShortCode(8);
    const existing = await prisma.comprobante.findUnique({
      where: { shortCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("No se pudo generar shortCode unico.");
}

export async function crearComprobante(formData: FormData) {
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

  const cliente = await prisma.cliente.findUnique({
    where: { id: parsed.data.clienteId },
  });

  if (!cliente) {
    redirect("/clientes?error=cliente-no-encontrado");
  }

  const now = new Date();
  const folio = buildFolio(now);
  const montoTotal = Math.round(parsed.data.kilos * parsed.data.precioKilo);
  const nombreArchivo = `${folio}.pdf`;
  const storagePath = `clientes/${cliente.id}/${nombreArchivo}`;
  const shortCode = await createUniqueShortCode();

  const pdfBuffer = await generarComprobantePdfBuffer({
    folio,
    fechaIso: now.toISOString(),
    clienteNombre: cliente.nombre,
    clienteRut: cliente.rut,
    clienteWhatsapp: cliente.telefonoWhatsapp,
    kilos: parsed.data.kilos,
    precioKilo: parsed.data.precioKilo,
    montoTotal,
    observaciones: parsed.data.observaciones,
  });

  const bucket = getComprobantesBucket();
  const supabaseAdmin = getSupabaseAdminClient();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    redirect(`/clientes/${cliente.id}/comprobantes?error=storage`);
  }

  await prisma.comprobante.create({
    data: {
      clienteId: cliente.id,
      folio,
      shortCode,
      kilos: parsed.data.kilos,
      precioKilo: parsed.data.precioKilo,
      montoTotal,
      observaciones: parsed.data.observaciones,
      nombreArchivo,
      storagePath,
    },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${cliente.id}/comprobantes`);
  redirect(`/clientes/${cliente.id}/comprobantes?ok=creado`);
}
