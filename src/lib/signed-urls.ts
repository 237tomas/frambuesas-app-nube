import {
  getComprobantesBucket,
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase-admin";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type ComprobanteFileRef = {
  storagePath: string;
  folio: string;
};

export type SignedUrlMaps = {
  viewUrls: Map<string, string>;
  downloadUrls: Map<string, string>;
};

export async function buildSignedUrlMaps(
  items: ComprobanteFileRef[],
): Promise<SignedUrlMaps> {
  const viewUrls = new Map<string, string>();
  const downloadUrls = new Map<string, string>();

  if (items.length === 0 || !hasSupabaseAdminEnv()) {
    return { viewUrls, downloadUrls };
  }

  const bucket = getComprobantesBucket();
  const supabaseAdmin = getSupabaseAdminClient();
  const signedResults = await Promise.all(
    items.map((item) =>
      Promise.all([
        supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(item.storagePath, SIGNED_URL_TTL_SECONDS),
        supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(item.storagePath, SIGNED_URL_TTL_SECONDS, {
            download: `comprobante-${item.folio}.pdf`,
          }),
      ]),
    ),
  );

  signedResults.forEach(([viewResult, downloadResult], index) => {
    const { storagePath } = items[index];
    if (!viewResult.error && viewResult.data?.signedUrl) {
      viewUrls.set(storagePath, viewResult.data.signedUrl);
    }
    if (!downloadResult.error && downloadResult.data?.signedUrl) {
      downloadUrls.set(storagePath, downloadResult.data.signedUrl);
    }
  });

  return { viewUrls, downloadUrls };
}
