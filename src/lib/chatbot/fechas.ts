import "server-only";
import { z } from "zod";
import { CHILE_TIME_ZONE, getChileDateParts } from "@/lib/timezone";

// Resolución de períodos en horario de Chile. La base de datos guarda `createdAt`
// en UTC, así que convertimos cada frontera de calendario chileno al instante UTC
// exacto (manejando el cambio de hora) antes de filtrar. Reutiliza la convención
// de zona horaria de `src/lib/timezone.ts`.

export const periodoSchema = z.object({
  tipo: z.enum([
    "mes_actual",
    "mes_pasado",
    "trimestre_actual",
    "trimestre_pasado",
    "anio_actual",
    "ultimas_semanas",
    "ultimos_dias",
    "rango",
  ]),
  n: z.number().int().positive().max(520).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type Periodo = z.infer<typeof periodoSchema>;

export type RangoResuelto = {
  // `desde` inclusivo, `hasta` exclusivo (usar gte/lt en la consulta).
  desde: Date;
  hasta: Date;
  etiqueta: string;
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DIA_MS = 24 * 60 * 60 * 1000;

// Offset (hora local de Chile menos UTC, en ms) vigente en ese instante.
function offsetChileMs(instant: Date): number {
  const p = getChileDateParts(instant);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return comoUtc - instant.getTime();
}

// Convierte una hora de pared chilena (año/mes/día 00:00) al instante UTC real.
function horaChileAUtc(year: number, month: number, day: number): Date {
  const estimado = Date.UTC(year, month - 1, day);
  const offset = offsetChileMs(new Date(estimado));
  return new Date(estimado - offset);
}

function inicioDeMes(year: number, month: number): RangoResuelto {
  const siguiente =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    desde: horaChileAUtc(year, month, 1),
    hasta: horaChileAUtc(siguiente.year, siguiente.month, 1),
    etiqueta: `${MESES[month - 1]} ${year}`,
  };
}

function trimestreDeMes(month: number): number {
  return Math.floor((month - 1) / 3) + 1; // 1..4
}

function inicioDeTrimestre(year: number, trimestre: number): RangoResuelto {
  const mesInicio = (trimestre - 1) * 3 + 1;
  const finYear = trimestre === 4 ? year + 1 : year;
  const finMes = trimestre === 4 ? 1 : mesInicio + 3;
  return {
    desde: horaChileAUtc(year, mesInicio, 1),
    hasta: horaChileAUtc(finYear, finMes, 1),
    etiqueta: `trimestre ${trimestre} de ${year}`,
  };
}

function parseYMD(valor: string): { year: number; month: number; day: number } {
  const [year, month, day] = valor.split("-").map(Number);
  return { year, month, day };
}

export function resolverPeriodo(periodo: Periodo): RangoResuelto {
  const ahora = new Date();
  const hoy = getChileDateParts(ahora);

  switch (periodo.tipo) {
    case "mes_actual":
      return inicioDeMes(hoy.year, hoy.month);

    case "mes_pasado": {
      const idx = hoy.year * 12 + (hoy.month - 1) - 1;
      return inicioDeMes(Math.floor(idx / 12), (idx % 12) + 1);
    }

    case "trimestre_actual":
      return inicioDeTrimestre(hoy.year, trimestreDeMes(hoy.month));

    case "trimestre_pasado": {
      let trimestre = trimestreDeMes(hoy.month) - 1;
      let year = hoy.year;
      if (trimestre < 1) {
        trimestre = 4;
        year -= 1;
      }
      return inicioDeTrimestre(year, trimestre);
    }

    case "anio_actual":
      return {
        desde: horaChileAUtc(hoy.year, 1, 1),
        hasta: horaChileAUtc(hoy.year + 1, 1, 1),
        etiqueta: `año ${hoy.year}`,
      };

    case "ultimas_semanas": {
      const n = periodo.n ?? 4;
      return {
        desde: new Date(ahora.getTime() - n * 7 * DIA_MS),
        hasta: ahora,
        etiqueta: `últimas ${n} semanas`,
      };
    }

    case "ultimos_dias": {
      const n = periodo.n ?? 7;
      return {
        desde: new Date(ahora.getTime() - n * DIA_MS),
        hasta: ahora,
        etiqueta: `últimos ${n} días`,
      };
    }

    case "rango": {
      if (!periodo.desde || !periodo.hasta) {
        throw new Error(
          "El período de tipo 'rango' requiere 'desde' y 'hasta' en formato YYYY-MM-DD.",
        );
      }
      const d = parseYMD(periodo.desde);
      const h = parseYMD(periodo.hasta);
      return {
        desde: horaChileAUtc(d.year, d.month, d.day),
        // `hasta` inclusivo: extendemos al inicio del día siguiente (exclusivo).
        hasta: horaChileAUtc(h.year, h.month, h.day + 1),
        etiqueta: `del ${periodo.desde} al ${periodo.hasta}`,
      };
    }
  }
}

export function descripcionAhoraChile(): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function formatearFechaChile(date: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Describe un rango [desde, hastaExclusiva) en fechas de Chile, para citar la
// fuente de los agregados. Resta 1 ms para mostrar el último día incluido.
export function formatearRangoChile(desde: Date, hastaExclusiva: Date): string {
  const fin = new Date(hastaExclusiva.getTime() - 1);
  return `del ${formatearFechaChile(desde)} al ${formatearFechaChile(fin)}`;
}
