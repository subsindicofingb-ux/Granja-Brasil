const SITE_URL_PATTERN = /^https?:\/\/[^/\s]+(?::\d+)?$/;

export function resolveSiteUrl(preferredOrigin?: string | null): string {
  const preferred = preferredOrigin?.trim().replace(/\/+$/, "");
  if (preferred && SITE_URL_PATTERN.test(preferred)) {
    return preferred;
  }

  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) {
    return explicit;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim().replace(/\/+$/, "");
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

export function buildAuthCallbackUrl(
  nextPath: string,
  preferredOrigin?: string | null,
  authType?: string,
): string {
  const siteUrl = resolveSiteUrl(preferredOrigin);
  const params = new URLSearchParams({ next: nextPath });
  if (authType) {
    params.set("type", authType);
  }
  return `${siteUrl}/auth/callback?${params.toString()}`;
}

export function buildPasswordRecoveryCallbackUrl(
  tokenHash: string,
  preferredOrigin?: string | null,
): string {
  const siteUrl = resolveSiteUrl(preferredOrigin);
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "recovery",
  });
  return `${siteUrl}/auth/confirm?${params.toString()}`;
}
