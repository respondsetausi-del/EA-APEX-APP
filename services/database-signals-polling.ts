// Database signals polling — hits the SAME-ORIGIN server endpoint
// /api/get-new-signals?phone_secret=X on render.com, which proxies
// server-side to EA APEX PHP (see EXPO_PUBLIC_APEX_ORIGIN).
//
// Client cannot call PHP directly because of CORS + SSL cert issues on
// the fallback IP. Server→server proxy has neither.
//
// The PHP endpoint returns the NEWEST active signal on every poll,
// so we dedupe by signal id locally.

// API base URL — empty on web (same-origin), set via EXPO_PUBLIC_API_BASE_URL on native
const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export interface DatabaseSignal {
  id: string;
  ea: string;
  asset: string;
  latestupdate: string;
  type: string;
  action: string;
  price: string;
  tp: string;
  sl: string;
  time: string;
  results: string;
}

export interface LicenseData {
  id: string;
  owner: string;
  ea: string;
  user: string;
  k_ey: string;
  created: string;
  expires: string;
  plan: string;
  status: string;
  phone_secret_code: string;
  phoneId: string;
  power: string;
}

export interface SignalPollingCallback {
  onSignalFound: (signal: DatabaseSignal) => void;
  onError: (error: string) => void;
}

class DatabaseSignalsPollingService {
  private isEnabled: boolean = true;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onSignalFound?: (signal: DatabaseSignal) => void;
  private onError?: (error: string) => void;
  private currentPhoneSecret: string | null = null;
  private lastSeenSignalId: string | null = null;

  enableDatabaseConnections() {
    this.isEnabled = true;
    console.log('Database connections enabled for signals polling service');
  }

  disableDatabaseConnections() {
    this.isEnabled = false;
    this.stopPolling();
    console.log('Database connections disabled for signals polling service');
  }

  /**
   * Start polling for signals.
   *
   * @param phoneSecret  Licence's phone_secret_code (same auth token the Android
   *                     APK uses). This is the `phoneSecretKey` field on the
   *                     EA object stored in the app state.
   */
  startPolling(
    phoneSecret: string,
    onSignalFound?: (signal: DatabaseSignal) => void,
    onError?: (error: string) => void
  ) {
    if (this.intervalId) {
      console.log('Database signals polling already running');
      return;
    }

    this.onSignalFound = onSignalFound;
    this.onError = onError;
    this.currentPhoneSecret = phoneSecret;
    this.lastSeenSignalId = null;

    console.log('Starting database signals polling with phone_secret:', phoneSecret ? 'present' : 'missing');

    if (!this.isEnabled) {
      console.log('Database connections disabled - using mock data for testing');
      this.startMockPolling(phoneSecret);
      return;
    }

    this.startRealPolling(phoneSecret);
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentPhoneSecret = null;
    this.lastSeenSignalId = null;
    console.log('Database signals polling stopped');
  }

  // Mock polling for testing (when database is disabled)
  private startMockPolling(phoneSecret: string) {
    console.log('Starting mock database signals polling');

    this.intervalId = setInterval(() => {
      const mockSignal: DatabaseSignal = {
        id: 'mock-' + Date.now(),
        ea: 'MockEA',
        asset: 'XAUUSD',
        latestupdate: new Date().toISOString(),
        type: 'TRADE',
        action: Math.random() > 0.5 ? 'BUY' : 'SELL',
        price: (Math.random() * 1000 + 2000).toFixed(2),
        tp: (Math.random() * 50 + 10).toFixed(2),
        sl: (Math.random() * 30 + 5).toFixed(2),
        time: new Date().toISOString(),
        results: 'PENDING',
      };

      console.log('Mock database signal found:', mockSignal);
      if (this.onSignalFound) {
        this.onSignalFound(mockSignal);
      }
    }, 30000);
  }

  // Real polling — hits the PHP legacy endpoint every 10s, same URL the APK uses
  private startRealPolling(phoneSecret: string) {
    console.log('Starting real database signals polling via PHP proxy');

    this.intervalId = setInterval(async () => {
      try {
        await this.checkForNewSignals(phoneSecret);
      } catch (error) {
        console.error('Error checking for database signals:', error);
        if (this.onError) {
          this.onError(`Database error: ${error}`);
        }
      }
    }, 10000);
  }

  private async checkForNewSignals(phoneSecret: string) {
    try {
      // Hits /api/signals which proxies to PHP admin/api/signals/
      // Response format: { message: 'accept'|'error', data: {id,asset,action,price,tp,sl,time,latestupdate} | null }
      const url = `${BASE_URL}/api/signals?phone_secret=${encodeURIComponent(phoneSecret)}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>');
        console.warn(`Signals poll HTTP ${res.status}:`, body.slice(0, 300));
        return;
      }

      const data = (await res.json()) as { message?: string; data?: Partial<DatabaseSignal> | null };

      if (data.message !== 'accept') return;

      // PHP returns data: null when no active signal
      if (!data.data || !data.data.id) return;

      const signal = data.data;

      // Dedupe: server returns newest active signal on every poll,
      // so the same id keeps coming back until admin closes it.
      if (signal.id === this.lastSeenSignalId) return;
      this.lastSeenSignalId = signal.id;

      const adapted: DatabaseSignal = {
        id: signal.id,
        ea: signal.ea ?? '',
        asset: signal.asset ?? '',
        latestupdate: signal.latestupdate ?? '',
        type: signal.type ?? 'all',
        action: signal.action ?? '',
        price: signal.price ?? '0',
        tp: signal.tp ?? '0',
        sl: signal.sl ?? '0',
        time: signal.time ?? '',
        results: signal.results ?? 'active',
      };

      console.log('New database signal found:', adapted.asset, adapted.action);
      if (this.onSignalFound) {
        this.onSignalFound(adapted);
      }
    } catch (error) {
      console.error('Error in checkForNewSignals:', error);
      throw error;
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  getStatus() {
    return {
      isRunning: this.isRunning(),
      phoneSecret: this.currentPhoneSecret ? 'present' : null,
      lastSeenSignalId: this.lastSeenSignalId,
      isEnabled: this.isEnabled,
    };
  }
}

export const databaseSignalsPollingService = new DatabaseSignalsPollingService();
export default databaseSignalsPollingService;
