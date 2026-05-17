import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4">
      <main className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-lg shadow-zinc-200/70">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Frambuesas App
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Panel inicial
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Accede al flujo de registro de clientes desde aqui.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/comprobantes"
            className="inline-flex h-11 items-center justify-center rounded-full border border-rose-300 px-6 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            Ver comprobantes
          </Link>
          <Link
            href="/clientes"
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Ver clientes
          </Link>
          <Link
            href="/clientes/nuevo"
            className="inline-flex h-11 items-center justify-center rounded-full bg-rose-600 px-6 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Ir a Nuevo Cliente
          </Link>
        </div>
      </main>
    </div>
  );
}
