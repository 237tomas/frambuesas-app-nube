# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above imports `AGENTS.md`, which warns that this is **Next.js 16** with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code.

## What this is

Spanish-language web app for a raspberry (frambuesas) business: manage clients (`Cliente`) and generate PDF sales/delivery receipts (`Comprobante`). Receipts are rendered to PDF, uploaded to Supabase Storage, and shared via short links (`/c/[code]`). UI text and route names are in Spanish.

## Commands

```bash
npm run dev      # local dev server (http://localhost:3000)
npm run lint     # ESLint (eslint-config-next flat config)
npm run build    # baseline-prisma.mjs + prisma generate + next build
npm run start    # run production build
```

There is **no test suite** and no typecheck script; run `npx tsc --noEmit` for a type check. Lint a single directory with `npx eslint src/app/clientes`.

Prisma:
```bash
npx prisma generate --schema prisma/schema.prisma   # regenerate client after schema edits
npx prisma migrate dev --name <name>                # create + apply a migration locally
npx prisma migrate deploy                           # apply migrations (also run by build)
```

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Prisma 7 · Supabase (Postgres + Storage) · deployed on Vercel. Import alias: `@/*` → `src/*`.

**Data flow — server-only, no client-side DB or Supabase access.** All mutations are Server Actions (`"use server"` files named `actions.ts`) or route handlers; there is no REST/API layer for the browser. The browser never talks to Supabase or Postgres directly (see security below).

- **`src/lib/prisma.ts`** — lazy singleton `PrismaClient` behind a `Proxy`, using the `@prisma/adapter-pg` driver adapter over a `pg` connection. The generated client lives in **`src/generated/prisma/`** (checked in, `output` in schema) — import `Prisma`/`PrismaClient` from `@/generated/prisma/client`, not `@prisma/client`. Supabase prod connections relax SSL (`rejectUnauthorized: false`).
- **`src/lib/supabase-admin.ts`** — service-role Supabase client, server-only, used for Storage upload and signed-URL generation. Bucket name from `SUPABASE_COMPROBANTES_BUCKET` (default `comprobantes`).
- **`src/lib/comprobante-service.ts`** — the core receipt workflow: `crearComprobanteParaCliente` builds a folio + unique `shortCode`, renders the PDF (`comprobante-pdf.ts`, PDFKit), uploads to `clientes/{clienteId}/{folio}.pdf`, then persists the `Comprobante` row. Both the `compras` and per-client `comprobantes` flows call this.
- **`src/app/c/[code]/route.ts`** — public-ish short-link handler: looks up `shortCode`, mints a 10-minute Supabase signed URL, and 307-redirects to it. This is how PDFs in a private bucket get shared.

**Receipt/PDF specifics:** PDFKit is declared in `serverExternalPackages` in `next.config.ts` (must not be bundled). Money fields (`precioKilo`, `montoTotal`, `precioKiloActual`) are stored as integer CLP; `kilos` is a float.

## Auth

Password-based single-admin auth, no user accounts.

- **`src/proxy.ts`** is the Next.js 16 middleware (this version names the file `proxy.ts`, not `middleware.ts`). Its `matcher` gates `/`, `/clientes/*`, `/compras/*`, `/comprobantes/*`, `/flujo-caja/*`, redirecting unauthenticated requests to `/login`.
- **`src/lib/admin-session.ts`** — signs/verifies a JWT (jose, HS256) stored in the `frambuesas_admin_session` httpOnly cookie, 12h expiry. Requires `ADMIN_SESSION_SECRET` (≥32 chars).
- **`src/lib/admin-auth.ts`** — `matchesAdminPassword` (constant-time compare against `ADMIN_PASSWORD`, ≥11 chars) and **`requireAdmin()`**, which redirects to `/login` if unauthenticated. Call `requireAdmin()` at the top of every Server Action and protected page/service — the proxy is defense-in-depth, not the only check.

## Security model

The app is the only trusted path to the data. Migrations `..._enable_rls_and_restrict_public_access` and `..._protect_prisma_migrations` **enable Postgres RLS and REVOKE all privileges from the `anon`/`authenticated` roles** on `Cliente`/`Comprobante`. So Supabase's Data API / any browser-side Supabase client cannot read these tables — access is exclusively via Prisma using the privileged `DATABASE_URL`. Keep it that way: never expose the service-role key or add client-side data access.

## Migrations & deploy quirk

`npm run build` first runs **`scripts/baseline-prisma.mjs`**, which connects with `pg` and, if the tables already exist but the baseline migration `20260620000000_init` isn't recorded, runs `prisma migrate resolve --applied` to baseline the existing database before `prisma migrate deploy`. This lets an already-populated Supabase DB adopt migrations without data loss. If you add the first "real" schema migration on top of a legacy DB, be aware of this baselining step.

## Conventions

- Server Actions validate input with **Zod**, then on success `redirect(...)` with `?ok=...` / `?error=...` query params; pages read those params to render success/error banners (Spanish messages). Follow this pattern rather than returning error objects to the client.
- Unique-constraint violations are caught via `Prisma.PrismaClientKnownRequestError` with `error.code === "P2002"`.
- Protected pages set `export const dynamic = "force-dynamic"`.

## Environment

Copy `.env.example` → `.env.local`. Required: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_PASSWORD` (≥11 chars), `ADMIN_SESSION_SECRET` (≥32 chars); optional `SUPABASE_COMPROBANTES_BUCKET`. Full setup: `docs/vercel-supabase-setup.md`.
