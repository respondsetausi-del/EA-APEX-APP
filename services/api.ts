import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

// ── Device Fingerprint ──────────────────────────────────────
// Stability is critical: the backend binds a subscription to whatever
// device_id it first sees. If this value ever changes for the same install
// — even transiently — the server returns device_mismatch and the user is
// kicked. Three lines of defense:
//   1. Crypto-backed UUID generation.
//   2. Module-level in-memory cache so a session always returns the same
//      ID even if a later AsyncStorage read fails.
//   3. On web, mirror the ID to localStorage so a cleared AsyncStorage
//      still recovers the original.
// MIGRATION: existing stored IDs (shape `${os}-<uuid>-<Date.now()>`) are
// never rewritten — only brand-new installs mint the new clean format.
const DEVICE_ID_KEY = '@eaconverter_device_id';

let cachedDeviceId: string | null = null;

function generateUUID(): string {
  try {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    if (g?.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      g.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex: string[] = [];
      for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }
  } catch {}
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 32; i++) {
    uuid += hex[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) uuid += '-';
  }
  return uuid;
}

function readLocalStorageId(): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    const w: any = typeof window !== 'undefined' ? window : undefined;
    return w?.localStorage?.getItem?.(DEVICE_ID_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorageId(id: string): void {
  if (Platform.OS !== 'web') return;
  try {
    const w: any = typeof window !== 'undefined' ? window : undefined;
    w?.localStorage?.setItem?.(DEVICE_ID_KEY, id);
  } catch {}
}

// Distinguish "storage returned null" (fresh install → mint is safe) from
// "storage threw" (transient failure → minting would overwrite the bound
// id and trigger a permanent device_mismatch on the server).
async function readAsyncStorageIdWithRetry(): Promise<
  { ok: true; value: string | null } | { ok: false }
> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const value = await AsyncStorage.getItem(DEVICE_ID_KEY);
      return { ok: true, value };
    } catch {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
    }
  }
  return { ok: false };
}

async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const asyncResult = await readAsyncStorageIdWithRetry();
  const localStored = readLocalStorageId();

  if (asyncResult.ok) {
    if (asyncResult.value) {
      if (!localStored) writeLocalStorageId(asyncResult.value);
      cachedDeviceId = asyncResult.value;
      return asyncResult.value;
    }
    if (localStored) {
      try { await AsyncStorage.setItem(DEVICE_ID_KEY, localStored); } catch {}
      cachedDeviceId = localStored;
      return localStored;
    }
    const deviceId = `${Platform.OS}-${generateUUID()}`;
    try { await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId); } catch {}
    writeLocalStorageId(deviceId);
    cachedDeviceId = deviceId;
    return deviceId;
  }

  // AsyncStorage threw on every retry. NEVER mint — that rewrites the
  // server-bound id and puts the user in permanent device_mismatch.
  // Fall back to localStorage if present, else surface the failure so
  // the caller retries instead of silently changing device identity.
  if (localStored) {
    cachedDeviceId = localStored;
    return localStored;
  }
  throw new Error('Device fingerprint unavailable — please retry');
}

// ── Types ───────────────────────────────────────────────────
export interface AuthBody {
  email: string;
  password?: string;
  mentor?: string;
}

export interface Account {
  id: string;
  email: string;
  status: string;
  paid: boolean;
  used: boolean;
  invalidMentor?: number;
  expired?: boolean;
  expiry_date?: string | null;
  device_mismatch?: boolean;
}

export interface App {
  message: string;
  version: number;
}

export interface Signals {
  signals: Signal[];
}

export interface Signal {
  id: string;
  asset: string;
  action: string;
  price: string;
  tp: string;
  sl: string;
  time: string;
  latestupdate: string;
}

export interface SignalsResponse {
  message: 'accept' | 'error';
  data?: Signal;
}

export interface SignalsListResponse {
  message: 'accept' | 'error';
  data?: Signal[];
}

export interface Symbol {
  id: string;
  name: string;
}

export interface SymbolsResponse {
  message: 'accept' | 'error';
  data?: Symbol[];
}

export interface LicenseAuthBody {
  licence: string;
  phone_secret?: string;
}

export interface Owner {
  name: string;
  email: string;
  phone: string;
  logo: string;
}

export interface LicenseData {
  user: string;
  status: string;
  expires: string;
  key: string;
  phone_secret_key: string;
  ea_name: string;
  ea_notification: string;
  owner: Owner;
}

export interface LicenseAuthResponse {
  message: 'accept' | 'used' | 'error';
  data?: LicenseData;
}

