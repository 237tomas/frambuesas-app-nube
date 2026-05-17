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

function createPrismaClient() {
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

export const prisma =
  process.env.NODE_ENV === "production"
    ? globalForPrisma.prisma ?? createPrismaClient()
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = undefined;
} else {
  globalForPrisma.prisma = prisma;
}
