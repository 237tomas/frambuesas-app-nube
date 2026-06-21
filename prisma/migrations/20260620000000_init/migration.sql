-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefonoWhatsapp" TEXT NOT NULL,
    "precioKiloActual" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comprobante" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "shortCode" TEXT,
    "kilos" DOUBLE PRECISION NOT NULL,
    "precioKilo" INTEGER NOT NULL,
    "montoTotal" INTEGER NOT NULL,
    "observaciones" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_rut_key" ON "Cliente"("rut");
CREATE UNIQUE INDEX "Comprobante_folio_key" ON "Comprobante"("folio");
CREATE UNIQUE INDEX "Comprobante_shortCode_key" ON "Comprobante"("shortCode");
CREATE UNIQUE INDEX "Comprobante_storagePath_key" ON "Comprobante"("storagePath");
CREATE INDEX "Comprobante_clienteId_createdAt_idx" ON "Comprobante"("clienteId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
