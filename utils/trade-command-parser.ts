/**
 * Rules-based parser for trade commands spoken/typed by the user.
 *
 * Feeds the trade chat widget: accepts a transcript fragment (either a full
 * command or a follow-up answer to a specific missing field) and returns the
 * merged order plus the list of fields still required.
 */

export type TradeAction = 'BUY' | 'SELL';

export interface ParsedOrder {
  action?: TradeAction;
  symbol?: string;
  count?: number;
  lot?: number;
  slPips?: number;
  slPrice?: number;
  tpPips?: number;
  tpPrice?: number;
}

export type ParseResultKind =
  | 'order'
  | 'cancel'
  | 'confirm'
  | 'help'
  | 'unknown'
  | 'ambiguous';

export interface ParseResult {
  kind: ParseResultKind;
  order: ParsedOrder;
  missing: MissingField[];
  unknownSymbol?: string;
  /** Candidate symbols when the user gave a bare currency code like "EUR". */
  candidates?: string[];
  /** Currency code that triggered disambiguation. */
  ambiguousToken?: string;
}

export type MissingField = 'action' | 'symbol';

export const REQUIRED_FIELDS: MissingField[] = ['action', 'symbol'];

export const SYMBOL_ALIASES: Record<string, string> = {
  gold: 'XAUUSD',
  xau: 'XAUUSD',
  silver: 'XAGUSD',
  xag: 'XAGUSD',
  cable: 'GBPUSD',
  fiber: 'EURUSD',
  fibre: 'EURUSD',
  euro: 'EURUSD',
  loonie: 'USDCAD',
  swissy: 'USDCHF',
  aussie: 'AUDUSD',
  kiwi: 'NZDUSD',
  yen: 'USDJPY',
  nasdaq: 'US100',
  nas100: 'US100',
  ndx: 'US100',
  dow: 'US30',
  us30: 'US30',
  sp500: 'US500',
  spx: 'US500',
  oil: 'USOIL',
  wti: 'USOIL',
  brent: 'UKOIL',
  bitcoin: 'BTCUSD',
  btc: 'BTCUSD',
  ether: 'ETHUSD',
  ethereum: 'ETHUSD',
  eth: 'ETHUSD',
};

const KNOWN_SYMBOLS = new Set<string>([
  ...Object.values(SYMBOL_ALIASES),
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
  'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'EURCHF', 'EURCAD',
  'GBPCHF', 'GBPAUD', 'GBPCAD', 'AUDCAD', 'AUDCHF', 'AUDNZD', 'CADCHF',
  'CADJPY', 'CHFJPY', 'NZDJPY', 'NZDCAD', 'NZDCHF',
  'XAUUSD', 'XAGUSD',
  'US100', 'US30', 'US500', 'UK100', 'GER40', 'JPN225',
  'USOIL', 'UKOIL',
  'BTCUSD', 'ETHUSD', 'XRPUSD', 'LTCUSD', 'SOLUSD',
]);

const CANCEL_WORDS = /^(cancel|nvm|never\s*mind|stop|abort|forget\s*it|no)\.?$/i;
const CONFIRM_WORDS = /^(confirm|yes|yeah|yep|go|do\s*it|send|trade\s*it|ok|okay)\.?$/i;
const HELP_WORDS = /^(help|\?|examples?|commands?)\.?$/i;

const ACTION_BUY = /\b(buy|long|bull(?:ish)?)\b/i;
const ACTION_SELL = /\b(sell|short|bear(?:ish)?)\b/i;

const COUNT_RX = [
  /(\d+)\s*(?:trades?|orders?|times?|positions?)\b/i,
  /\bx\s*(\d+)\b/i,
  /\b(\d+)\s*x\b/i,
];

const LOT_RX = [
  /(\d+(?:\.\d+)?)\s*lots?\b/i,
  /\blots?\s+(\d+(?:\.\d+)?)/i,
  /\bvolume\s+(\d+(?:\.\d+)?)/i,
  /\bsize\s+(\d+(?:\.\d+)?)/i,
];

const SL_RX = /\b(?:sl|stop(?:\s*loss)?)\s+(\d+(?:\.\d+)?)\s*(pips?|points?)?/i;
const TP_RX = /\b(?:tp|take(?:\s*profit)?|target)\s+(\d+(?:\.\d+)?)\s*(pips?|points?)?/i;

const PIPS_THRESHOLD = 1000;

const CURRENCY_CODES = new Set<string>([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD',
  'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'ZAR',
  'MXN', 'CNY', 'CNH', 'HUF', 'CZK', 'RUB', 'INR', 'KRW',
]);

