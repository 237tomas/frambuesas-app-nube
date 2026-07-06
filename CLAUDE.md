# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above imports `AGENTS.md`, which warns that this is **Next.js 16** with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code.

## What this is

Spanish-language web app for a raspberry (frambuesas) business that **buys** fruit from growers. Domain quirk: a `Cliente` is a grower/**supplier** the business pays (`precioKiloActual` = price per kilo paid to them), not a customer. Registering a purchase (a "compra") generates a `Comprobante` (a "Comprobante de Entrega" PDF) — there is no separate purchase model, **a compra *is* a `Comprobante`**. Receipts are rendered to PDF (PDFKit), uploaded to Supabase Storage, and shared via short links (`/c/[code]`). `/flujo-caja` aggregates comprobantes as monthly **egresos** (cash out). UI text and route names are in Spanish.

## Commands

```bash
npm run dev      # local dev server (http://localhost:3000)
npm run lint     # ESLint (eslint-config-next flat config)
npm run build    # check-chatbot-readonly + baseline-prisma + prisma generate + next build
npm run start    # run production build
npm run check:chatbot  # verify the chatbot stays read-only (also runs in build)
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
- **`src/app/c/[code]/route.ts`** — public-ish short-link handler: looks up `shortCode`, mints a 10-minute Supabase signed URL, and 307-redirects to it. This is how PDFs in a private bucket get shared. The comprobante list pages only surface these links (and the WhatsApp share button) when `isExternallyReachableAppUrl` (`src/lib/app-url.ts`) confirms the app URL is public — on localhost / private IPs the share UI is hidden.

**Receipt/PDF specifics:** PDFKit is declared in `serverExternalPackages` in `next.config.ts` (must not be bundled). Money fields (`precioKilo`, `montoTotal`, `precioKiloActual`) are stored as integer CLP; `kilos` is a float. UI money/text formatting helpers (`formatCLP`, `buildWhatsappMessage`, date parsers) live in `src/lib/comprobante-ui.ts`.

**Dates — always Chile time.** `src/lib/timezone.ts` (`getChileDateParts`, `CHILE_TIME_ZONE = America/Santiago`) is the single source of truth for local dates. Folios (`CP-YYYYMMDD-HHMMSS-rand`) encode Chile wall-clock time, and `/flujo-caja` groups comprobantes by Chile calendar day. Since Postgres stores `createdAt` in UTC, flujo-caja queries a ±18h-padded UTC window and then re-filters/-groups by Chile parts — never bucket `createdAt` directly.

## Auth

Password-based single-admin auth, no user accounts.

- **`src/proxy.ts`** is the Next.js 16 middleware (this version names the file `proxy.ts`, not `middleware.ts`). Its `matcher` gates `/`, `/clientes/*`, `/compras/*`, `/comprobantes/*`, `/flujo-caja/*`, redirecting unauthenticated requests to `/login`.
- **`src/lib/admin-session.ts`** — signs/verifies a JWT (jose, HS256) stored in the `frambuesas_admin_session` httpOnly cookie, 12h expiry. Requires `ADMIN_SESSION_SECRET` (≥32 chars).
- **`src/lib/admin-auth.ts`** — `matchesAdminPassword` (constant-time compare against `ADMIN_PASSWORD`, ≥11 chars) and **`requireAdmin()`**, which redirects to `/login` if unauthenticated. Call `requireAdmin()` at the top of every Server Action and protected page/service — the proxy is defense-in-depth, not the only check.
- **`src/lib/login-rate-limit.ts`** — in-memory, best-effort brute-force limiter (8 failed attempts / 15 min, keyed by `x-forwarded-for`). `login/actions.ts` checks it before verifying the password and clears it on success. Per-process only — it does **not** span Vercel serverless instances, so treat it as a speed bump, not a hard guarantee.

## Security model

The app is the only trusted path to the data. Migrations `..._enable_rls_and_restrict_public_access` and `..._protect_prisma_migrations` **enable Postgres RLS and REVOKE all privileges from the `anon`/`authenticated` roles** on `Cliente`/`Comprobante`. So Supabase's Data API / any browser-side Supabase client cannot read these tables — access is exclusively via Prisma using the privileged `DATABASE_URL`. Keep it that way: never expose the service-role key or add client-side data access.

## Migrations & deploy quirk

`npm run build` first runs **`scripts/baseline-prisma.mjs`**, which connects with `pg` and, if the tables already exist but the baseline migration `20260620000000_init` isn't recorded, runs `prisma migrate resolve --applied` to baseline the existing database before `prisma migrate deploy`. This lets an already-populated Supabase DB adopt migrations without data loss. If you add the first "real" schema migration on top of a legacy DB, be aware of this baselining step.

## Conventions

- Server Actions validate input with **Zod**, then on success `redirect(...)` with `?ok=...` / `?error=...` query params; pages read those params to render success/error banners (Spanish messages). Follow this pattern rather than returning error objects to the client.
- Unique-constraint violations are caught via `Prisma.PrismaClientKnownRequestError` with `error.code === "P2002"`.
- Protected pages set `export const dynamic = "force-dynamic"`.

## Environment

Copy `.env.example` → `.env.local`. Required: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_PASSWORD` (≥11 chars), `ADMIN_SESSION_SECRET` (≥32 chars); optional `SUPABASE_COMPROBANTES_BUCKET`. Chatbot: `OPENAI_API_KEY` (server-only, never client-exposed), optional `OPENAI_CHAT_MODEL` (default `gpt-5.4-mini`). Full setup: `docs/vercel-supabase-setup.md`.

## Chatbot de consulta de datos

Chatbot embebido (ícono flotante en toda página protegida) que deja al admin
consultar la base en lenguaje natural (teléfono de un productor, última compra,
kilos vendidos en un período…) en lugar de buscar a mano. PRD completo en
@docs/1. PRD-chatbot-consulta-datos.md.

**Arquitectura — agente OpenAI con tool-calling, todo en el servidor:**

- **`src/lib/chatbot/openai.ts`** — cliente OpenAI singleton (server-only). Modelo
  desde `OPENAI_CHAT_MODEL` (default `gpt-5.4-mini`); `hasOpenAIEnv()` para chequear
  la key sin instanciar.
- **`src/lib/chatbot/tools.ts`** — el catálogo de herramientas (`buscarProductor`,
  `ultimaCompra`, `kilosPorPeriodo`, `topProductoresPorKilos`, `productoresInactivos`).
  Cada una se declara con `crearHerramienta` (schema Zod + JSON-schema para OpenAI) y
  ejecuta **solo lecturas** de Prisma (`findMany`/`findFirst`/`aggregate`/`groupBy`/
  `count`). Para agregar una herramienta, defínela aquí y súmala a `listaHerramientas`.
  La búsqueda de productores trae toda la cartera (~100) y filtra en memoria para
  ignorar tildes/mayúsculas (misma normalización que el buscador de la UI).
- **`src/lib/chatbot/agente.ts`** — `responderPregunta` corre el bucle de tool-use
  (system prompt + historial + pregunta → hasta `MAX_ITERACIONES=6` vueltas de
  llamadas a herramientas). El system prompt impone: solo lectura, nunca inventar
  datos, pedir aclaración si `buscarProductor` devuelve varios, y cerrar con una
  línea `Fuente:` de trazabilidad. Texto plano, sin Markdown.
- **`src/lib/chatbot/fechas.ts`** — resuelve períodos relativos ("este mes",
  "últimas 3 semanas") a rangos UTC en hora de Chile (usa `src/lib/timezone.ts`).
- **`src/app/chatbot/actions.ts`** — Server Actions `preguntar` / `limpiarHistorial`;
  ambas llaman `requireAdmin()` (alcanzables por POST directo). Valida con Zod.
- **`src/app/chatbot/chatbot-gate.tsx`** + **`chatbot-widget.tsx`** — el gate
  renderiza el widget solo con sesión de admin válida y le pasa el historial
  persistido como conversación inicial.

**Restricción clave — SOLO LECTURA.** El chatbot nunca hace `create`/`update`/
`delete`. Única excepción controlada: el historial del chat persiste en la tabla
`MensajeChat` vía **`src/lib/chat-historial.ts`** — ese módulo es el único que
escribe, y solo sobre ese modelo (con poda a los últimos 400 mensajes; degrada con
gracia si la tabla aún no existe). `scripts/check-chatbot-readonly.mjs` (corre en
cada build y como `npm run check:chatbot`) hace cumplir ambas cosas: cero escrituras
bajo `src/{lib,app}/chatbot`, y escrituras limitadas a `mensajeChat` en el módulo de
historial. Si tu cambio rompe el build por este check, es intencional.
