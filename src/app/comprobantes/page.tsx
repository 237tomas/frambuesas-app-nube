import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getComprobantesBucket,
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase-admin";
import { getPublicAppUrl, isExternallyReachableAppUrl } from "@/lib/app-url";
import { ClienteSearchField } from "./cliente-search-field";

export const metadata: Metadata = {
  title: "Comprobantes Global",
  description: "Consulta global de comprobantes por cliente y fecha",
};

export const dynamic = "force-dynamic";

type ComprobantesGlobalPageProps = {
  searchParams: Promise<{
    clienteId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};
const PAGE_SIZE = 10;

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

export default async function ComprobantesGlobalPage({
  searchParams,
}: ComprobantesGlobalPageProps) {
  const { clienteId, from, to, page } = await searchParams;
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, rut: true, telefonoWhatsapp: true },
  });

  const whereClause = {
    ...(clienteId ? { clienteId } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const totalItems = await prisma.comprobante.count({
    where: whereClause,
  });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const comprobantes = await prisma.comprobante.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    skip: (safePage - 1) * PAGE_SIZE,
  });

  const clienteMap = new Map(clientes.map((c) => [c.id, c]));
  const appUrl = getPublicAppUrl();
  const canUseShortLinks = isExternallyReachableAppUrl(appUrl);
  const hasStorageConfig = hasSupabaseAdminEnv();

  const signedUrlMap = new Map<string, string>();
  if (hasStorageConfig && comprobantes.length > 0) {
    const bucket = getComprobantesBucket();
    const supabaseAdmin = getSupabaseAdminClient();
    const signedResults = await Promise.all(
      comprobantes.map((item) =>
        supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(item.storagePath, 60 * 60, {
            download: `comprobante-${item.folio}.pdf`,
          }),
      ),
    );

    signedResults.forEach((result, index) => {
      if (!result.error && result.data?.signedUrl) {
        signedUrlMap.set(comprobantes[index].storagePath, result.data.signedUrl);
      }
    });
  }

  const makePageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (clienteId) params.set("clienteId", clienteId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(targetPage));
    return `/comprobantes?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4 py-10">
      <main className="mx-auto w-full max-w-7xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/70 sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Frambuesas App
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
              Comprobantes globales
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Filtra por cliente y rango de fechas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Inicio
            </Link>
            <Link
              href="/clientes"
              className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Clientes
            </Link>
          </div>
        </div>

        <form className="mb-6 grid gap-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-4 sm:items-end sm:p-6">
          <input type="hidden" name="page" value="1" />
          <div className="grid gap-2 sm:col-span-2">
            <label htmlFor="clienteId" className="text-base font-medium text-zinc-800">
              Cliente
            </label>
            <ClienteSearchField
              inputId="clienteId"
              clientes={clientes.map((cliente) => ({
                id: cliente.id,
                nombre: cliente.nombre,
                rut: cliente.rut,
              }))}
              selectedClienteId={clienteId}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="from" className="text-base font-medium text-zinc-800">
              Desde
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="h-14 rounded-2xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="to" className="text-base font-medium text-zinc-800">
              Hasta
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="h-14 rounded-2xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
            />
          </div>
          <div className="sm:col-span-4 flex justify-center gap-3 pt-1">
            <button
              type="submit"
              className="inline-flex h-12 items-center rounded-full bg-rose-600 px-7 text-base font-semibold text-white transition hover:bg-rose-700"
            >
              Buscar
            </button>
            <Link
              href="/comprobantes"
              className="inline-flex h-12 items-center rounded-full border border-zinc-300 px-7 text-base font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Limpiar
            </Link>
          </div>
        </form>

        {!hasStorageConfig ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Faltan variables de Supabase para generar enlaces de descarga y WhatsApp.
            Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> para habilitarlos.
          </div>
        ) : null}

        {comprobantes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-600">
            No hay comprobantes para el filtro seleccionado.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Folio
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
                    const cliente = clienteMap.get(item.clienteId);
                    const signedUrl = signedUrlMap.get(item.storagePath);
                    const waPhone = cliente
                      ? normalizePhoneForWa(cliente.telefonoWhatsapp)
                      : "";
                    const linkForMessage = canUseShortLinks && item.shortCode
                      ? `${appUrl}/c/${item.shortCode}`
                      : (signedUrl ?? "");
                    const waText = encodeURIComponent(
                      buildWhatsappMessage({
                        nombre: cliente?.nombre ?? "cliente",
                        folio: item.folio,
                        total: formatCLP(item.montoTotal),
                        fecha: item.createdAt.toLocaleString("es-CL"),
                        link: linkForMessage,
                      }),
                    );
                    const waHref =
                      waPhone && linkForMessage
                        ? `https://wa.me/${waPhone}?text=${waText}`
                        : "";

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm text-zinc-800">
                          {cliente
                            ? `${cliente.nombre} (${cliente.rut})`
                            : "Cliente no disponible"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900">{item.folio}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">{formatCLP(item.montoTotal)}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {item.createdAt.toLocaleString("es-CL")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {signedUrl ? (
                              <a
                                href={signedUrl}
                                download={`comprobante-${item.folio}.pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                              >
                                Descargar
                              </a>
                            ) : null}
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                WhatsApp
                              </a>
                            ) : null}
                            {!signedUrl && !waHref ? (
                              <span className="inline-flex h-9 items-center rounded-full border border-zinc-200 px-4 text-xs font-medium text-zinc-400">
                                Sin enlaces
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-600">
                Pagina {safePage} de {totalPages} ({totalItems} comprobantes, {PAGE_SIZE} por pagina)
              </p>
              <div className="flex gap-2">
                {safePage > 1 ? (
                  <Link
                    href={makePageHref(safePage - 1)}
                    className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 px-4 text-sm font-medium text-zinc-400">
                    Anterior
                  </span>
                )}

                {safePage < totalPages ? (
                  <Link
                    href={makePageHref(safePage + 1)}
                    className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 px-4 text-sm font-medium text-zinc-400">
                    Siguiente
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