const DISAMBIGUATION: Record<string, string[]> = {
  EUR: ['EURUSD', 'EURJPY', 'EURGBP'],
  GBP: ['GBPUSD', 'GBPJPY', 'GBPAUD'],
  USD: ['USDJPY', 'USDCHF', 'USDCAD'],
  JPY: ['USDJPY', 'EURJPY', 'GBPJPY'],
  CHF: ['USDCHF', 'EURCHF', 'GBPCHF'],
  AUD: ['AUDUSD', 'AUDJPY', 'AUDNZD'],
  NZD: ['NZDUSD', 'NZDJPY', 'AUDNZD'],
  CAD: ['USDCAD', 'CADJPY', 'EURCAD'],
};

function looksLikeCurrencyPair(upper: string): boolean {
  if (!/^[A-Z]{6}$/.test(upper)) return false;
  return CURRENCY_CODES.has(upper.slice(0, 3)) || CURRENCY_CODES.has(upper.slice(3, 6));
}

function normaliseSymbolToken(raw: string): string | null {
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return null;
  if (SYMBOL_ALIASES[clean]) return SYMBOL_ALIASES[clean];
  const upper = clean.toUpperCase();
  if (KNOWN_SYMBOLS.has(upper)) return upper;
  if (looksLikeCurrencyPair(upper)) return upper;
  return null;
}

function findSymbol(text: string): { symbol?: string; unknown?: string; ambiguous?: string } {
  const lower = text.toLowerCase();
  for (const alias of Object.keys(SYMBOL_ALIASES)) {
    const rx = new RegExp(`\\b${alias}\\b`, 'i');
    if (rx.test(lower)) return { symbol: SYMBOL_ALIASES[alias] };
  }
  const pair = text.match(/\b([A-Za-z]{6})\b/);
  if (pair) {
    const upper = pair[1].toUpperCase();
    const normalised = normaliseSymbolToken(pair[1]);
    if (normalised) return { symbol: normalised };
    if (looksLikeCurrencyPair(upper)) return { symbol: upper };
    return { unknown: upper };
  }
  const idx = text.match(/\b(US\d{2,3}|UK\d{2,3}|GER\d{2,3}|JPN\d{2,3}|BTCUSD|ETHUSD|USOIL|UKOIL|XAUUSD|XAGUSD)\b/i);
  if (idx) {
    const sym = idx[1].toUpperCase();
    if (KNOWN_SYMBOLS.has(sym)) return { symbol: sym };
    return { unknown: sym };
  }
  const threeLetter = text.matchAll(/\b([A-Za-z]{3})\b/g);
  for (const m of threeLetter) {
    const upper = m[1].toUpperCase();
    if (DISAMBIGUATION[upper]) return { ambiguous: upper };
  }
  return {};
}

function findAction(text: string): TradeAction | undefined {
  if (ACTION_SELL.test(text)) return 'SELL';
  if (ACTION_BUY.test(text)) return 'BUY';
  return undefined;
}

function findCount(text: string): number | undefined {
  for (const rx of COUNT_RX) {
    const m = text.match(rx);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0 && n <= 100) return n;
    }
  }
  return undefined;
}

function findLot(text: string): number | undefined {
  for (const rx of LOT_RX) {
    const m = text.match(rx);
    if (m) {
      const v = parseFloat(m[1]);
      if (Number.isFinite(v) && v > 0 && v <= 100) return v;
    }
  }
  return undefined;
}

function findSl(text: string): { slPips?: number; slPrice?: number } {
  const m = text.match(SL_RX);
  if (!m) return {};
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v) || v <= 0) return {};
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('pip') || unit.startsWith('point')) return { slPips: v };
  return v < PIPS_THRESHOLD ? { slPips: v } : { slPrice: v };
}

function findTp(text: string): { tpPips?: number; tpPrice?: number } {
  const m = text.match(TP_RX);
  if (!m) return {};
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v) || v <= 0) return {};
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('pip') || unit.startsWith('point')) return { tpPips: v };
  return v < PIPS_THRESHOLD ? { tpPips: v } : { tpPrice: v };
}

function extractFragments(text: string): ParsedOrder & { unknownSymbol?: string; ambiguousToken?: string } {
  const out: ParsedOrder & { unknownSymbol?: string; ambiguousToken?: string } = {};
  const action = findAction(text);
  if (action) out.action = action;
  const sym = findSymbol(text);
  if (sym.symbol) out.symbol = sym.symbol;
  else if (sym.unknown) out.unknownSymbol = sym.unknown;
  else if (sym.ambiguous) out.ambiguousToken = sym.ambiguous;
  const count = findCount(text);
  if (count !== undefined) out.count = count;
  const lot = findLot(text);
  if (lot !== undefined) out.lot = lot;
  const sl = findSl(text);
  if (sl.slPips !== undefined) out.slPips = sl.slPips;
  if (sl.slPrice !== undefined) out.slPrice = sl.slPrice;
  const tp = findTp(text);
  if (tp.tpPips !== undefined) out.tpPips = tp.tpPips;
  if (tp.tpPrice !== undefined) out.tpPrice = tp.tpPrice;
  return out;
}

export interface ParseOptions {
  prior?: ParsedOrder;
  awaitingField?: MissingField;
}

