import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { iniciarSesion } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

function getSafeNextPath(value: string | undefined): string {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await isAdminAuthenticated()) {
    redirect("/");
  }

  const { error, next } = await searchParams;
  const nextPath = getSafeNextPath(next);
  const errorMessage =
    error === "configuracion"
      ? "La protección de administrador aún no está configurada."
      : error === "credenciales"
        ? "La contraseña no es correcta."
        : error === "bloqueo"
          ? "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo."
          : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4 py-10">
      <main className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/70 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Frambuesas App
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Acceso administrador
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Ingresa la contraseña para gestionar clientes y comprobantes.
        </p>

        {errorMessage ? (
          <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <form action={iniciarSesion} className="mt-6 grid gap-5">
          <input type="hidden" name="next" value={nextPath} />
          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-semibold text-zinc-800">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="h-12 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
              required
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-full bg-rose-600 px-6 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Ingresar
          </button>
        </form>
      </main>
    </div>
  );
}
