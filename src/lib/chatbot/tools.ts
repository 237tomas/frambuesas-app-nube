import "server-only";
import type OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/comprobante-ui";
import {
  formatearFechaChile,
  formatearRangoChile,
  periodoSchema,
  resolverPeriodo,
} from "@/lib/chatbot/fechas";

// Catálogo de herramientas de SOLO LECTURA que el chatbot puede invocar.
// Cada herramienta valida su entrada con Zod y ejecuta exclusivamente consultas
// de lectura de Prisma (findMany / findFirst / aggregate / groupBy / count).
// Aquí no debe existir ningún método de escritura: `scripts/check-chatbot-readonly.mjs`
// lo verifica en cada build.

type ToolDef = OpenAI.Chat.Completions.ChatCompletionTool;

type Herramienta = {
  nombre: string;
  definicion: ToolDef;
  ejecutar: (argumentosJson: string) => Promise<unknown>;
};

function crearHerramienta<S extends z.ZodType>(opts: {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
  schema: S;
  ejecutar: (datos: z.infer<S>) => Promise<unknown>;
}): Herramienta {
  return {
    nombre: opts.nombre,
    definicion: {
      type: "function",
      function: {
        name: opts.nombre,
        description: opts.descripcion,
        parameters: opts.parametros,
      },
    },
    async ejecutar(argumentosJson: string) {
      let bruto: unknown;
      try {
        bruto = JSON.parse(argumentosJson || "{}");
      } catch {
        return { error: "Los argumentos no son un JSON válido." };
      }

      const parsed = opts.schema.safeParse(bruto);
      if (!parsed.success) {
        return {
          error: "Parámetros inválidos para la herramienta.",
          detalle: parsed.error.issues.map((i) => i.message),
        };
      }

      try {
        return await opts.ejecutar(parsed.data);
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "No se pudo ejecutar la consulta.",
        };
      }
    },
  };
}

