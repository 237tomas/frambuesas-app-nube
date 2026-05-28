# Frambuesas App Nube

Aplicación web para gestionar clientes y generar comprobantes PDF de ventas/entregas de frambuesas.

La app permite:

- Registrar clientes con RUT, nombre, WhatsApp, precio por kilo y notas.
- Editar y activar/desactivar clientes.
- Generar comprobantes PDF por cliente.
- Subir los PDFs a Supabase Storage.
- Consultar historial de comprobantes por cliente y de forma global.
- Compartir comprobantes mediante links cortos como `/c/[code]`.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma 7
- PostgreSQL en Supabase
- Supabase Storage
- Vercel

## Requisitos

- Node.js compatible con Next.js 16.
- Cuenta/proyecto en Supabase.
- Proyecto en Vercel conectado al repositorio.
- Variables de entorno configuradas.

## Variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Variables requeridas:

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."
SUPABASE_COMPROBANTES_BUCKET="comprobantes"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Descripción:

- `DATABASE_URL`: conexión PostgreSQL de Supabase usada por Prisma.
- `NEXT_PUBLIC_SUPABASE_URL`: URL pública del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave secreta service role. Solo debe usarse del lado servidor.
- `SUPABASE_COMPROBANTES_BUCKET`: nombre del bucket de Storage para PDFs. Por defecto: `comprobantes`.
- `NEXT_PUBLIC_APP_URL`: URL pública de la aplicación. En producción debe ser tu URL de Vercel.

Más detalle en [`docs/vercel-supabase-setup.md`](docs/vercel-supabase-setup.md).

## Desarrollo local

Instala dependencias:

```bash
npm ci
```

Genera el cliente de Prisma:

```bash
npx prisma generate --schema prisma/schema.prisma
```

Ejecuta la app:

```bash
npm run dev
```

Abre:

```text
http://localhost:3000
```

## Base de datos

El esquema Prisma está en:

```text
prisma/schema.prisma
```

Modelos principales:

- `Cliente`
- `Comprobante`

Para crear una migración inicial:

```bash
npx prisma migrate dev --name init
```

Para aplicar migraciones en producción:

```bash
npx prisma migrate deploy
```

Si todavía no usas migraciones, revisa la guía completa en [`docs/vercel-supabase-setup.md`](docs/vercel-supabase-setup.md).

## Supabase Storage

La app espera un bucket de Storage llamado:

```text
comprobantes
```

Los PDFs se suben con rutas similares a:

```text
clientes/{clienteId}/{folio}.pdf
```

El bucket puede ser privado porque la app usa `SUPABASE_SERVICE_ROLE_KEY` desde servidor y genera signed URLs temporales para descargar o visualizar los PDFs.

## Scripts

```bash
npm run dev      # servidor local
npm run lint     # ESLint
npm run build    # Prisma generate + build de Next.js
npm run start    # iniciar build de producción
```

## Despliegue en Vercel

1. Conecta este repositorio en Vercel.
2. Configura las variables de entorno en Vercel.
3. Asegúrate de que Supabase tenga las tablas y el bucket `comprobantes`.
4. Ejecuta deploy.
5. Define `NEXT_PUBLIC_APP_URL` con la URL final de producción.

Guía paso a paso: [`docs/vercel-supabase-setup.md`](docs/vercel-supabase-setup.md).

## Seguridad

Importante: actualmente las páginas principales de gestión no tienen autenticación propia. Antes de usar la app con datos reales en producción, considera protegerla con una de estas opciones:

- Supabase Auth.
- Middleware con contraseña.
- Vercel Deployment Protection.
- Autenticación con Google/email.

Nunca subas archivos `.env` reales ni la `SUPABASE_SERVICE_ROLE_KEY` al repositorio.
