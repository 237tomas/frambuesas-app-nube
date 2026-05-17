import PDFDocument from "pdfkit";

type ComprobantePdfInput = {
  folio: string;
  fechaIso: string;
  clienteNombre: string;
  clienteRut: string;
  clienteWhatsapp: string;
  kilos: number;
  precioKilo: number;
  montoTotal: number;
  observaciones: string | null;
};

export function generarComprobantePdfBuffer(
  input: ComprobantePdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(18)
      .fillColor("#111827")
      .text("Comprobante de Entrega", { align: "left" });

    doc
      .moveDown(0.5)
      .fontSize(11)
      .fillColor("#374151")
      .text(`Folio: ${input.folio}`)
      .text(`Fecha: ${input.fechaIso}`);

    doc
      .moveDown()
      .fontSize(12)
      .fillColor("#111827")
      .text("Cliente")
      .fontSize(11)
      .fillColor("#374151")
      .text(`Nombre: ${input.clienteNombre}`)
      .text(`RUT: ${input.clienteRut}`)
      .text(`WhatsApp: ${input.clienteWhatsapp}`);

    doc
      .moveDown()
      .fontSize(12)
      .fillColor("#111827")
      .text("Detalle")
      .fontSize(11)
      .fillColor("#374151")
      .text(`Kilos: ${input.kilos}`)
      .text(`Precio por kilo: $${input.precioKilo}`)
      .text(`Monto total: $${input.montoTotal}`);

    doc
      .moveDown()
      .fontSize(12)
      .fillColor("#111827")
      .text("Observaciones")
      .fontSize(11)
      .fillColor("#374151")
      .text(input.observaciones ?? "Sin observaciones");

    doc.moveDown(2).fontSize(10).fillColor("#6b7280").text("Generado por Frambuesas App");

    doc.end();
  });
}
