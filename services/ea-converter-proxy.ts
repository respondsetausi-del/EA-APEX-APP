/**
 * Proxy to ea-converter.com/admin/api/ (Android backend)
 * Replaces direct DB connection for login and license auth.
 * Uses DIRECT_IP fallback when DNS fails or returns 403.
 */

const BASE_URL = 'https://ea-converter.com/admin/api';
const DIRECT_IP = 'https://37.148.203.172/admin/api';
const TIMEOUT_MS = 25000;

const commonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'EAConverter-Web/1.0',
};

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, {
    ...options,
    headers: { ...commonHeaders, ...(options.headers as Record<string, string>) },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}

/**
 * Fetch with fallback: try BASE_URL first, retry with DIRECT_IP on failure
 */
async function fetchWithFallback(
  url: string,
  options: RequestInit
): Promise<Response> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, options);
  } catch (err) {
    const fallbackUrl = url.replace('ea-converter.com', '37.148.203.172');
    console.log(`⚠️ Primary failed, retrying with DIRECT_IP: ${fallbackUrl}`);
    res = await fetchWithTimeout(fallbackUrl, {
      ...options,
      headers: {
        ...commonHeaders,
        Host: 'ea-converter.com',
        ...(options.headers as Record<string, string>),
      },
    });
    return res;
  }

  if (!res.ok && (res.status === 403 || res.status >= 500)) {
    const fallbackUrl = url.replace('ea-converter.com', '37.148.203.172');
    console.log(`⚠️ Retrying with DIRECT_IP fallback: ${fallbackUrl}`);
    res = await fetchWithTimeout(fallbackUrl, {
      ...options,
      headers: {
        ...commonHeaders,
        Host: 'ea-converter.com',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  return res;
}

/**
 * Proxy check-email: maps to Android GET auth/app/
 * Returns our format: { found, used, paid, invalidMentor }
 */
export async function proxyCheckEmail(
  email: string,
  use: boolean = false
): Promise<{ found: number; used: number; paid: number; invalidMentor: number }> {
  const params = new URLSearchParams({ email: email.trim().toLowerCase() });
  if (use) params.set('use', 'true');

  const url = `${BASE_URL}/auth/app/?${params}`;
  const res = await fetchWithFallback(url, { method: 'GET' });

  let data: { message?: string; version?: number } = {};
  try {
    data = (await res.json()) as { message?: string; version?: number };
  } catch {
    console.error('❌ proxyCheckEmail: invalid JSON response');
    return { found: 0, used: 0, paid: 0, invalidMentor: 0 };
  }

  const msg = String(data.message ?? '').toLowerCase();

  // accept, admin → grant access
  if (msg === 'accept' || msg === 'admin') {
    return { found: 1, used: 0, paid: 1, invalidMentor: 0 };
  }
  // used → already used on another device
  if (msg === 'used') {
    return { found: 1, used: 1, paid: 1, invalidMentor: 0 };
  }
  // other → not found / unpaid → show paywall
  return { found: 0, used: 0, paid: 0, invalidMentor: 0 };
}

interface AndroidLicence {
  key?: string;
  k_ey?: string;
  user?: string;
  status?: string;
  expires?: string;
  phone_secret_key?: string;
  phone_secret_code?: string;
  ea_name?: string;
  ea_notification?: string;
  notification_key?: string;
  owner?: { name?: string; email?: string; phone?: string; logo?: string; image?: string };
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  owner_logo?: string;
}

/**
 * Proxy auth-license: maps to Android POST auth/
 * Returns our format: { message, data? }
 */
export async function proxyAuthLicense(
  licence: string,
  phone_secret?: string
): Promise<{ message: 'accept' | 'used' | 'error'; data?: Record<string, unknown> }> {
  const body = JSON.stringify({
    licence: licence.trim(),
    phone_secret: phone_secret?.trim() || null,
  });

  const url = `${BASE_URL}/auth/`;
  const res = await fetchWithFallback(url, {
    method: 'POST',
    body,
  });

  let data: { message?: string; data?: AndroidLicence; Licence?: AndroidLicence } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    console.error('❌ proxyAuthLicense: invalid JSON response');
    return { message: 'error' };
  }

  const msg = String(data.message ?? '').toLowerCase();

  if (msg === 'used') {
    return { message: 'used' };
  }

  if (msg !== 'accept') {
    return { message: 'error' };
  }

  const lic = data.data ?? data.Licence;
  if (!lic) {
    return { message: 'error' };
  }

  const key = lic.key ?? lic.k_ey ?? licence.trim();
  const phoneSecret = lic.phone_secret_key ?? lic.phone_secret_code ?? '';
  const owner = lic.owner ?? {};

  return {
    message: 'accept',
    data: {
      user: String(lic.user ?? ''),
      status: String(lic.status ?? 'active'),
      expires: String(lic.expires ?? ''),
      key,
      phone_secret_key: phoneSecret,
      ea_name: lic.ea_name ?? lic.notification_key ?? 'EA CONVERTER',
      ea_notification: lic.ea_notification ?? lic.notification_key ?? '',
      owner: {
        name: owner.name ?? lic.owner_name ?? 'EA CONVERTER',
        email: owner.email ?? lic.owner_email ?? '',
        phone: owner.phone ?? lic.owner_phone ?? '',
        logo: owner.logo ?? owner.image ?? lic.owner_logo ?? '',
      },
    },
  };
}
