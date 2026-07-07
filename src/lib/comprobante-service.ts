import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { generarComprobantePdfBuffer } from "@/lib/comprobante-pdf";
import {
  getComprobantesBucket,
  getSupabaseAdminClient,
} from "@/lib/supabase-admin";
import { getChileDateParts } from "@/lib/timezone";

type CrearComprobanteInput = {
  clienteId: string;
  kilos: number;
  precioKilo: number;
  observaciones: string | null;
};

function buildFolio(date: Date): string {
  const { year, month, day, hour, minute, second } = getChileDateParts(date);
  const pad = (value: number) => String(value).padStart(2, "0");
  const rnd = randomInt(1000, 10000);

  return `CP-${year}${pad(month)}${pad(day)}-${pad(hour)}${pad(minute)}${pad(second)}-${rnd}`;
}

function buildShortCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[randomInt(alphabet.length)];
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

export async function crearComprobanteParaCliente(input: CrearComprobanteInput) {
  await requireAdmin();

  const cliente = await prisma.cliente.findUnique({
    where: { id: input.clienteId },
  });

  if (!cliente) {
    return { ok: false as const, reason: "cliente-no-encontrado" as const };
  }

  const now = new Date();
  const folio = buildFolio(now);
  const montoTotal = Math.round(input.kilos * input.precioKilo);
  const nombreArchivo = `${folio}.pdf`;
  const storagePath = `clientes/${cliente.id}/${nombreArchivo}`;
  const shortCode = await createUniqueShortCode();

  const pdfBuffer = await generarComprobantePdfBuffer({
    folio,
    fechaIso: now.toISOString(),
    clienteNombre: cliente.nombre,
    clienteRut: cliente.rut,
    clienteWhatsapp: cliente.telefonoWhatsapp,
    kilos: input.kilos,
    precioKilo: input.precioKilo,
    montoTotal,
    observaciones: input.observaciones,
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
    return { ok: false as const, reason: "storage" as const, cliente };
  }

  try {
    const comprobante = await prisma.comprobante.create({
      data: {
        clienteId: cliente.id,
        folio,
        shortCode,
        kilos: input.kilos,
        precioKilo: input.precioKilo,
        montoTotal,
        observaciones: input.observaciones,
        nombreArchivo,
        storagePath,
      },
    });

    return { ok: true as const, cliente, comprobante };
  } catch {
    // El registro no se pudo persistir: eliminamos el PDF ya subido para no
    // dejar archivos huerfanos en Storage.
    await supabaseAdmin.storage
      .from(bucket)
      .remove([storagePath])
      .catch(() => undefined);

    return { ok: false as const, reason: "db" as const, cliente };
  }
}
