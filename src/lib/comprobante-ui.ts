import { chileDateToUtc } from "@/lib/timezone";

const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function formatCLP(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

// Los filtros de fecha se interpretan en horario de Chile, sin importar la
// zona horaria del servidor.
export function parseDateStart(value: string | undefined): Date | null {
  const match = value?.match(DATE_PATTERN);
  if (!match) return null;

  return chileDateToUtc(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function parseDateEnd(value: string | undefined): Date | null {
  const match = value?.match(DATE_PATTERN);
  if (!match) return null;

  return chileDateToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    23,
    59,
    59,
    999,
  );
}

export function normalizePhoneForWa(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function buildWhatsappMessage(params: {
  nombre: string;
  folio: string;
  total: string;
  fecha: string;
  link: string;
}): string {
  return [
    `Hola ${params.nombre},`,
    "",
    "Te compartimos tu comprobante:",
    `*Folio:* ${params.folio}`,
    `*Total:* ${params.total}`,
    `*Fecha:* ${params.fecha}`,
    "",
    "Puedes verlo o descargarlo aqui:",
    params.link,
    "",
    "Gracias por confiar en Frambuesas App.",
  ].join("\n");
}
