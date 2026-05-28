# Guía de configuración: Vercel + Supabase + Prisma

Esta guía explica cómo dejar Frambuesas App Nube funcionando en producción con Vercel y Supabase.

## 1. Crear o revisar el proyecto en Supabase

En Supabase:

1. Entra a tu proyecto.
2. Abre **Project Settings**.
3. Guarda estos datos:
   - **Project URL**: se usará como `NEXT_PUBLIC_SUPABASE_URL`.
   - **service_role key**: se usará como `SUPABASE_SERVICE_ROLE_KEY`.
   - **Database connection string**: se usará como `DATABASE_URL`.

Importante:

- La `service_role key` es secreta.
- No debe ir en código frontend.
- No debe subirse a GitHub.
- Solo debe configurarse como variable de entorno en Vercel/local.

## 2. Configurar la base de datos PostgreSQL

La app usa Prisma con PostgreSQL. El esquema está en:

```text
prisma/schema.prisma
```

Modelos:

- `Cliente`
- `Comprobante`

### Opción recomendada: migraciones Prisma

En local, con `DATABASE_URL` apuntando a tu base Supabase:

```bash
cp .env.example .env
```

Edita `.env` con tus valores reales y luego ejecuta:

```bash
npm ci
npx prisma migrate dev --name init
```

Esto crea una carpeta `prisma/migrations` y aplica las tablas en Supabase.

Después sube la migración a GitHub:

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "chore: add initial prisma migration"
git push
```

En producción, Prisma puede aplicar migraciones con:

```bash
npx prisma migrate deploy
```

### Opción alternativa: usar Prisma db push

Si quieres sincronizar rápido sin migraciones versionadas:

```bash
npx prisma db push
```

Esta opción es útil al inicio, pero para producción estable se recomiendan migraciones.

## 3. Crear el bucket de Supabase Storage

En Supabase:

1. Ve a **Storage**.
2. Crea un bucket llamado:

```text
comprobantes
```

3. Puede ser **privado**.

La app usa `SUPABASE_SERVICE_ROLE_KEY` desde el servidor para:

- Subir PDFs.
- Crear signed URLs temporales.
- Redirigir desde `/c/[code]` al PDF firmado.

Si quieres otro nombre de bucket, cambia la variable:

```env
SUPABASE_COMPROBANTES_BUCKET="otro-nombre"
```

## 4. Variables de entorno locales

Crea `.env` desde el ejemplo:

```bash
cp .env.example .env
```

Ejemplo:

```env
DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@HOST:6543/postgres?pgbouncer=true"
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="ey..."
SUPABASE_COMPROBANTES_BUCKET="comprobantes"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Luego prueba:

```bash
npm ci
npm run lint
npm run build
npm run dev
```

## 5. Variables de entorno en Vercel

En Vercel:

1. Abre tu proyecto.
2. Ve a **Settings** → **Environment Variables**.
3. Agrega estas variables para Production, Preview y Development según necesites:

```env
DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@HOST:6543/postgres?pgbouncer=true"
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="ey..."
SUPABASE_COMPROBANTES_BUCKET="comprobantes"
NEXT_PUBLIC_APP_URL="https://tu-app.vercel.app"
```

Recomendación:

- En `NEXT_PUBLIC_APP_URL`, usa el dominio final de producción, por ejemplo:

```env
NEXT_PUBLIC_APP_URL="https://frambuesas-app-nube.vercel.app"
```

Esto permite que los mensajes de WhatsApp y links cortos usen una URL pública correcta.

## 6. Connection string de Supabase para Vercel

Para apps serverless en Vercel, Supabase suele recomendar usar el connection pooler.

Busca en Supabase:

```text
Project Settings -> Database -> Connection string
```

Si tienes opción de pooler, usa una URL parecida a:

```env
DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@HOST:6543/postgres?pgbouncer=true"
```

Si usas conexión directa, revisa que acepte conexiones desde Vercel.

## 7. Deploy en Vercel

Vercel detectará Next.js automáticamente.

Build command actual en `package.json`:

```bash
prisma generate --schema prisma/schema.prisma && next build
```

Después de configurar variables:

1. Haz redeploy.
2. Abre la URL de producción.
3. Prueba crear un cliente.
4. Prueba crear un comprobante.
5. Revisa que el PDF aparezca en Supabase Storage.
6. Prueba el link corto `/c/[code]`.

## 8. Checklist de verificación

Antes de usar con datos reales:

- [ ] `npm run lint` pasa.
- [ ] `npm run build` pasa.
- [ ] `DATABASE_URL` funciona contra Supabase.
- [ ] Las tablas existen en Supabase.
- [ ] El bucket `comprobantes` existe.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está solo en Vercel/local, no en GitHub.
- [ ] `NEXT_PUBLIC_APP_URL` apunta al dominio de producción.
- [ ] Crear cliente funciona.
- [ ] Crear comprobante sube PDF a Storage.
- [ ] Descargar/ver comprobante funciona.
- [ ] Se agregó protección o autenticación si la app estará pública.

## 9. Seguridad recomendada

Actualmente las páginas de gestión son accesibles si alguien conoce la URL. Antes de producción, protege estas rutas:

```text
/clientes
/clientes/nuevo
/clientes/[id]/editar
/clientes/[id]/comprobantes
/comprobantes
```

Opciones:

- Supabase Auth.
- Middleware con usuario/contraseña.
- Vercel Deployment Protection.
- Autenticación con proveedor externo.

El endpoint `/c/[code]` puede quedar público porque solo redirige a una signed URL temporal del comprobante.

## 10. Problemas comunes

### Error: `DATABASE_URL is not set.`

Falta configurar `DATABASE_URL` en `.env` o Vercel.

### Error: `SUPABASE_SERVICE_ROLE_KEY is not set.`

Falta la clave service role en variables de entorno.

### Error al subir PDF a Storage

Revisar:

- Que el bucket exista.
- Que el nombre coincida con `SUPABASE_COMPROBANTES_BUCKET`.
- Que `SUPABASE_SERVICE_ROLE_KEY` sea correcta.

### Links de WhatsApp apuntan a localhost

Configura en Vercel:

```env
NEXT_PUBLIC_APP_URL="https://tu-app.vercel.app"
```

### Tablas no existen

Ejecuta una de estas opciones:

```bash
npx prisma migrate dev --name init
```

O:

```bash
npx prisma db push
```
