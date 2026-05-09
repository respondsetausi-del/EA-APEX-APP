/**
 * EA APEX — single source for backend / web origin.
 * Set EXPO_PUBLIC_APEX_ORIGIN in .env (e.g. https://ea-apex.vercel.app).
 * No trailing slash.
 */
function normalizeOrigin(raw: string): string {
  return raw.replace(/\/+$/, '');
}

const fromEnv =
  typeof process !== 'undefined' && process.env.EXPO_PUBLIC_APEX_ORIGIN
    ? normalizeOrigin(process.env.EXPO_PUBLIC_APEX_ORIGIN)
    : '';

/** Public site + PHP API (Vercel or your host) */
export const APEX_ORIGIN = fromEnv || 'https://ea-apex.vercel.app';

export const apexAdminApiBase = `${APEX_ORIGIN}/admin/api`;
export const apexAdminUploadsBase = `${APEX_ORIGIN}/admin/uploads`;

export function apexShopIndexIosUrl(email: string, mentor: string): string {
  const q = new URLSearchParams({ email, mentor });
  return `${APEX_ORIGIN}/shop/indexIOS.php?${q}`;
}

export function apexPaymentRenewUrl(email: string, mentor: string): string {
  const q = new URLSearchParams({ email, mentor });
  return `${APEX_ORIGIN}/payment/renew.php?${q}`;
}

export function apexCheckEmailDeviceUrl(): string {
  return `${APEX_ORIGIN}/payment/check_email_device.php`;
}

export function apexAffiliateTrackUrl(): string {
  return `${APEX_ORIGIN}/affiliate/api/track.php`;
}
