// Guardia de solo lectura del chatbot.
//
// Zona 1 — src/lib/chatbot y src/app/chatbot: el motor de consultas del chatbot
// NUNCA escribe en la base de datos. Cualquier método de escritura de Prisma o
// SQL crudo falla el build.
//
// Zona 2 — src/lib/chat-historial.ts: única excepción controlada. Puede
// escribir SOLO en el modelo `mensajeChat` (historial del propio chat, P2.1);
// cualquier escritura a otro modelo (Cliente, Comprobante, ...) falla el build.
//
// Solo marca métodos encadenados desde el cliente `prisma`
// (p. ej. `prisma.cliente.create(...)`), así que no confunde llamadas de otras
// librerías como `openai` (`client.chat.completions.create(...)`).
//
// Se ejecuta en `npm run build` (ver package.json) y con `npm run check:chatbot`.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIRECTORIOS = ["src/lib/chatbot", "src/app/chatbot"];

// Métodos de escritura de Prisma sobre un modelo (terminan en `(`).
const VERBOS_ESCRITURA = [
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
];

// Métodos crudos / transacciones sobre el cliente `prisma` (pueden esconder escrituras).
const METODOS_CRUDOS = [
  "queryRaw",
  "queryRawUnsafe",
  "executeRaw",
  "executeRawUnsafe",
  "transaction",
];

const patrones = [
  ...VERBOS_ESCRITURA.map((verbo) => ({
    etiqueta: `.${verbo}()`,
    // prisma[.modelo...].verbo(  — la cadena entre `prisma` y el verbo solo puede
    // tener accesos a propiedades y espacios, así que no cruza a otra expresión.
    regex: new RegExp(
      `\\bprisma(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)*\\s*\\.\\s*${verbo}\\s*\\(`,
      "g",
    ),
  })),
  ...METODOS_CRUDOS.map((metodo) => ({
    etiqueta: `.$${metodo}`,
    regex: new RegExp(`\\bprisma\\s*\\.\\s*\\$${metodo}`, "g"),
  })),
];

function archivosTs(dir) {
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return [];
  }

  const resultado = [];
  for (const entrada of entradas) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      resultado.push(...archivosTs(ruta));
    } else if (ruta.endsWith(".ts") || ruta.endsWith(".tsx")) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

const problemas = [];

for (const dir of DIRECTORIOS) {
  for (const archivo of archivosTs(dir)) {
    const contenido = readFileSync(archivo, "utf8");
    const lineas = contenido.split("\n");

    for (const { etiqueta, regex } of patrones) {
      let coincidencia;
      while ((coincidencia = regex.exec(contenido)) !== null) {
        const numeroLinea =
          contenido.slice(0, coincidencia.index).split("\n").length;
        problemas.push(
          `${archivo}:${numeroLinea}  usa "prisma${etiqueta}"  ->  ${lineas[
            numeroLinea - 1
          ].trim()}`,
        );
      }
    }
  }
}

// Zona 2: el módulo de historial solo puede escribir en `mensajeChat`.
const ARCHIVO_HISTORIAL = "src/lib/chat-historial.ts";
const MODELO_PERMITIDO = "mensajeChat";

try {
  const contenido = readFileSync(ARCHIVO_HISTORIAL, "utf8");
  const lineas = contenido.split("\n");
  const escrituraConModelo = new RegExp(
    `\\bprisma\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${VERBOS_ESCRITURA.join("|")})\\s*\\(`,
    "g",
  );

  let coincidencia;
  while ((coincidencia = escrituraConModelo.exec(contenido)) !== null) {
    const [, modelo, verbo] = coincidencia;
    if (modelo !== MODELO_PERMITIDO) {
      const numeroLinea =
        contenido.slice(0, coincidencia.index).split("\n").length;
      problemas.push(
        `${ARCHIVO_HISTORIAL}:${numeroLinea}  escribe en "prisma.${modelo}.${verbo}()" (solo se permite ${MODELO_PERMITIDO})  ->  ${lineas[numeroLinea - 1].trim()}`,
      );
    }
  }

  for (const metodo of METODOS_CRUDOS) {
    const regexCrudo = new RegExp(`\\bprisma\\s*\\.\\s*\\$${metodo}`, "g");
    while ((coincidencia = regexCrudo.exec(contenido)) !== null) {
      const numeroLinea =
        contenido.slice(0, coincidencia.index).split("\n").length;
      problemas.push(
        `${ARCHIVO_HISTORIAL}:${numeroLinea}  usa "prisma.$${metodo}" (prohibido en el historial)  ->  ${lineas[numeroLinea - 1].trim()}`,
      );
    }
  }
} catch {
  // Si el archivo no existe todavía, no hay nada que vigilar en la zona 2.
}

if (problemas.length > 0) {
  console.error(
    "\n❌ El módulo del chatbot debe ser de SOLO LECTURA, pero se encontraron métodos de escritura:\n",
  );
  for (const problema of problemas) {
    console.error(`  ${problema}`);
  }
  console.error(
    "\nElimina estas llamadas o muévelas fuera del chatbot (src/lib/chatbot, src/app/chatbot).\n",
  );
  process.exit(1);
}

console.log(
  "✓ Chatbot de solo lectura: sin escrituras de Prisma (historial limitado a MensajeChat).",
);
