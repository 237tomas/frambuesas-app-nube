import type { Metadata } from "next";
import Link from "next/link";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { toggleClienteActivo } from "./actions";

export const metadata: Metadata = {
  title: "Clientes",
  description: "Listado de clientes registrados",
};

export const dynamic = "force-dynamic";

function formatPrecio(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

type ClientesPageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

function getMessage(
  ok: string | undefined,
  error: string | undefined,
): { kind: "ok" | "error"; text: string } | null {
  if (ok === "estado") {
    return { kind: "ok", text: "Estado del cliente actualizado." };
  }

  if (error === "estado") {
    return { kind: "error", text: "No se pudo actualizar el estado del cliente." };
  }

  return null;
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const { ok, error } = await searchParams;
  const message = getMessage(ok, error);
  const isDatabaseConfigured = hasDatabaseUrl();
  const clientes = isDatabaseConfigured
    ? await prisma.cliente.findMany({
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4 py-10">
      <main className="mx-auto w-full max-w-6xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/70 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Frambuesas App
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
              Clientes
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Revisa y gestiona tus clientes registrados.
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
              href="/comprobantes"
              className="inline-flex h-10 items-center rounded-full border border-rose-300 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            >
              Comprobantes global
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Inicio
            </Link>
            <Link
              href="/clientes/nuevo"
              className="inline-flex h-10 items-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Nuevo cliente
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

        {!isDatabaseConfigured ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Configura la variable de entorno <code>DATABASE_URL</code> para cargar los
            clientes. Mientras no exista, esta vista se mostrara sin datos.
          </div>
        ) : null}

        {clientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
            <p className="text-base font-medium text-zinc-700">
              {isDatabaseConfigured
                ? "Aun no hay clientes registrados."
                : "La base de datos aun no esta configurada."}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {isDatabaseConfigured
                ? "Crea el primero para comenzar a operar."
                : "Cuando definas DATABASE_URL, aqui aparecera el listado."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    RUT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    WhatsApp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Precio/kg
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="px-4 py-3 text-sm text-zinc-800">{cliente.rut}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {cliente.nombre}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {cliente.telefonoWhatsapp}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {formatPrecio(cliente.precioKiloActual)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          cliente.activo
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {cliente.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/clientes/${cliente.id}/comprobantes`}
                          className="inline-flex h-9 items-center rounded-full border border-rose-300 px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Comprobantes
                        </Link>
                        <Link
                          href={`/clientes/${cliente.id}/editar`}
                          className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        >
                          Editar
                        </Link>
                        <form action={toggleClienteActivo}>
                          <input type="hidden" name="id" value={cliente.id} />
                          <input
                            type="hidden"
                            name="nextActivo"
                            value={String(!cliente.activo)}
                          />
                          <button
                            type="submit"
                            className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold text-white transition ${
                              cliente.activo
                                ? "bg-zinc-700 hover:bg-zinc-800"
                                : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            {cliente.activo ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
