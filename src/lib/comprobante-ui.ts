export function formatCLP(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseDateStart(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateEnd(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
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
