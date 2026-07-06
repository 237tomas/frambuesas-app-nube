import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, hasValidAdminSession } from "@/lib/admin-session";
import { cargarHistorial } from "@/lib/chat-historial";
import { ChatbotWidget } from "@/app/chatbot/chatbot-widget";

// Muestra el widget del chatbot solo cuando hay sesión de administrador válida.
// Así el botón aparece en todas las páginas protegidas pero no en /login.
export async function ChatbotGate() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!(await hasValidAdminSession(token))) {
    return null;
  }

  // P2.1: el historial persistido se carga en el servidor y llega al widget
  // como conversación inicial.
  const historial = await cargarHistorial();

  return <ChatbotWidget mensajesIniciales={historial} />;
}
