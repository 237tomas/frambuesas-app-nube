"use client";

import { useEffect, useRef, useState } from "react";
import { limpiarHistorial, preguntar } from "./actions";

type Mensaje = {
  rol: "user" | "assistant";
  contenido: string;
};

type ChatbotWidgetProps = {
  mensajesIniciales: Mensaje[];
};

// El Server Action acepta hasta 20 mensajes de historial de 4000 caracteres;
// enviamos un poco menos para dejar margen.
const MAX_HISTORIAL = 12;
const MAX_CONTENIDO = 3500;

const SUGERENCIA_INICIAL =
  "Pregúntame, por ejemplo: “¿cuál es el teléfono de Juan?”, “¿cuándo fue la última compra a María?” o “¿quién fue el productor top del trimestre?”.";

// P2.2: sugerencias al abrir el chat. Las completas se envían directo; las que
// terminan en espacio se dejan en el campo para completar el nombre.
const SUGERENCIAS: { etiqueta: string; pregunta: string; enviar: boolean }[] = [
  {
    etiqueta: "Top del trimestre",
    pregunta: "¿Quién fue mi productor top del trimestre?",
    enviar: true,
  },
  {
    etiqueta: "Sin ventas en 3 semanas",
    pregunta: "¿Qué productores no me han vendido en las últimas 3 semanas?",
    enviar: true,
  },
  {
    etiqueta: "Teléfono de…",
    pregunta: "¿Cuál es el teléfono de ",
    enviar: false,
  },
  {
    etiqueta: "Última compra de…",
    pregunta: "¿Cuándo fue la última compra a ",
    enviar: false,
  },
];

// Separa la línea final "Fuente: ..." (trazabilidad P1.2) para mostrarla como
// texto secundario dentro de la burbuja.
function separarFuente(contenido: string): {
  cuerpo: string;
  fuente: string | null;
} {
  const lineas = contenido.trimEnd().split("\n");
  const ultima = lineas[lineas.length - 1]?.trim() ?? "";

  if (lineas.length > 1 && ultima.toLowerCase().startsWith("fuente:")) {
    return { cuerpo: lineas.slice(0, -1).join("\n").trimEnd(), fuente: ultima };
  }

  return { cuerpo: contenido, fuente: null };
}

// Avatar del asistente: círculo frambuesa (bg-chat-bot) con un ícono de bot.
// Es decorativo —el rol de asistente ya lo transmite el hilo—, por eso el
// contenedor va aria-hidden.
function AvatarBot() {
  return (
    <div
      aria-hidden="true"
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chat-bot text-white"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    </div>
  );
}

