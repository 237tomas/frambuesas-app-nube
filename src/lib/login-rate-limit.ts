import "server-only";

// Nota: este limitador vive en memoria del proceso. En un entorno serverless
// (Vercel) no se comparte entre instancias, por lo que es un mejor-esfuerzo que
// eleva la barrera ante fuerza bruta pero no la elimina. Para una garantía dura
// se necesita un store externo (Redis/Upstash) o una tabla en la base de datos.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as {
  loginAttempts?: Map<string, Bucket>;
};

const attempts = globalForRateLimit.loginAttempts ?? new Map<string, Bucket>();
globalForRateLimit.loginAttempts = attempts;

export function isLoginBlocked(key: string): boolean {
  const bucket = attempts.get(key);

  if (!bucket || bucket.resetAt <= Date.now()) {
    return false;
  }

  return bucket.count >= MAX_ATTEMPTS;
}

export function registerFailedLogin(key: string): void {
  const now = Date.now();
  const bucket = attempts.get(key);

  if (!bucket || bucket.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  bucket.count += 1;
}

export function clearLoginRateLimit(key: string): void {
  attempts.delete(key);
}
