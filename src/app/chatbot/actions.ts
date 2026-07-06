"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { responderPregunta, type MensajeChat } from "@/lib/chatbot/agente";
import { borrarHistorial, guardarIntercambio } from "@/lib/chat-historial";

const mensajeSchema = z.object({
  rol: z.enum(["user", "assistant"]),
  contenido: z.string().trim().min(1).max(4000),
});

const entradaSchema = z.object({
  pregunta: z.string().trim().min(1).max(1000),
  historial: z.array(mensajeSchema).max(20).optional(),
});

export type RespuestaChat =
  | { ok: true; respuesta: string }
  | { ok: false; error: string };

export async function preguntar(entrada: unknown): Promise<RespuestaChat> {
  // El proxy es defensa en profundidad; esta acción es alcanzable por POST directo,
  // así que verificamos el admin aquí también.
  await requireAdmin();

  const parsed = entradaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, error: "La pregunta no es válida." };
  }

  try {
    const historial: MensajeChat[] = parsed.data.historial ?? [];
    const respuesta = await responderPregunta(parsed.data.pregunta, historial);

    // P2.1: persistir el intercambio (mejor esfuerzo; no bloquea la respuesta).
    await guardarIntercambio(parsed.data.pregunta, respuesta);

    return { ok: true, respuesta };
  } catch (error) {
    console.error("[chatbot] Error al responder:", error);
    return {
      ok: false,
      error: "Hubo un problema al procesar tu consulta. Intenta nuevamente.",
    };
  }
}

export async function limpiarHistorial(): Promise<{ ok: boolean }> {
  await requireAdmin();
  const ok = await borrarHistorial();
  return { ok };
}