export function ChatbotWidget({ mensajesIniciales }: ChatbotWidgetProps) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>(mensajesIniciales);
  const [texto, setTexto] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mensajesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (abierto && !pendiente) {
      inputRef.current?.focus();
    }
  }, [abierto, pendiente]);

  useEffect(() => {
    // Desplaza solo el contenedor de mensajes (no la página).
    const contenedor = mensajesRef.current;
    if (contenedor) {
      contenedor.scrollTop = contenedor.scrollHeight;
    }
  }, [mensajes, pendiente, error, abierto]);

  async function enviarPregunta(pregunta: string) {
    if (!pregunta || pendiente) return;

    // Historial previo a esta pregunta (la acción agrega la pregunta aparte).
    const historial = mensajes.slice(-MAX_HISTORIAL).map((mensaje) => ({
      rol: mensaje.rol,
      contenido: mensaje.contenido.slice(0, MAX_CONTENIDO),
    }));

    setMensajes((prev) => [...prev, { rol: "user", contenido: pregunta }]);
    setTexto("");
    setError(null);
    setPendiente(true);

    try {
      const resultado = await preguntar({ pregunta, historial });

      if (resultado.ok) {
        setMensajes((prev) => [
          ...prev,
          { rol: "assistant", contenido: resultado.respuesta },
        ]);
      } else {
        setError(resultado.error);
      }
    } catch {
      setError("No se pudo contactar al asistente. Intenta nuevamente.");
    } finally {
      setPendiente(false);
    }
  }

  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void enviarPregunta(texto.trim());
  }

  function usarSugerencia(sugerencia: (typeof SUGERENCIAS)[number]) {
    if (pendiente) return;

    if (sugerencia.enviar) {
      void enviarPregunta(sugerencia.pregunta);
    } else {
      setTexto(sugerencia.pregunta);
      inputRef.current?.focus();
    }
  }

  async function borrarHistorial() {
    if (pendiente) return;
    if (!window.confirm("¿Borrar todo el historial de conversación?")) return;

    const resultado = await limpiarHistorial().catch(() => ({ ok: false }));
    if (resultado.ok) {
      setMensajes([]);
      setError(null);
    } else {
      setError("No se pudo borrar el historial. Intenta nuevamente.");
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {abierto ? (
        <section
          aria-label="Asistente de datos"
          className="flex h-[85vh] max-h-[46rem] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-400/30"
        >
          <header className="flex items-start justify-between gap-3 bg-chat-header px-5 py-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-chat-header-fg">
                Asistente de datos
              </h2>
              <p className="mt-0.5 text-xs text-chat-header-muted">
                Consulta productores y compras. Solo lectura.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={borrarHistorial}
                aria-label="Borrar historial de conversación"
                title="Borrar historial"
                className="rounded-full p-1.5 text-chat-header-muted transition hover:bg-white/10 hover:text-chat-header-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482 41.03 41.03 0 0 0-2.365-.298V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Zm-2.203 4.22a.75.75 0 0 1 .783.715l.25 5.5a.75.75 0 0 1-1.498.068l-.25-5.5a.75.75 0 0 1 .715-.783Zm5.121.783a.75.75 0 0 0-1.498-.068l-.25 5.5a.75.75 0 1 0 1.498.068l.25-5.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar asistente"
                className="rounded-full p-1.5 text-chat-header-muted transition hover:bg-white/10 hover:text-chat-header-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          </header>

          <div
            ref={mensajesRef}
            role="log"
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {/* Bienvenida del bot + sugerencias, siempre visibles (no desaparecen). */}
            <div className="flex items-start gap-2">
              <AvatarBot />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="w-fit max-w-full whitespace-pre-wrap rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-800">
                  {SUGERENCIA_INICIAL}
                </div>
                <div className="flex flex-col gap-2">
                  {SUGERENCIAS.map((sugerencia) => (
                    <button
                      key={sugerencia.etiqueta}
                      type="button"
                      disabled={pendiente}
                      onClick={() => usarSugerencia(sugerencia)}
                      className="rounded-xl border border-chat-sugerencia bg-white px-3.5 py-2 text-left text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                    >
                      {sugerencia.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {mensajes.map((mensaje, indice) => {
              if (mensaje.rol === "user") {
                return (
                  <p
                    key={indice}
                    className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-rose-600 px-4 py-2.5 text-sm text-white"
                  >
                    {mensaje.contenido}
                  </p>
                );
              }

              const { cuerpo, fuente } = separarFuente(mensaje.contenido);

              return (
                <div key={indice} className="flex items-start gap-2">
                  <AvatarBot />
                  <div className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-800">
                    {cuerpo}
                    {fuente ? (
                      <span className="mt-1.5 block border-t border-zinc-200 pt-1.5 text-xs text-zinc-500">
                        {fuente}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {pendiente ? (
              <div className="flex items-start gap-2">
                <AvatarBot />
                <p className="w-fit animate-pulse rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 motion-reduce:animate-none">
                  Consultando…
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="mr-auto w-fit max-w-[85%] rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </div>

          <form onSubmit={enviar} className="p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={texto}
                maxLength={1000}
                placeholder="Escribe tu consulta…"
                autoComplete="off"
                onChange={(event) => setTexto(event.target.value)}
                className="h-11 flex-1 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 motion-reduce:transition-none"
              />
              <button
                type="submit"
                disabled={pendiente || texto.trim().length === 0}
                className="inline-flex h-11 items-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                Enviar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar asistente de datos" : "Abrir asistente de datos"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-xl shadow-rose-400/40 transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        {abierto ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-6 w-6"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
