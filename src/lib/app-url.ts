export function getPublicAppUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000";

  return envUrl.replace(/\/+$/, "");
}

export function isExternallyReachableAppUrl(appUrl: string): boolean {
  try {
    const { hostname } = new URL(appUrl);
    const lower = hostname.toLowerCase();

    if (lower === "localhost" || lower === "127.0.0.1") {
      return false;
    }

    if (lower.startsWith("10.") || lower.startsWith("192.168.")) {
      return false;
    }

    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
