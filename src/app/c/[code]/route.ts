import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComprobantesBucket, getSupabaseAdminClient } from "@/lib/supabase-admin";

type RouteProps = {
  params: Promise<{ code: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { code } = await params;

  const comprobante = await prisma.comprobante.findUnique({
    where: { shortCode: code },
    select: { storagePath: true },
  });

  if (!comprobante) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  const bucket = getComprobantesBucket();
  const supabaseAdmin = getSupabaseAdminClient();

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(comprobante.storagePath, 60 * 10);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "No se pudo generar acceso al comprobante." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
