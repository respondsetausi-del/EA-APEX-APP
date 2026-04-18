// Database signals polling — proxies to ea-converter.com PHP legacy endpoint
// (same path the Android APK hits) instead of directly hitting MySQL, because
// the render.com Node server can't reliably reach the GoDaddy DB.
//
// PHP endpoint: GET admin/api/signals/?phone_secret=X
// Response: { message: 'accept', data: { id, asset, action, price, tp, sl, time, latestupdate } | null }
//
// The endpoint returns the NEWEST active signal on every poll, so we dedupe
// by signal id locally to avoid re-firing the same trade.

import { proxySignals } from './ea-converter-proxy';

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
      const result = await proxySignals(phoneSecret);

      if (result.message !== 'accept') {
        console.warn('Signals poll returned non-accept:', result);
        return;
      }

      const signal = result.data;
      if (!signal) {
        // No active signal for this EA right now — not an error
        return;
      }

      // Dedupe: PHP always returns the newest active signal so the same id
      // will keep coming back until admin closes it. Only fire once per id.
      if (signal.id && signal.id === this.lastSeenSignalId) {
        return;
      }
      this.lastSeenSignalId = signal.id;

      // Adapt PHP's flat shape into the DatabaseSignal interface the app
      // provider already consumes (fills in fields PHP doesn't return).
      const adapted: DatabaseSignal = {
        id: signal.id,
        ea: '', // PHP response doesn't include it; app-provider doesn't need it downstream
        asset: signal.asset,
        latestupdate: signal.latestupdate,
        type: 'all',
        action: signal.action,
        price: signal.price,
        tp: signal.tp,
        sl: signal.sl,
        time: signal.time,
        results: 'active',
      };

      console.log('✅ New database signal found:', adapted);
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