function formatKilos(valor: number): string {
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(
    valor,
  )} kg`;
}

const periodoJsonSchema = {
  type: "object",
  description:
    "Período de tiempo. Para períodos relativos usa 'tipo'; para fechas exactas usa 'tipo':'rango' con 'desde' y 'hasta'.",
  properties: {
    tipo: {
      type: "string",
      enum: [
        "mes_actual",
        "mes_pasado",
        "trimestre_actual",
        "trimestre_pasado",
        "anio_actual",
        "ultimas_semanas",
        "ultimos_dias",
        "rango",
      ],
    },
    n: {
      type: "integer",
      description:
        "Cantidad de semanas o días. Solo para 'ultimas_semanas' o 'ultimos_dias'.",
    },
    desde: {
      type: "string",
      description: "Fecha de inicio (YYYY-MM-DD). Solo para 'rango'.",
    },
    hasta: {
      type: "string",
      description: "Fecha de fin inclusiva (YYYY-MM-DD). Solo para 'rango'.",
    },
  },
  required: ["tipo"],
  additionalProperties: false,
} as const;

// Normalización igual a la del buscador de la UI (cliente-search-field):
// sin tildes, sin mayúsculas. Así "acuna" encuentra a "Acuña".
function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizarRut(valor: string): string {
  return valor.replace(/[^0-9kK]/g, "").toLowerCase();
}

const buscarProductor = crearHerramienta({
  nombre: "buscarProductor",
  descripcion:
    "Busca productores (proveedores) por nombre parcial o RUT, ignorando mayúsculas y tildes. Devuelve sus datos de contacto. Úsala SIEMPRE primero para identificar a un productor. Si hay más de un resultado, pregunta al usuario cuál antes de continuar.",
  parametros: {
    type: "object",
    properties: {
      consulta: {
        type: "string",
        description: "Nombre (parcial) o RUT del productor a buscar.",
      },
    },
    required: ["consulta"],
    additionalProperties: false,
  },
  schema: z.object({ consulta: z.string().trim().min(1) }),
  async ejecutar({ consulta }) {
    const nombreBuscado = normalizarTexto(consulta);
    const rutBuscado = normalizarRut(consulta);

    // La cartera es pequeña (~100 productores): traemos todo y filtramos en
    // memoria para poder ignorar tildes, algo que `contains` de Prisma no hace.
    const todos = await prisma.cliente.findMany({
      select: {
        id: true,
        nombre: true,
        rut: true,
        telefonoWhatsapp: true,
        activo: true,
        precioKiloActual: true,
        notas: true,
      },
      orderBy: { nombre: "asc" },
    });

    const coincidencias = todos.filter((p) => {
      if (nombreBuscado.length > 0 && normalizarTexto(p.nombre).includes(nombreBuscado)) {
        return true;
      }
      return rutBuscado.length >= 2 && normalizarRut(p.rut).includes(rutBuscado);
    });

    // Primero los que empiezan con lo buscado, luego alfabético.
    coincidencias.sort((a, b) => {
      const aEmpieza = normalizarTexto(a.nombre).startsWith(nombreBuscado) ? 0 : 1;
      const bEmpieza = normalizarTexto(b.nombre).startsWith(nombreBuscado) ? 0 : 1;
      return aEmpieza - bEmpieza || a.nombre.localeCompare(b.nombre, "es");
    });

    const sugerencia =
      coincidencias.length === 0
        ? "Sin coincidencias: dile al usuario que no encontraste el productor y ofrece buscar por RUT o con otra grafía."
        : coincidencias.length > 1
          ? "Hay varios candidatos: antes de usar otras herramientas, pregunta al usuario cuál es, nombrando cada uno con su RUT."
          : undefined;

    return {
      encontrados: coincidencias.length,
      productores: coincidencias.slice(0, 10).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        rut: p.rut,
        telefonoWhatsapp: p.telefonoWhatsapp,
        activo: p.activo,
        precioKiloActual: p.precioKiloActual,
        precioKiloActualTexto: formatCLP(p.precioKiloActual),
        notas: p.notas ? p.notas.slice(0, 200) : null,
      })),
      ...(sugerencia ? { sugerencia } : {}),
    };
  },
});

const ultimaCompra = crearHerramienta({
  nombre: "ultimaCompra",
  descripcion:
    "Devuelve la última compra (comprobante con la fecha más reciente) de un productor. Recibe el 'productorId' obtenido con buscarProductor.",
  parametros: {
    type: "object",
    properties: {
      productorId: {
        type: "string",
        description: "ID del productor obtenido con buscarProductor.",
      },
    },
    required: ["productorId"],
    additionalProperties: false,
  },
  schema: z.object({ productorId: z.string().min(1) }),
  async ejecutar({ productorId }) {
    const compra = await prisma.comprobante.findFirst({
      where: { clienteId: productorId },
      orderBy: { createdAt: "desc" },
      select: {
        folio: true,
        kilos: true,
        precioKilo: true,
        montoTotal: true,
        createdAt: true,
      },
    });

    if (!compra) {
      return { encontrada: false };
    }

    return {
      encontrada: true,
      compra: {
        folio: compra.folio,
        fecha: formatearFechaChile(compra.createdAt),
        fechaIso: compra.createdAt.toISOString(),
        kilos: compra.kilos,
        kilosTexto: formatKilos(compra.kilos),
        precioKilo: compra.precioKilo,
        precioKiloTexto: formatCLP(compra.precioKilo),
        montoTotal: compra.montoTotal,
        montoTotalTexto: formatCLP(compra.montoTotal),
      },
    };
  },
});

const kilosPorPeriodo = crearHerramienta({
  nombre: "kilosPorPeriodo",
  descripcion:
    "Suma los kilos, la cantidad de compras y el monto total que un productor vendió en un período. Recibe el 'productorId' (de buscarProductor) y un 'periodo'.",
  parametros: {
    type: "object",
    properties: {
      productorId: {
        type: "string",
        description: "ID del productor obtenido con buscarProductor.",
      },
      periodo: periodoJsonSchema,
    },
    required: ["productorId", "periodo"],
    additionalProperties: false,
  },
  schema: z.object({ productorId: z.string().min(1), periodo: periodoSchema }),
  async ejecutar({ productorId, periodo }) {
    const { desde, hasta, etiqueta } = resolverPeriodo(periodo);
    const agg = await prisma.comprobante.aggregate({
      where: { clienteId: productorId, createdAt: { gte: desde, lt: hasta } },
      _sum: { kilos: true, montoTotal: true },
      _count: { _all: true },
    });

    const kilos = agg._sum.kilos ?? 0;
    const monto = agg._sum.montoTotal ?? 0;

    return {
      periodo: etiqueta,
      rangoFechas: formatearRangoChile(desde, hasta),
      compras: agg._count._all,
      kilos,
      kilosTexto: formatKilos(kilos),
      montoTotal: monto,
      montoTotalTexto: formatCLP(monto),
    };
  },
});

const topProductoresPorKilos = crearHerramienta({
  nombre: "topProductoresPorKilos",
  descripcion:
    "Ranking de productores que más kilos vendieron en un período (de mayor a menor). Útil para 'quién es el productor top'. 'limite' es cuántos devolver (por defecto 1).",
  parametros: {
    type: "object",
    properties: {
      periodo: periodoJsonSchema,
      limite: {
        type: "integer",
        description: "Cuántos productores devolver (1 a 10). Por defecto 1.",
      },
    },
    required: ["periodo"],
    additionalProperties: false,
  },
  schema: z.object({
    periodo: periodoSchema,
    limite: z.number().int().positive().max(10).optional(),
  }),
  async ejecutar({ periodo, limite }) {
    const { desde, hasta, etiqueta } = resolverPeriodo(periodo);
    const rangoFechas = formatearRangoChile(desde, hasta);
    const grupos = await prisma.comprobante.groupBy({
      by: ["clienteId"],
      where: { createdAt: { gte: desde, lt: hasta } },
      _sum: { kilos: true, montoTotal: true },
      _count: { _all: true },
      orderBy: { _sum: { kilos: "desc" } },
      take: limite ?? 1,
    });

    if (grupos.length === 0) {
      return { periodo: etiqueta, rangoFechas, resultados: [] };
    }

    const ids = grupos.map((g) => g.clienteId);
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true },
    });
    const nombrePorId = new Map(clientes.map((c) => [c.id, c.nombre]));

    return {
      periodo: etiqueta,
      rangoFechas,
      resultados: grupos.map((g, i) => {
        const kilos = g._sum.kilos ?? 0;
        const monto = g._sum.montoTotal ?? 0;
        return {
          posicion: i + 1,
          productorId: g.clienteId,
          nombre: nombrePorId.get(g.clienteId) ?? "(desconocido)",
          kilos,
          kilosTexto: formatKilos(kilos),
          compras: g._count._all,
          montoTotal: monto,
          montoTotalTexto: formatCLP(monto),
        };
      }),
    };
  },
});

const productoresInactivos = crearHerramienta({
  nombre: "productoresInactivos",
  descripcion:
    "Lista de productores activos que NO han vendido (no tienen comprobantes) en las últimas 'semanas'. Incluye también a quienes nunca han vendido.",
  parametros: {
    type: "object",
    properties: {
      semanas: {
        type: "integer",
        description: "Número de semanas hacia atrás a considerar.",
      },
    },
    required: ["semanas"],
    additionalProperties: false,
  },
  schema: z.object({ semanas: z.number().int().positive().max(520) }),
  async ejecutar({ semanas }) {
    const corte = new Date(Date.now() - semanas * 7 * 24 * 60 * 60 * 1000);

    const activos = await prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });

    const conCompraReciente = await prisma.comprobante.findMany({
      where: { createdAt: { gte: corte } },
      distinct: ["clienteId"],
      select: { clienteId: true },
    });
    const idsRecientes = new Set(conCompraReciente.map((c) => c.clienteId));

    const inactivos = activos.filter((a) => !idsRecientes.has(a.id));
    const LIMITE = 40;

    return {
      semanas,
      sinComprasDesde: formatearFechaChile(corte),
      total: inactivos.length,
      productores: inactivos.slice(0, LIMITE).map((p) => p.nombre),
      truncado: inactivos.length > LIMITE,
    };
  },
});

const listaHerramientas: Herramienta[] = [
  buscarProductor,
  ultimaCompra,
  kilosPorPeriodo,
  topProductoresPorKilos,
  productoresInactivos,
];

const HERRAMIENTAS = new Map(listaHerramientas.map((h) => [h.nombre, h]));

export const definicionesOpenAI: ToolDef[] = listaHerramientas.map(
  (h) => h.definicion,
);

export async function ejecutarHerramienta(
  nombre: string,
  argumentosJson: string,
): Promise<unknown> {
  const herramienta = HERRAMIENTAS.get(nombre);
  if (!herramienta) {
    return { error: `Herramienta desconocida: ${nombre}` };
  }
  return herramienta.ejecutar(argumentosJson);
}
