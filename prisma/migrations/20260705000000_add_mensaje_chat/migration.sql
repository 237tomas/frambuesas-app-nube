-- CreateTable
CREATE TABLE "MensajeChat" (
    "id" SERIAL NOT NULL,
    "rol" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeChat_pkey" PRIMARY KEY ("id")
);

-- El historial del chatbot se accede solo desde código de servidor vía Prisma,
-- igual que el resto de tablas: RLS activado y sin acceso para los roles del
-- Data API de Supabase (incluida la secuencia del autoincremento).
ALTER TABLE public."MensajeChat" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."MensajeChat" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."MensajeChat" FROM authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public."MensajeChat_id_seq" FROM anon;
REVOKE ALL PRIVILEGES ON SEQUENCE public."MensajeChat_id_seq" FROM authenticated;
