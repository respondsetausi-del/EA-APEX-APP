// MQTT signals — real-time push from the broker the MT5 EA publishes to.
//
// Runs alongside database-signals-polling so we keep working even when one
// transport drops. Both feeds normalise into the same DatabaseSignal shape
// the rest of the app already handles, and we dedupe by signal.id locally
// so a message arriving twice (broker redelivery, or once via MQTT + once
// via the polling fallback) is ignored.
//
// Web + React Native both use the WSS proxy. Native MQTT TCP (1883) isn't
// reachable from a browser on HTTPS (mixed content) and adds RN-side
// complexity; the proxy is the documented integration path for both.

import mqtt, { MqttClient } from 'mqtt';

const WSS_PROXY = 'wss://ea-converter-app-public.onrender.com/mqtt';
const SIGNALS_TOPIC = 'signals/all';
const DEDUPE_CAP = 1000;
const RECONNECT_MS = 3000;
const CONNECT_TIMEOUT_MS = 15000;

export interface MqttSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  signalType: 'ENTRY' | 'EXIT' | 'MODIFY';
  timestamp: string;
}

export type MqttSignalCallback = (signal: MqttSignal) => void;
export type MqttErrorCallback = (error: string) => void;

class MqttSignalsService {
  private client: MqttClient | null = null;
  private seenIds = new Set<string>();
  private onSignal?: MqttSignalCallback;
  private onError?: MqttErrorCallback;

  isRunning(): boolean {
    return this.client !== null;
  }

  start(onSignal: MqttSignalCallback, onError?: MqttErrorCallback) {
    if (this.client) {
      console.log('MQTT signals already running');
      return;
    }

    this.onSignal = onSignal;
    this.onError = onError;
    this.seenIds.clear();

    const clientId = `apex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log('MQTT connecting to', WSS_PROXY, 'as', clientId);

    try {
      this.client = mqtt.connect(WSS_PROXY, {
        clientId,
        clean: true,
        reconnectPeriod: RECONNECT_MS,
        connectTimeout: CONNECT_TIMEOUT_MS,
      });
    } catch (err) {
      console.error('MQTT connect threw:', err);
      this.onError?.(String(err));
      this.client = null;
      return;
    }

    this.client.on('connect', () => {
      console.log('MQTT connected — subscribing to', SIGNALS_TOPIC);
      this.client?.subscribe(SIGNALS_TOPIC, { qos: 0 }, (err) => {
        if (err) {
          console.error('MQTT subscribe error:', err);
          this.onError?.(`subscribe failed: ${err.message}`);
        } else {
          console.log('MQTT subscribed to', SIGNALS_TOPIC);
        }
      });
    });

    this.client.on('message', (_topic, payload) => {
      let signal: MqttSignal;
      try {
        signal = JSON.parse(payload.toString()) as MqttSignal;
      } catch (err) {
        console.error('MQTT parse error:', err);
        return;
      }
      if (!signal || typeof signal.id !== 'string' || !signal.id) return;

      if (this.seenIds.has(signal.id)) return;
      this.seenIds.add(signal.id);
      if (this.seenIds.size > DEDUPE_CAP) {
        const oldest = this.seenIds.values().next().value;
        if (oldest !== undefined) this.seenIds.delete(oldest);
      }

      console.log('MQTT signal:', signal.direction, signal.symbol, '@', signal.entryPrice);
      this.onSignal?.(signal);
    });

    this.client.on('reconnect', () => console.log('MQTT reconnecting…'));
    this.client.on('close', () => console.log('MQTT connection closed'));
    this.client.on('offline', () => console.log('MQTT offline'));
    this.client.on('error', (err) => {
      console.error('MQTT error:', err);
      this.onError?.(err?.message || String(err));
    });
  }

  stop() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch (err) {
        console.error('MQTT end error:', err);
      }
      this.client = null;
    }
    this.seenIds.clear();
    this.onSignal = undefined;
    this.onError = undefined;
  }

  /** Mark a signal id as seen externally so an already-processed signal
   *  (e.g. via the DB polling fallback) doesn't re-fire when MQTT later
   *  redelivers the same id. */
  markSeen(id: string) {
    if (!id) return;
    this.seenIds.add(id);
    if (this.seenIds.size > DEDUPE_CAP) {
      const oldest = this.seenIds.values().next().value;
      if (oldest !== undefined) this.seenIds.delete(oldest);
    }
  }
}

export const mqttSignalsService = new MqttSignalsService();
export default mqttSignalsService;
