import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { ClienteSearchField } from "@/app/comprobantes/cliente-search-field";
import { prisma } from "@/lib/prisma";
import {
  getComprobantesBucket,
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase-admin";
import { crearCompra } from "./actions";

export const metadata: Metadata = {
  title: "Compras",
  description: "Registro de nuevas compras y generacion de comprobantes",
};

export const dynamic = "force-dynamic";

type ComprasPageProps = {
  searchParams: Promise<{ ok?: string; error?: string; clienteId?: string }>;
};

function getMessage(
  ok: string | undefined,
  error: string | undefined,
): { kind: "ok" | "error"; text: string } | null {
  if (ok === "creado") {
    return { kind: "ok", text: "Compra registrada y comprobante subido correctamente." };
  }

  if (error === "validacion") {
    return { kind: "error", text: "Selecciona un cliente y revisa los datos ingresados." };
  }

  if (error === "cliente-no-encontrado") {
    return { kind: "error", text: "No encontramos el cliente seleccionado." };
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

export default async function ComprasPage({ searchParams }: ComprasPageProps) {
  await requireAdmin();

  const { ok, error, clienteId } = await searchParams;
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      rut: true,
      precioKiloActual: true,
    },
  });
  const ultimosComprobantes = await prisma.comprobante.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      cliente: {
        select: {
          nombre: true,
          rut: true,
        },
      },
    },
  });
  const selectedCliente = clientes.find((cliente) => cliente.id === clienteId) ?? null;
  const message = getMessage(ok, error);
  const hasStorageConfig = hasSupabaseAdminEnv();
  const signedDownloadUrlMap = new Map<string, string>();
  const signedViewUrlMap = new Map<string, string>();

  if (hasStorageConfig && ultimosComprobantes.length > 0) {
    const bucket = getComprobantesBucket();
    const supabaseAdmin = getSupabaseAdminClient();
    const signedResults = await Promise.all(
      ultimosComprobantes.map((item) =>
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
      const storagePath = ultimosComprobantes[index].storagePath;
      if (!viewResult.error && viewResult.data?.signedUrl) {
        signedViewUrlMap.set(storagePath, viewResult.data.signedUrl);
      }
      if (!downloadResult.error && downloadResult.data?.signedUrl) {
        signedDownloadUrlMap.set(storagePath, downloadResult.data.signedUrl);
      }
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4 py-8">
      <main className="mx-auto w-full max-w-7xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/70 sm:p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Frambuesas App
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              Compras
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Registra una nueva compra y genera el comprobante en PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Panel inicial
            </Link>
            <Link
              href="/comprobantes"
              className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Ver comprobantes
            </Link>
          </div>
        </div>

        {message ? (
          <p
            className={`mb-5 rounded-xl px-4 py-3 text-sm font-medium ${
              message.kind === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 sm:p-7">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            Nuevo comprobante
          </h2>

          <form action={crearCompra} className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <label htmlFor="clienteId" className="text-sm font-semibold text-zinc-800">
                Cliente
              </label>
              <ClienteSearchField
                compact
                key={clienteId ?? "sin-cliente"}
                inputId="clienteId"
                selectedClienteId={clienteId}
                clientes={clientes.map((cliente) => ({
                  id: cliente.id,
                  nombre: cliente.nombre,
                  rut: cliente.rut,
                }))}
              />
              {clientes.length === 0 ? (
                <p className="text-sm text-rose-700">
                  Aun no hay clientes activos para asociar esta compra.
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="kilos" className="text-sm font-semibold text-zinc-800">
                  Kilos
                </label>
                <input
                  id="kilos"
                  name="kilos"
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="10.5"
                  className="h-12 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
                  required
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="precioKilo"
                  className="text-sm font-semibold text-zinc-800"
                >
                  Precio por kilo
                </label>
                <input
                  id="precioKilo"
                  name="precioKilo"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={selectedCliente?.precioKiloActual ?? ""}
                  placeholder="3700"
                  className="h-12 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="observaciones" className="text-sm font-semibold text-zinc-800">
                Observaciones
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={4}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={clientes.length === 0}
                className="inline-flex h-12 items-center justify-center rounded-full bg-rose-600 px-7 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Generar y subir PDF
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                Ultimos comprobantes cargados
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Los 10 PDFs mas recientes generados en el sistema.
              </p>
            </div>
            <Link
              href="/comprobantes"
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Ver todos
            </Link>
          </div>

          {!hasStorageConfig ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Faltan variables de Supabase para generar enlaces de descarga.
            </div>
          ) : null}

          {ultimosComprobantes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-6 text-center text-sm text-zinc-600">
              Aun no hay comprobantes cargados.
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
                      Cliente
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
                      Accion
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {ultimosComprobantes.map((item) => {
                    const viewUrl = signedViewUrlMap.get(item.storagePath);
                    const downloadUrl = signedDownloadUrlMap.get(item.storagePath);

                    return (
                      <tr key={item.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900">
                          {item.folio}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">
                          {item.cliente.nombre} ({item.cliente.rut})
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">
                          {item.kilos}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">
                          {formatCLP(item.montoTotal)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">
                          {item.createdAt.toLocaleString("es-CL")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                          {viewUrl || downloadUrl ? (
                            <div className="flex justify-end gap-2">
                              {viewUrl ? (
                                <a
                                  href={viewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-9 items-center rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800"
                                >
                                  Ver
                                </a>
                              ) : null}
                              {downloadUrl ? (
                                <a
                                  href={downloadUrl}
                                  download={`comprobante-${item.folio}.pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                                >
                                  Descargar
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">No disponible</span>
                          )}
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
