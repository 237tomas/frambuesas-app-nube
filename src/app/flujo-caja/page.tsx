import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/comprobante-ui";
import { CHILE_TIME_ZONE, getChileDateParts } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Flujo de caja",
  description: "Resumen mensual de egresos por compras",
};

export const dynamic = "force-dynamic";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

type FlujoCajaPageProps = {
  searchParams: Promise<{ month?: string }>;
};

type Month = {
  year: number;
  month: number;
  value: string;
};

function getCurrentMonth(): Month {
  const { year, month } = getChileDateParts(new Date());
  return {
    year,
    month,
    value: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function parseMonth(value: string | undefined): Month {
  const match = value?.match(MONTH_PATTERN);
  if (!match) return getCurrentMonth();

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    value: value as string,
  };
}

function formatKilos(value: number): string {
  return `${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 2,
  }).format(value)} kg`;
}

function formatDayLabel(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export default async function FlujoCajaPage({ searchParams }: FlujoCajaPageProps) {
  await requireAdmin();

  const { month: requestedMonth } = await searchParams;
  const selectedMonth = parseMonth(requestedMonth);
  const { year, month, value: monthValue } = selectedMonth;

  // La ventana agrega un margen para incluir el mes completo aunque la base de datos
  // guarde las fechas en UTC; el agrupamiento final siempre usa horario de Chile.
  const queryStart = new Date(Date.UTC(year, month - 1, 1) - 18 * 60 * 60 * 1000);
  const queryEnd = new Date(Date.UTC(year, month, 1) + 18 * 60 * 60 * 1000);
  const comprobantes = await prisma.comprobante.findMany({
    where: {
      createdAt: {
        gte: queryStart,
        lt: queryEnd,
      },
    },
    select: {
      createdAt: true,
      kilos: true,
      montoTotal: true,
    },
  });

  const totalsByDay = new Map<number, { count: number; kilos: number; total: number }>();
  for (const comprobante of comprobantes) {
    const date = getChileDateParts(comprobante.createdAt);
    if (date.year !== year || date.month !== month) continue;

    const current = totalsByDay.get(date.day) ?? { count: 0, kilos: 0, total: 0 };
    current.count += 1;
    current.kilos += comprobante.kilos;
    current.total += comprobante.montoTotal;
    totalsByDay.set(date.day, current);
  }

  const dailyRows = Array.from({ length: getDaysInMonth(year, month) }, (_, index) => {
    const day = index + 1;
    const totals = totalsByDay.get(day) ?? { count: 0, kilos: 0, total: 0 };

    return {
      day,
      label: formatDayLabel(year, month, day),
      ...totals,
    };
  });
  const monthlyTotal = dailyRows.reduce((total, row) => total + row.total, 0);
  const totalPurchases = dailyRows.reduce((total, row) => total + row.count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100 px-4 py-8">
      <main className="mx-auto w-full max-w-5xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/70 sm:p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Frambuesas App
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              Flujo de caja
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Este resumen muestra los egresos registrados por compras. No incluye ingresos
              ni gastos manuales.
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
              href="/compras"
              className="inline-flex h-10 items-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Nueva compra
            </Link>
          </div>
        </div>

        <form className="mb-6 flex flex-wrap items-end gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="grid gap-2">
            <label htmlFor="month" className="text-sm font-semibold text-zinc-800">
              Mes
            </label>
            <input
              id="month"
              name="month"
              type="month"
              defaultValue={monthValue}
              className="h-11 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Ver mes
          </button>
        </form>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
            <p className="text-sm font-semibold text-rose-800">Egresos por compras</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-rose-950">
              {formatCLP(monthlyTotal)}
            </p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-zinc-700">Compras registradas</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
              {totalPurchases}
            </p>
          </div>
        </section>

        {totalPurchases === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-6 text-center text-sm text-zinc-600">
            No hay compras registradas para este mes.
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-3xl border border-zinc-200">
          <div className="border-b border-zinc-200 bg-white px-5 py-4">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Detalle diario</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Montos agrupados según la fecha de Chile.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Día
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Compras
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Kg totales
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Egresos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {dailyRows.map((row) => (
                  <tr key={row.day}>
                    <td className="px-5 py-3 text-sm font-medium capitalize text-zinc-800">
                      {row.label}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-zinc-600">{row.count}</td>
                    <td className="px-5 py-3 text-right text-sm text-zinc-600">
                      {formatKilos(row.kilos)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-zinc-900">
                      {formatCLP(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