// ── API Service ─────────────────────────────────────────────
class ApiService {
  async authenticate(authBody: AuthBody): Promise<Account> {
    if (!authBody?.email) throw new Error('Email is required');

    const deviceId = await getOrCreateDeviceId();

    const endpoint = `${BASE_URL ? `${BASE_URL}` : ''}/api/check-email`;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authBody.email.trim().toLowerCase(),
          mentor: (authBody.mentor || authBody.password || '').toString().trim(),
          device_id: deviceId,
        }),
      });
    } catch (networkError) {
      const hint = BASE_URL
        ? ''
        : ' Set EXPO_PUBLIC_API_BASE_URL to your API host for native builds.';
      throw new Error(`Network error contacting auth service.${hint}`);
    }

    // Non-2xx means the proxy couldn't reach PHP (or PHP refused). Treat
    // that as transient so the background check's catch-branch fires and
    // no "revoked" signal is synthesized from an upstream outage.
    if (!res.ok) {
      throw new Error(`Auth service unavailable (status ${res.status})`);
    }

    let data: {
      found?: number;
      used?: number;
      paid?: number;
      invalidMentor?: number;
      expired?: number;
      expiry_date?: string | null;
      device_mismatch?: number;
    } = {};
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Authentication failed');
    }

    const found = Number(data?.found ?? 0) === 1;
    const used = Number(data?.used ?? 0) === 1;
    const paid = Number(data?.paid ?? 0) === 1;
    const invalidMentor = Number(data?.invalidMentor ?? 0);
    const expired = Number(data?.expired ?? 0) === 1;
    const deviceMismatch = Number(data?.device_mismatch ?? 0) === 1;

    return {
      id: authBody.email,
      email: authBody.email,
      status: found ? 'ok' : 'not_found',
      paid,
      used,
      invalidMentor,
      expired,
      expiry_date: data?.expiry_date || null,
      device_mismatch: deviceMismatch,
    };
  }

  // Register an (email, ref_code) attribution before the user is sent to
  // payment. The backend joins this on email when the PayFast webhook fires
  // and credits the affiliate exactly the same as the /r/CODE web landing.
  // Soft-fail: callers should never block payment on a failed track.
  async trackAffiliate(email: string, refCode: string): Promise<{ ok: boolean; affiliate_name?: string; error?: string }> {
    if (!email || !refCode) return { ok: false, error: 'Email and referral code required' };

    const endpoint = `${BASE_URL ? `${BASE_URL}` : ''}/api/affiliate-track`;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          ref_code: refCode.trim().toUpperCase(),
        }),
      });
    } catch {
      return { ok: false, error: 'Network error' };
    }

    try {
      const data = await res.json();
      return {
        ok: Boolean(data?.ok),
        affiliate_name: data?.affiliate_name,
        error: data?.error,
      };
    } catch {
      return { ok: false, error: 'Invalid response' };
    }
  }

  async getSignals(phoneSecret: string): Promise<SignalsResponse> {
    if (!phoneSecret) return { message: 'error' };
    const url = `${BASE_URL}/api/signals?phone_secret=${encodeURIComponent(phoneSecret)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
    } catch (networkError) {
      console.error('[getSignals] network error:', networkError);
      return { message: 'error' };
    }
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '<unreadable>');
      console.error(`[getSignals] HTTP ${res.status} body:`, bodyText.slice(0, 500));
      return { message: 'error' };
    }
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (readError) {
      console.error('[getSignals] read error:', readError);
      return { message: 'error' };
    }
    let data: SignalsResponse;
    try {
      data = JSON.parse(bodyText) as SignalsResponse;
    } catch (parseError) {
      console.error('[getSignals] parse error:', parseError, 'body:', bodyText.slice(0, 500));
      return { message: 'error' };
    }
    if (data?.message === 'accept') {
      console.log(`[getSignals] accept, signal: ${data.data ? data.data.asset + ' ' + data.data.action : 'none'}`);
    } else {
      console.warn('[getSignals] non-accept response:', bodyText.slice(0, 500));
    }
    return data;
  }

  async getApp(email: string, use: boolean = false): Promise<App> {
    void use;
    if (!email) {
      return { message: 'none', version: 1 } as unknown as App;
    }
    return { message: 'accept', version: 1 } as unknown as App;
  }

  // Same PHP symbols endpoint as the Android app; web goes through
  // `/api/symbols` (CORS). See `services/ea-converter-proxy.ts` → EA APEX
  // `admin/api/symbols/`.
  async getSymbols(phoneSecret: string): Promise<SymbolsResponse> {
    if (!phoneSecret) return { message: 'error' };
    const url = `${BASE_URL}/api/symbols?phone_secret=${encodeURIComponent(phoneSecret)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
    } catch (networkError) {
      console.error('[getSymbols] network error:', networkError);
      return { message: 'error' };
    }
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '<unreadable>');
      console.error(`[getSymbols] HTTP ${res.status} body:`, bodyText.slice(0, 500));
      return { message: 'error' };
    }
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (readError) {
      console.error('[getSymbols] read error:', readError);
      return { message: 'error' };
    }
    let data: SymbolsResponse;
    try {
      data = JSON.parse(bodyText) as SymbolsResponse;
    } catch (parseError) {
      console.error('[getSymbols] parse error:', parseError, 'body:', bodyText.slice(0, 500));
      return { message: 'error' };
    }
    if (data?.message !== 'accept') {
      console.warn('[getSymbols] non-accept response:', bodyText.slice(0, 500));
    } else {
      console.log(`[getSymbols] accept, ${data.data?.length ?? 0} symbols`);
    }
    return data;
  }

  async authenticateLicense(licenseBody: LicenseAuthBody): Promise<LicenseAuthResponse> {
    if (!licenseBody?.licence) return { message: 'error' };
    const endpoint = `${BASE_URL ? `${BASE_URL}` : ''}/api/auth-license`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(licenseBody),
        signal: controller.signal,
      });
    } catch (networkError) {
      clearTimeout(timeout);
      console.error('License auth network error:', networkError);
      return { message: 'error' };
    }
    clearTimeout(timeout);

    try {
      const data = (await res.json()) as LicenseAuthResponse;
      return data;
    } catch {
      return { message: 'error' };
    }
  }
}

export const apiService = new ApiService();
export default apiService;
