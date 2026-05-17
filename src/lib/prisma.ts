import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  return databaseUrl;
}

function createPrismaClient(): PrismaClient {
  const connectionString = getDatabaseUrl();
  const isSupabaseProdConnection =
    process.env.NODE_ENV === "production" && connectionString.includes("supabase.com");

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ...(isSupabaseProdConnection
        ? {
            ssl: { rejectUnauthorized: false },
          }
        : {}),
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
