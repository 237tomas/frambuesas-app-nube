import "server-only";
import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as {
  openaiClient: OpenAI | undefined;
};

// Modelo por defecto: gpt-5.4-mini (rápido y económico, soporta function calling
// vía Chat Completions). Se puede sobreescribir con OPENAI_CHAT_MODEL.
export const CHATBOT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini";

export function hasOpenAIEnv(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIClient(): OpenAI {
  if (globalForOpenAI.openaiClient) {
    return globalForOpenAI.openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const client = new OpenAI({ apiKey });

  if (process.env.NODE_ENV !== "production") {
    globalForOpenAI.openaiClient = client;
  }

  return client;
}
