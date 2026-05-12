import { apiService, SignalsResponse } from './api';

export interface SignalLog {
  id: string;
  asset: string;
  action: string;
  price: string;
  tp: string;
  sl: string;
  time: string;
  latestupdate: string;
  receivedAt: Date;
}

class SignalsMonitorService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private phoneSecret: string | null = null;
  private isMonitoring: boolean = false;
  private signalLogs: SignalLog[] = [];
  private lastSeenSignalId: string | null = null;
  private onSignalReceived?: (signal: SignalLog) => void;
  private onError?: (error: string) => void;

  startMonitoring(phoneSecret: string, onSignalReceived?: (signal: SignalLog) => void, onError?: (error: string) => void) {
    if (this.isMonitoring) {
      console.log('Signals monitoring already running');
      return;
    }

    this.phoneSecret = phoneSecret;
    this.onSignalReceived = onSignalReceived;
    this.onError = onError;
    this.isMonitoring = true;
    this.lastSeenSignalId = null;

    console.log('Starting signals monitoring with phone_secret:', phoneSecret ? 'present' : 'missing');

    // Poll every 10 seconds (same cadence as the Android app)
    this.fetchSignals();
    this.intervalId = setInterval(() => this.fetchSignals(), 10000);
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    this.phoneSecret = null;
    this.lastSeenSignalId = null;
    console.log('Signals monitoring stopped');
  }

  private async fetchSignals() {
    if (!this.phoneSecret) return;

    try {
      const res: SignalsResponse = await apiService.getSignals(this.phoneSecret);

      if (res.message !== 'accept') return;

      // PHP returns data: null when no active signal
      if (!res.data) return;

      // Dedupe: PHP returns the same active signal on every poll
      if (res.data.id === this.lastSeenSignalId) return;
      this.lastSeenSignalId = res.data.id;

      const signalLog: SignalLog = {
        id: res.data.id,
        asset: res.data.asset,
        action: res.data.action,
        price: res.data.price,
        tp: res.data.tp,
        sl: res.data.sl,
        time: res.data.time,
        latestupdate: res.data.latestupdate,
        receivedAt: new Date(),
      };

      this.signalLogs.unshift(signalLog);
      // Keep max 50 signals in memory
      if (this.signalLogs.length > 50) {
        this.signalLogs = this.signalLogs.slice(0, 50);
      }

      console.log('New signal received:', signalLog.asset, signalLog.action);

      if (this.onSignalReceived) {
        this.onSignalReceived(signalLog);
      }
    } catch (error) {
      console.error('Error fetching signals:', error);
      if (this.onError) {
        this.onError(String(error));
      }
    }
  }

  getSignalLogs(): SignalLog[] {
    return [...this.signalLogs];
  }

  clearSignalLogs() {
    this.signalLogs = [];
    console.log('Signal logs cleared');
  }

  isRunning(): boolean {
    return this.isMonitoring;
  }

  getCurrentPhoneSecret(): string | null {
    return this.phoneSecret;
  }
}

export const signalsMonitor = new SignalsMonitorService();
export default signalsMonitor;
