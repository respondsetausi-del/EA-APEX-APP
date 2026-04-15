import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

// ── Device Fingerprint ──────────────────────────────────────
const DEVICE_ID_KEY = '@eaconverter_device_id';

function generateUUID(): string {
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 32; i++) {
    uuid += hex[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) uuid += '-';
  }
  return uuid;
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;

    const deviceId = `${Platform.OS}-${generateUUID()}-${Date.now()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch {
    const fallback = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try { await AsyncStorage.setItem(DEVICE_ID_KEY, fallback); } catch {}
    return fallback;
  }
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

  async getSignals(phoneSecret: string): Promise<SignalsResponse> {
    void phoneSecret;
    return { message: 'error' };
  }

  async getApp(email: string, use: boolean = false): Promise<App> {
    void use;
    if (!email) {
      return { message: 'none', version: 1 } as unknown as App;
    }
    return { message: 'accept', version: 1 } as unknown as App;
  }

  // Hit the same PHP endpoint the Android app uses
  // (see ea-converter/app/src/main/java/.../utils/Constants.kt → BASE_URL +
  //  network/api/RoboTraderAPI.kt → @GET("symbols/")).
  //
  // We used to route this through the RN-side proxy at /api/symbols, but that
  // proxy's SQL keyed on licences.phone_secret_code which doesn't match the
  // column the PHP admin writes, so it silently returned zero symbols and the
  // quotes screen fell into its mock-data fallback. Calling the PHP endpoint
  // directly keeps iOS and Android in lock-step.
  async getSymbols(phoneSecret: string): Promise<SymbolsResponse> {
    if (!phoneSecret) return { message: 'error' };
    const url = `https://ea-converter.com/admin/api/symbols?phone_secret=${encodeURIComponent(phoneSecret)}`;
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
      console.error(`[getSymbols] HTTP ${res.status} from ${url}`);
      return { message: 'error' };
    }
    try {
      const data = (await res.json()) as SymbolsResponse;
      return data;
    } catch (parseError) {
      console.error('[getSymbols] parse error:', parseError);
      return { message: 'error' };
    }
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