/**
 * Parse a user message. If `awaitingField` is set, we treat the message as a
 * direct answer for that field first (e.g. a bare "gold" → symbol XAUUSD).
 */
export function parseCommand(text: string, opts: ParseOptions = {}): ParseResult {
  const trimmed = text.trim();
  const prior = opts.prior ?? {};

  if (!trimmed) {
    return { kind: 'unknown', order: prior, missing: computeMissing(prior) };
  }

  if (CANCEL_WORDS.test(trimmed)) {
    return { kind: 'cancel', order: {}, missing: [] };
  }
  if (CONFIRM_WORDS.test(trimmed) && hasAllRequired(prior)) {
    return { kind: 'confirm', order: prior, missing: [] };
  }
  if (HELP_WORDS.test(trimmed)) {
    return { kind: 'help', order: prior, missing: computeMissing(prior) };
  }

  const fragment = extractFragments(trimmed);
  const merged: ParsedOrder = { ...prior };

  if (opts.awaitingField === 'symbol' && !fragment.symbol) {
    const lone = normaliseSymbolToken(trimmed.replace(/\s+/g, ''));
    if (lone) fragment.symbol = lone;
  }
  if (opts.awaitingField === 'action' && !fragment.action) {
    if (/^long$/i.test(trimmed) || /^buy$/i.test(trimmed)) fragment.action = 'BUY';
    else if (/^short$/i.test(trimmed) || /^sell$/i.test(trimmed)) fragment.action = 'SELL';
  }

  if (fragment.action) merged.action = fragment.action;
  if (fragment.symbol) merged.symbol = fragment.symbol;
  if (fragment.count !== undefined) merged.count = fragment.count;
  if (fragment.lot !== undefined) merged.lot = fragment.lot;
  if (fragment.slPips !== undefined) merged.slPips = fragment.slPips;
  if (fragment.slPrice !== undefined) merged.slPrice = fragment.slPrice;
  if (fragment.tpPips !== undefined) merged.tpPips = fragment.tpPips;
  if (fragment.tpPrice !== undefined) merged.tpPrice = fragment.tpPrice;

  const missing = computeMissing(merged);

  if (fragment.ambiguousToken && !merged.symbol) {
    const candidates = DISAMBIGUATION[fragment.ambiguousToken] ?? [];
    return {
      kind: 'ambiguous',
      order: merged,
      missing,
      ambiguousToken: fragment.ambiguousToken,
      candidates,
    };
  }

  if (
    fragment.unknownSymbol &&
    !merged.symbol &&
    !fragment.action &&
    !fragment.count &&
    !fragment.lot
  ) {
    return { kind: 'unknown', order: merged, missing, unknownSymbol: fragment.unknownSymbol };
  }

  const anyRecognised =
    fragment.action ||
    fragment.symbol ||
    fragment.count !== undefined ||
    fragment.lot !== undefined ||
    fragment.slPips !== undefined ||
    fragment.slPrice !== undefined ||
    fragment.tpPips !== undefined ||
    fragment.tpPrice !== undefined;

  if (!anyRecognised && !opts.awaitingField) {
    return { kind: 'unknown', order: merged, missing, unknownSymbol: fragment.unknownSymbol };
  }

  return { kind: 'order', order: merged, missing, unknownSymbol: fragment.unknownSymbol };
}

export function computeMissing(order: ParsedOrder): MissingField[] {
  const missing: MissingField[] = [];
  if (!order.action) missing.push('action');
  if (!order.symbol) missing.push('symbol');
  return missing;
}

export function hasAllRequired(order: ParsedOrder): boolean {
  return computeMissing(order).length === 0;
}

export function promptForField(field: MissingField): string {
  switch (field) {
    case 'action':
      return 'Buy or sell?';
    case 'symbol':
      return 'Which symbol? (e.g. gold, EURUSD, BTCUSD)';
  }
}

export function describeOrder(order: ParsedOrder, defaults: { lot: number; count: number }): string {
  const action = order.action ?? '?';
  const symbol = order.symbol ?? '?';
  const count = order.count ?? defaults.count;
  const lot = order.lot ?? defaults.lot;
  const parts = [`${action} · ${symbol}`, `${count} trade${count === 1 ? '' : 's'}`, `lot ${lot}`];
  if (order.slPips !== undefined) parts.push(`SL ${order.slPips}p`);
  else if (order.slPrice !== undefined) parts.push(`SL @${order.slPrice}`);
  if (order.tpPips !== undefined) parts.push(`TP ${order.tpPips}p`);
  else if (order.tpPrice !== undefined) parts.push(`TP @${order.tpPrice}`);
  return parts.join(' · ');
}

export const HELP_TEXT = [
  'Examples:',
  '• "buy gold" → BUY XAUUSD × 1',
  '• "sell EURUSD 3 trades"',
  '• "long BTCUSD 0.05 lots sl 200 tp 500"',
  '• "buy nasdaq x5"',
  'Say "confirm" to place or "cancel" to abort.',
].join('\n');
