/**
 * Proxy to EA APEX PHP admin API (`/admin/api/`).
 * Origin: `EXPO_PUBLIC_APEX_ORIGIN` (see `constants/apex-backend.ts`).
 */

import { apexAdminApiBase } from '@/constants/apex-backend';

const BASE_URL = apexAdminApiBase;
const TIMEOUT_MS = 25000;

const commonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'EAAPEX-Web/1.0',
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
  const res = await fetchWithTimeout(url, { method: 'GET' });

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

/**
 * Proxy getSymbols: maps to Android GET symbols/?phone_secret=X
 * Returns PHP's native shape: { message: 'accept' | 'error', data?: [{id,name}] }
 *
 * Must match how Android's RoboTraderAPI.getSymbols calls it
 * (baseUrl `admin/api/` + @GET("symbols/") + @Query("phone_secret")).
 */
export async function proxySymbols(
  phoneSecret: string
): Promise<{ message: 'accept' | 'error'; data?: Array<{ id: string; name: string }> }> {
  const trimmed = phoneSecret?.trim();
  if (!trimmed) return { message: 'error' };

  const params = new URLSearchParams({ phone_secret: trimmed });
  const url = `${BASE_URL}/symbols/?${params}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, { method: 'GET' });
  } catch (err) {
    console.error('❌ proxySymbols fetch error:', err);
    return { message: 'error' };
  }

  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch {
    console.error('❌ proxySymbols: could not read response body');
    return { message: 'error' };
  }

  if (!res.ok) {
    console.error(`❌ proxySymbols HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
    return { message: 'error' };
  }

  let data: { message?: string; data?: Array<{ id?: unknown; name?: unknown }> } = {};
  try {
    data = JSON.parse(bodyText);
  } catch {
    console.error('❌ proxySymbols: invalid JSON:', bodyText.slice(0, 300));
    return { message: 'error' };
  }

  const msg = String(data.message ?? '').toLowerCase();
  if (msg !== 'accept') {
    console.warn('⚠️ proxySymbols non-accept response:', bodyText.slice(0, 300));
    return { message: 'error' };
  }

  const rows = Array.isArray(data.data) ? data.data : [];
  return {
    message: 'accept',
    data: rows.map(r => ({ id: String(r?.id ?? ''), name: String(r?.name ?? '') })),
  };
}

/**
 * Proxy getSignals: maps to Android GET signals/?phone_secret=X
 * Returns PHP's native shape: { message: 'accept' | 'error', data?: { id, asset, action, price, tp, sl, time, latestupdate } | null }
 *
 * Must match how Android's RoboTraderAPI.getSignals calls it
 * (baseUrl `admin/api/` + @GET("signals/") + @Query("phone_secret")).
 *
 * PHP endpoint returns the NEWEST active signal (or null if none). Callers
 * must dedupe by id so the same signal isn't processed on every poll.
 */
export interface ProxySignal {
  id: string;
  asset: string;
  action: string;
  price: string;
  tp: string;
  sl: string;
  time: string;
  latestupdate: string;
}

export async function proxySignals(
  phoneSecret: string
): Promise<{ message: 'accept' | 'error'; data?: ProxySignal | null }> {
  const trimmed = phoneSecret?.trim();
  if (!trimmed) return { message: 'error' };

  const params = new URLSearchParams({ phone_secret: trimmed });
  const url = `${BASE_URL}/signals/?${params}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, { method: 'GET' });
  } catch (err) {
    console.error('❌ proxySignals fetch error:', err);
    return { message: 'error' };
  }

  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch {
    console.error('❌ proxySignals: could not read response body');
    return { message: 'error' };
  }

  if (!res.ok) {
    console.error(`❌ proxySignals HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
    return { message: 'error' };
  }

  let data: { message?: string; data?: Partial<ProxySignal> | null } = {};
  try {
    data = JSON.parse(bodyText);
  } catch {
    console.error('❌ proxySignals: invalid JSON:', bodyText.slice(0, 300));
    return { message: 'error' };
  }

  const msg = String(data.message ?? '').toLowerCase();
  if (msg !== 'accept') {
    console.warn('⚠️ proxySignals non-accept response:', bodyText.slice(0, 300));
    return { message: 'error' };
  }

  // PHP returns `data: null` when no active signal exists for this EA
  if (!data.data) return { message: 'accept', data: null };

  const r = data.data;
  return {
    message: 'accept',
    data: {
      id: String(r.id ?? ''),
      asset: String(r.asset ?? ''),
      action: String(r.action ?? ''),
      price: String(r.price ?? '0'),
      tp: String(r.tp ?? '0'),
      sl: String(r.sl ?? '0'),
      time: String(r.time ?? ''),
      latestupdate: String(r.latestupdate ?? ''),
    },
  };
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
  const res = await fetchWithTimeout(url, {
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
      ea_name: lic.ea_name ?? lic.notification_key ?? 'EA APEX',
      ea_notification: lic.ea_notification ?? lic.notification_key ?? '',
      owner: {
        name: owner.name ?? lic.owner_name ?? 'EA APEX',
        email: owner.email ?? lic.owner_email ?? '',
        phone: owner.phone ?? lic.owner_phone ?? '',
        logo: owner.logo ?? owner.image ?? lic.owner_logo ?? '',
      },
    },
  };
}
