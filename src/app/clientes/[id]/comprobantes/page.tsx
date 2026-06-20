import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getComprobantesBucket, getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPublicAppUrl, isExternallyReachableAppUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Comprobantes",
  description: "Generacion y consulta de comprobantes en PDF",
};

export const dynamic = "force-dynamic";

type ComprobantesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; from?: string; to?: string }>;
};

function getMessage(
  ok: string | undefined,
  error: string | undefined,
): { kind: "ok" | "error"; text: string } | null {
  if (ok === "creado") {
    return { kind: "ok", text: "Comprobante generado y subido correctamente." };
  }

  if (error === "validacion") {
    return { kind: "error", text: "Revisa los datos del formulario." };
  }

  if (error === "storage") {
    return { kind: "error", text: "No se pudo subir el PDF a Supabase Storage." };
  }

  return null;
}

function formatCLP(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseDateStart(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePhoneForWa(phone: string): string {
  return phone.replace(/\D/g, "");
}

function buildWhatsappMessage(params: {
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

export default async function ComprobantesPage({
  params,
  searchParams,
}: ComprobantesPageProps) {
  await requireAdmin();

  const [{ id }, { ok, error, from, to }] = await Promise.all([params, searchParams]);
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);

  const cliente = await prisma.cliente.findUnique({
    where: { id },
  });

  if (!cliente) {
    notFound();
  }

  const comprobantes = await prisma.comprobante.findMany({
    where: {
      clienteId: cliente.id,
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const message = getMessage(ok, error);
  const bucket = getComprobantesBucket();
  const supabaseAdmin = getSupabaseAdminClient();
  const appUrl = getPublicAppUrl();
  const canUseShortLinks = isExternallyReachableAppUrl(appUrl);

  const signedDownloadUrlMap = new Map<string, string>();
  const signedViewUrlMap = new Map<string, string>();
  if (comprobantes.length > 0) {
    const signedResults = await Promise.all(
      comprobantes.map((item) =>
        Promise.all([
          supabaseAdmin.storage.from(bucket).createSignedUrl(item.storagePath, 60 * 60),
          supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(item.storagePath, 60 * 60, {
              download: `comprobante-${item.folio}.pdf`,
            }),
        ]),
      ),
    );

    signedResults.forEach(([viewResult, downloadResult], index) => {
      const storagePath = comprobantes[index].storagePath;
      if (!viewResult.error && viewResult.data?.signedUrl) {
        signedViewUrlMap.set(storagePath, viewResult.data.signedUrl);
      }
      if (!downloadResult.error && downloadResult.data?.signedUrl) {
        signedDownloadUrlMap.set(storagePath, downloadResult.data.signedUrl);
      }
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4 py-10">
      <main className="mx-auto w-full max-w-6xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/70 sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Frambuesas App
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
              Comprobantes
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Cliente: {cliente.nombre} ({cliente.rut})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/compras"
              className="inline-flex h-10 items-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Nueva Compra
            </Link>
            <Link
              href="/clientes"
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Volver a clientes
            </Link>
            <Link
              href={`/clientes/${cliente.id}/editar`}
              className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Editar cliente
            </Link>
          </div>
        </div>

        {message ? (
          <p
            className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
              message.kind === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Historial</h2>
          <form className="mb-4 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-4 sm:items-end">
            <div className="grid gap-2 sm:col-span-1">
              <label htmlFor="from" className="text-sm font-medium text-zinc-800">
                Desde
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={from ?? ""}
                className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
              />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <label htmlFor="to" className="text-sm font-medium text-zinc-800">
                Hasta
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={to ?? ""}
                className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Filtrar fechas
              </button>
              <Link
                href={`/clientes/${cliente.id}/comprobantes`}
                className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Limpiar
              </Link>
            </div>
          </form>

          {comprobantes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-600">
              Este cliente aun no tiene comprobantes.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Folio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Kilos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {comprobantes.map((item) => {
                    const signedViewUrl = signedViewUrlMap.get(item.storagePath);
                    const signedDownloadUrl = signedDownloadUrlMap.get(item.storagePath);

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900">{item.folio}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">{item.kilos}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {formatCLP(item.montoTotal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {item.createdAt.toLocaleString("es-CL")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <div className="flex justify-end gap-2">
                            {signedViewUrl ? (
                              <a
                                href={signedViewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800"
                              >
                                Ver
                              </a>
                            ) : null}
                            {signedDownloadUrl ? (
                              <a
                                href={signedDownloadUrl}
                                download={`comprobante-${item.folio}.pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                              >
                                Descargar
                              </a>
                            ) : (
                              <span className="text-xs text-zinc-500">No disponible</span>
                            )}
                            {item.shortCode || signedDownloadUrl ? (
                              <a
                                href={`https://wa.me/${normalizePhoneForWa(cliente.telefonoWhatsapp)}?text=${encodeURIComponent(
                                  buildWhatsappMessage({
                                    nombre: cliente.nombre,
                                    folio: item.folio,
                                    total: formatCLP(item.montoTotal),
                                    fecha: item.createdAt.toLocaleString("es-CL"),
                                    link: canUseShortLinks && item.shortCode
                                      ? `${appUrl}/c/${item.shortCode}`
                                      : (signedDownloadUrl ?? ""),
                                  }),
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                WhatsApp
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
