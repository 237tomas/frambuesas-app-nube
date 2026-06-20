import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { generarComprobantePdfBuffer } from "@/lib/comprobante-pdf";
import {
  getComprobantesBucket,
  getSupabaseAdminClient,
} from "@/lib/supabase-admin";

type CrearComprobanteInput = {
  clienteId: string;
  kilos: number;
  precioKilo: number;
  observaciones: string | null;
};

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
}
