import "server-only";
import { prisma } from "@/lib/prisma";

// Persistencia del historial del chatbot (P2.1). Este módulo es el ÚNICO lugar
// donde el chatbot escribe en la base de datos, y solo sobre la tabla
// `MensajeChat` — jamás `Cliente` ni `Comprobante`. Vive fuera de
// src/lib/chatbot y src/app/chatbot a propósito: esos directorios los vigila
// scripts/check-chatbot-readonly.mjs y deben seguir siendo 100% de lectura
// (este archivo también se vigila, con una regla propia: solo MensajeChat).
//
// Todas las funciones degradan con gracia si la tabla aún no existe (por
// ejemplo, antes de aplicar la migración): el chat sigue funcionando, solo que
// sin memoria entre sesiones.

export type MensajePersistido = {
  rol: "user" | "assistant";
  contenido: string;
};

// Cuántos mensajes se cargan al abrir el chat y tope de filas retenidas.
const MAX_MENSAJES_CARGADOS = 30;
const MAX_MENSAJES_GUARDADOS = 400;

export async function cargarHistorial(): Promise<MensajePersistido[]> {
  try {
    const filas = await prisma.mensajeChat.findMany({
      orderBy: { id: "desc" },
      take: MAX_MENSAJES_CARGADOS,
      select: { rol: true, contenido: true },
    });

    return filas.reverse().map((fila) => ({
      rol: fila.rol === "assistant" ? "assistant" : "user",
      contenido: fila.contenido,
    }));
  } catch (error) {
    console.error("[chatbot] No se pudo cargar el historial:", error);
    return [];
  }
}

export async function guardarIntercambio(
  pregunta: string,
  respuesta: string,
): Promise<void> {
  try {
    // createMany respeta el orden: el id autoincremental deja la pregunta
    // antes que la respuesta.
    await prisma.mensajeChat.createMany({
      data: [
        { rol: "user", contenido: pregunta },
        { rol: "assistant", contenido: respuesta },
      ],
    });

    // Poda: conserva solo los últimos MAX_MENSAJES_GUARDADOS mensajes.
    const umbral = await prisma.mensajeChat.findMany({
      orderBy: { id: "desc" },
      skip: MAX_MENSAJES_GUARDADOS,
      take: 1,
      select: { id: true },
    });

    if (umbral.length > 0) {
      await prisma.mensajeChat.deleteMany({
        where: { id: { lte: umbral[0].id } },
      });
    }
  } catch (error) {
    // Mejor esfuerzo: si no se pudo persistir, la respuesta igual llega al usuario.
    console.error("[chatbot] No se pudo guardar el intercambio:", error);
  }
}

export async function borrarHistorial(): Promise<boolean> {
  try {
    await prisma.mensajeChat.deleteMany({});
    return true;
  } catch (error) {
    console.error("[chatbot] No se pudo borrar el historial:", error);
    return false;
  }
}
