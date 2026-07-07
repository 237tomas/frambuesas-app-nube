import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { crearCliente } from "./actions";
import { RutInput } from "../rut-input";

export const metadata: Metadata = {
  title: "Nuevo Cliente",
  description: "Registro de un nuevo cliente",
};

type NuevoClientePageProps = {
  searchParams: Promise<{
    ok?: string;
    error?: string;
  }>;
};

function getErrorMessage(error: string | undefined): string | null {
  if (error === "validacion") {
    return "Revisa los datos ingresados e inténtalo nuevamente.";
  }

  if (error === "rut-duplicado") {
    return "Ya existe un cliente con ese RUT.";
  }

  if (error === "guardar") {
    return "No se pudo guardar el cliente. Inténtalo otra vez.";
  }

  return null;
}

export default async function NuevoClientePage({
  searchParams,
}: NuevoClientePageProps) {
  await requireAdmin();

  const { ok, error } = await searchParams;
  const errorMessage = getErrorMessage(error);
  const successMessage = ok === "1" ? "Cliente guardado correctamente." : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-rose-50 via-white to-pink-50 px-4 py-10">
      <main className="w-full max-w-3xl rounded-3xl border border-rose-100 bg-white p-6 shadow-xl shadow-rose-100/60 sm:p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-500">
              Frambuesas App
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
              Nuevo Cliente
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Completa los datos para registrar un cliente en el sistema.
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
              Ver clientes
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-rose-200 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            >
              Inicio
            </Link>
          </div>
        </div>

        {successMessage ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <form action={crearCliente} className="grid gap-6">
          <div className="grid gap-2">
            <label htmlFor="rut" className="text-sm font-medium text-zinc-800">
              RUT
            </label>
            <RutInput
              id="rut"
              name="rut"
              placeholder="12.345.678-9"
              className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              required
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="nombre" className="text-sm font-medium text-zinc-800">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Nombre completo"
              className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              required
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="telefonoWhatsapp"
                className="text-sm font-medium text-zinc-800"
              >
                Teléfono WhatsApp
              </label>
              <input
                id="telefonoWhatsapp"
                name="telefonoWhatsapp"
                type="tel"
                placeholder="+56 9 1234 5678"
                className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                required
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="precioKiloActual"
                className="text-sm font-medium text-zinc-800"
              >
                Precio por kilo actual
              </label>
              <input
                id="precioKiloActual"
                name="precioKiloActual"
                type="number"
                min="0"
                step="1"
                placeholder="12000"
                className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <input
              id="activo"
              name="activo"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-200"
            />
            <label htmlFor="activo" className="text-sm font-medium text-zinc-800">
              Cliente activo
            </label>
          </div>

          <div className="grid gap-2">
            <label htmlFor="notas" className="text-sm font-medium text-zinc-800">
              Notas
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={4}
              placeholder="Comentarios adicionales del cliente..."
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
            />
          </div>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="reset"
              className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-rose-600 px-6 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Guardar cliente
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
