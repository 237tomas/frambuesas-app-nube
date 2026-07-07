import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RutInput } from "../../rut-input";
import { actualizarCliente } from "./actions";

export const metadata: Metadata = {
  title: "Editar Cliente",
  description: "Actualizacion de datos del cliente",
};

export const dynamic = "force-dynamic";

type EditarClientePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

function getErrorMessage(error: string | undefined): string | null {
  if (error === "validacion") {
    return "Revisa los datos ingresados e intentalo nuevamente.";
  }

  if (error === "rut-duplicado") {
    return "Ya existe un cliente con ese RUT.";
  }

  if (error === "guardar") {
    return "No se pudieron guardar los cambios.";
  }

  return null;
}

export default async function EditarClientePage({
  params,
  searchParams,
}: EditarClientePageProps) {
  await requireAdmin();

  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);

  const cliente = await prisma.cliente.findUnique({
    where: { id },
  });

  if (!cliente) {
    notFound();
  }

  const successMessage = ok === "1" ? "Cambios guardados correctamente." : null;
  const errorMessage = getErrorMessage(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4 py-10">
      <main className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/70 sm:p-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Frambuesas App
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
              Editar Cliente
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Ajusta la informacion del cliente y guarda los cambios.
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

        <form action={actualizarCliente} className="grid gap-6">
          <input type="hidden" name="id" value={cliente.id} />

          <div className="grid gap-2">
            <label htmlFor="rut" className="text-sm font-medium text-zinc-800">
              RUT
            </label>
            <RutInput
              id="rut"
              name="rut"
              defaultValue={cliente.rut}
              className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
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
              defaultValue={cliente.nombre}
              className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
              required
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="telefonoWhatsapp"
                className="text-sm font-medium text-zinc-800"
              >
                Telefono WhatsApp
              </label>
              <input
                id="telefonoWhatsapp"
                name="telefonoWhatsapp"
                type="tel"
                defaultValue={cliente.telefonoWhatsapp}
                className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
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
                defaultValue={cliente.precioKiloActual}
                className="h-11 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <input
              id="activo"
              name="activo"
              type="checkbox"
              defaultChecked={cliente.activo}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-700 focus:ring-zinc-200"
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
              defaultValue={cliente.notas ?? ""}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
            />
          </div>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/clientes"
              className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
