import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  return databaseUrl;
}

// Supabase firma sus certificados con una CA propia. Si DATABASE_CA_CERT
// contiene ese certificado (PEM), se valida TLS de verdad; si no, se mantiene
// la conexión cifrada sin validar el emisor.
function getSslConfig(connectionString: string) {
  const caCert = process.env.DATABASE_CA_CERT;

  if (caCert) {
    return { ssl: { ca: caCert.replace(/\\n/g, "\n") } };
  }

  const isSupabaseProdConnection =
    process.env.NODE_ENV === "production" && connectionString.includes("supabase.com");

  return isSupabaseProdConnection ? { ssl: { rejectUnauthorized: false } } : {};
}

function createPrismaClient(): PrismaClient {
  const connectionString = getDatabaseUrl();

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ...getSslConfig(connectionString),
    }),
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);

    return typeof value === "function" ? value.bind(client) : value;
  },
});
