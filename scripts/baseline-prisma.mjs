import { execFileSync } from "node:child_process";
import { URL } from "node:url";
import pg from "pg";

const baselineMigration = "20260620000000_init";
const schemaArgs = ["--schema", "prisma/schema.prisma"];
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to apply Prisma migrations.");
}

// Con DATABASE_CA_CERT (PEM de la CA de Supabase) se valida TLS de verdad;
// sin ella, se mantiene la conexión cifrada sin validar el emisor.
function getSslConfig(hostname) {
  const caCert = process.env.DATABASE_CA_CERT;

  if (caCert) {
    return { ssl: { ca: caCert.replace(/\\n/g, "\n") } };
  }

  return hostname.endsWith("supabase.com")
    ? { ssl: { rejectUnauthorized: false } }
    : {};
}

const databaseUrl = new URL(connectionString);
const client = new pg.Client({
  connectionString,
  ...getSslConfig(databaseUrl.hostname),
});

function runPrisma(...args) {
  execFileSync("npx", ["prisma", ...args, ...schemaArgs], {
    stdio: "inherit",
    env: process.env,
  });
}

await client.connect();

try {
  const { rows } = await client.query(`
    SELECT
      to_regclass('public."Cliente"') IS NOT NULL AS has_cliente,
      to_regclass('public."Comprobante"') IS NOT NULL AS has_comprobante,
      to_regclass('public."_prisma_migrations"') IS NOT NULL AS has_migrations_table;
  `);
  const state = rows[0];

  if (state.has_cliente !== state.has_comprobante) {
    throw new Error("Database has an incomplete legacy schema; baseline was not applied.");
  }

  if (state.has_cliente) {
    let isBaselineApplied = false;

    if (state.has_migrations_table) {
      const migration = await client.query(
        'SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1',
        [baselineMigration],
      );
      isBaselineApplied = migration.rowCount === 1;
    }

    if (!isBaselineApplied) {
      console.log(`Baselining existing schema with ${baselineMigration}.`);
      runPrisma("migrate", "resolve", "--applied", baselineMigration);
    }
  }
} finally {
  await client.end();
}

runPrisma("migrate", "deploy");
