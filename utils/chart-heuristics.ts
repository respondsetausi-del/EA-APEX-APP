/**
 * Client-side chart "diagnostics" — no AI involved.
 *
 * Looks at candlestick colors and shape on a chart screenshot and produces a
 * descriptive readout (bias, trend, volatility, momentum). Intentionally
 * framed as *diagnostics*, not predictions.
 */

export type TradeSignal = {
  action: 'BUY' | 'SELL' | 'WAIT';
  strength: 'strong' | 'moderate' | 'weak';
  headline: string;
  rationale: string;
};

export type ChartInsights = {
  bias: 'bullish' | 'bearish' | 'neutral';
  trend: 'up' | 'down' | 'sideways';
  volatility: 'low' | 'moderate' | 'high';
  momentum: 'strengthening' | 'weakening' | 'stable';
  bullishPercent: number;
  bearishPercent: number;
  trendSlope: number;
  volatilityScore: number;
  momentumShift: number;
  /** 0-100 — how confident the heuristic is in its signal */
  confidence: number;
  /** Normalized notable price-level Y positions (0 = top of image, 1 = bottom). Max 3. */
  levels: number[];
  signal: TradeSignal;
  summary: string;
  bullets: string[];
};

export type RawStats = {
  greenCount: number;
  redCount: number;
  totalSampled: number;
  slope: number;
  spreadVariance: number;
  leftBias: number;
  rightBias: number;
  levels: number[];
};

// ── Variation pools ──────────────────────────────────────────────────
// Same stats → same copy (deterministic pick). Different stats → almost
// always different phrasing. Keeps rescans stable while fresh charts feel
// fresh — no two images should read the same.

type Bucket =
  | 'BUY-strong' | 'BUY-moderate' | 'BUY-weak'
  | 'SELL-strong' | 'SELL-moderate' | 'SELL-weak'
  | 'WAIT-weak';

const HEADLINES: Record<Bucket, string[]> = {
  'BUY-strong': [
    'BUY SIGNAL',
    'LONG ENTRY',
    'BULLISH BREAKOUT',
    'UPSIDE MOMENTUM',
    'STRONG LONG',
    'RIDE THE TREND',
  ],
  'BUY-moderate': [
    'BUY BIAS',
    'LONG SETUP',
    'BULLISH LEAN',
    'TENTATIVE LONG',
    'BUY THE DIP',
    'UPSIDE BIAS',
  ],
  'BUY-weak': [
    'CAUTIOUS LONG',
    'BUY — EXHAUSTION RISK',
    'LOW-CONVICTION LONG',
    'MIXED BULLISH',
    'BUY WITH CAUTION',
    'FADING LONG',
  ],
  'SELL-strong': [
    'SELL SIGNAL',
    'SHORT ENTRY',
    'BEARISH BREAKDOWN',
    'DOWNSIDE MOMENTUM',
    'STRONG SHORT',
    'FADE THE RALLY',
  ],
  'SELL-moderate': [
    'SELL BIAS',
    'SHORT SETUP',
    'BEARISH LEAN',
    'TENTATIVE SHORT',
    'SELL THE RIP',
    'DOWNSIDE BIAS',
  ],
  'SELL-weak': [
    'CAUTIOUS SHORT',
    'SELL — EXHAUSTION RISK',
    'LOW-CONVICTION SHORT',
    'MIXED BEARISH',
    'SELL WITH CAUTION',
    'FADING SHORT',
  ],
  'WAIT-weak': [
    'NO CLEAN EDGE',
    'RANGE-BOUND',
    'SIT ON HANDS',
    'NO SIGNAL',
    'INDECISIVE TAPE',
    'WAIT FOR BREAK',
  ],
};

const RATIONALES: Record<Bucket, string[]> = {
  'BUY-strong': [
    'Buyers are clearly in control — {bullishPercent}% of candles are green and structure is climbing with {momentum} momentum. Bias and slope are aligned, ride the move.',
    'Clean uptrend backed by a {bullishPercent}/{bearishPercent} bullish majority; every pullback is being bought. This is as textbook as a long gets.',
    'Demand is stacking — {bullishPercent}% green candles on a confirmed uptrend leaves dip-buyers firmly in control. Momentum is {momentum}.',
    'Bulls own the tape. {bullishPercent}% bullish candles, rising highs, and {momentum} momentum behind the push — clean long setup.',
    'Pixel read is stacked bullish: {bullishPercent}% green, slope rising, momentum {momentum}. Trend-followers get paid here.',
    'Strong long conditions — {bullishPercent}% bullish dominance, expanding uptrend, and buyers pressing on every dip.',
  ],
  'BUY-moderate': [
    '{bullishPercent}% of candles are green, which tilts bias to the upside, though slope is flat enough that this reads as a lean, not a breakout.',
    'Bullish lean with a {bullishPercent}/{bearishPercent} candle mix — the idea is right, but wait for a clean higher-low before pressing.',
    'Buyers have the edge ({bullishPercent}% green candles), but structure is not fully confirming yet. Momentum is {momentum}.',
    'The tape leans long: {bullishPercent}% bullish candles on an unresolved slope. Conviction is moderate until the trend kicks in.',
    'There is a bullish bias baked into the candles ({bullishPercent}%); without a strong slope this is a graze long, not a pound-the-table long.',
    'Buyers hold the balance at {bullishPercent}% of candles — call it bullish, but size accordingly until slope confirms.',
  ],
  'BUY-weak': [
    'Candle count leans bullish ({bullishPercent}% green), but slope is actually rolling over — classic exhaustion risk. Treat longs as counter-trend.',
    'Bullish candle majority ({bullishPercent}%) on a downward slope reads like late longs getting trapped. Wait for confirmation before pressing.',
    '{bullishPercent}% green candles contradict a downward-sloping structure — possible reversal brewing, not a clean long. Manage risk tightly.',
    'Green candle count is high ({bullishPercent}%) but structure is breaking lower. Longs here are fighting the slope.',
    'The candle mix says buy ({bullishPercent}% green), the slope says otherwise. Conflicts like this usually resolve against the latecomers.',
    'Bullish participation ({bullishPercent}%) on a bearish slope — either bulls overwhelm the structure or buyers get squeezed out. Low-conviction setup.',
  ],
  'SELL-strong': [
    'Sellers are dictating the tape — {bearishPercent}% of candles are red and structure is rolling over with {momentum} momentum. Fade every bounce.',
    'Clean downtrend backed by a {bearishPercent}/{bullishPercent} bearish majority; every rally is being sold into. Textbook short setup.',
    'Supply is hitting bounces — {bearishPercent}% red candles on a confirmed downtrend leaves sellers firmly in control. Momentum is {momentum}.',
    'Bears own the tape. {bearishPercent}% bearish candles, lower lows, and {momentum} momentum pushing the move — clean short setup.',
    'Pixel read is stacked bearish: {bearishPercent}% red, slope falling, momentum {momentum}. Trend-followers get paid on the short side.',
    'Strong short conditions — {bearishPercent}% bearish dominance, expanding downtrend, and sellers pressing on every bounce.',
  ],
  'SELL-moderate': [
    '{bearishPercent}% of candles are red, which tilts bias to the downside, though slope is flat enough that this reads as a lean, not a breakdown.',
    'Bearish lean with a {bearishPercent}/{bullishPercent} candle mix — the idea is right, but wait for a clean lower-high before shorting.',
    'Sellers have the edge ({bearishPercent}% red candles), but structure is not fully confirming yet. Momentum is {momentum}.',
    'The tape leans short: {bearishPercent}% bearish candles on an unresolved slope. Conviction is moderate until the trend kicks in.',
    'There is a bearish bias baked into the candles ({bearishPercent}%); without a strong slope this is a graze short, not a full commit.',
    'Sellers hold the balance at {bearishPercent}% of candles — call it bearish, but size accordingly until slope confirms.',
  ],
  'SELL-weak': [
    'Candle count leans bearish ({bearishPercent}% red), but slope is actually rising — classic exhaustion risk. Treat shorts as counter-trend.',
    'Bearish candle majority ({bearishPercent}%) on an upward slope reads like late shorts getting squeezed. Wait for confirmation.',
    '{bearishPercent}% red candles contradict an upward-sloping structure — possible reversal brewing, not a clean short. Manage risk tightly.',
    'Red candle count is high ({bearishPercent}%) but structure is pushing higher. Shorts here are fighting the slope.',
    'The candle mix says sell ({bearishPercent}% red), the slope says otherwise. These conflicts usually resolve against the latecomers.',
    'Bearish participation ({bearishPercent}%) on a bullish slope — either bears overwhelm the structure or sellers get covered out. Low-conviction setup.',
  ],
  'WAIT-weak': [
    'Candle mix is practically 50/50 ({bullishPercent}/{bearishPercent}) on a flat slope — no clean edge for either side. Patience pays here.',
    'Buyers and sellers are evenly matched ({bullishPercent}% / {bearishPercent}%) and structure is sideways. Sit on hands until the market picks a side.',
    'Tape is in equilibrium at {bullishPercent}/{bearishPercent} with no directional slope. Wait for a range break before committing.',
    'Nothing resolves: {bullishPercent}/{bearishPercent} candle split, flat structure. This is a do-nothing chart.',
    'Neither side is winning — {bullishPercent}/{bearishPercent} mix on a flat slope. Step aside until one takes control.',
    'Perfect indecision: {bullishPercent}/{bearishPercent} candles, flat structure, no reason to force a trade.',
  ],
};

const VOL_NOTES: Record<ChartInsights['volatility'], string[]> = {
  low: [
    'Volatility is low — tight stops are workable.',
    'Range is compressed — keep risk close.',
    'Quiet tape — stops can sit tight.',
  ],
  moderate: [
    'Moderate volatility — standard stop placement.',
    'Range is normal — size as usual.',
    'Volatility is in the neutral zone — no special adjustments.',
  ],
  high: [
    'High volatility — widen stops and size down.',
    'Range is wide — give stops room and cut size.',
    'Volatile tape — reduce size and respect the noise.',
  ],
};

const SUMMARIES: string[] = [
  '{biasLabel} candle majority ({bullishPercent}% green / {bearishPercent}% red) on a {trendLabel} with {volatility} volatility. Momentum is {momentum}.',
  'Candle split sits at {bullishPercent}/{bearishPercent} ({biasLabel} lean). Structure is a {trendLabel}, volatility reads {volatility}, momentum {momentum}.',
  '{trendLabel} backdrop with {bullishPercent}% bullish candles vs {bearishPercent}% bearish. Volatility {volatility}, momentum {momentum}.',
  '{biasLabel} tape ({bullishPercent}/{bearishPercent} candle mix) on a {trendLabel}. {volatility} volatility, {momentum} momentum.',
];

/**
 * Deterministic seed derived from the raw pixel stats. Identical input →
 * identical seed → identical copy. Different images almost always produce
 * different seeds (stats are continuous, so collisions are rare).
 */
function pickSeed(stats: RawStats): number {
  const s = Math.round(stats.slope * 1000);
  const v = Math.round(stats.spreadVariance * 777);
  const g = stats.greenCount | 0;
  const r = stats.redCount | 0;
  const lb = Math.round((stats.leftBias + 1) * 500);
  const rb = Math.round((stats.rightBias + 1) * 500);
  let h = (s * 13) ^ (v * 17) ^ (g * 23) ^ (r * 29) ^ (lb * 31) ^ (rb * 37);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function pickFrom<T>(arr: T[], seed: number, salt: number): T {
  return arr[(seed + salt) % arr.length];
}

function interpolate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Pure function — turns raw pixel stats into human-friendly insights.
 * No DOM / no Image / no Canvas — runs on any JS runtime.
 *
 * Signal is bias-first: bullish candle majority → BUY, bearish → SELL.
 * WAIT is deliberately rare (only when the mix is near-even AND the
 * slope is flat). Slope + momentum drive the *strength*, not the
 * direction — so a 72% green chart on a slightly down slope is still
 * a BUY, just a weaker one.
 */
export function buildInsights(stats: RawStats): ChartInsights {
  const total = Math.max(1, stats.greenCount + stats.redCount);
  const greenRatio = stats.greenCount / total;
  const bullishPercent = Math.round(greenRatio * 100);
  const bearishPercent = 100 - bullishPercent;

  // Trend from slope — used for strength/details, not signal direction.
  let trend: ChartInsights['trend'];
  if (stats.slope > 0.15) trend = 'up';
  else if (stats.slope < -0.15) trend = 'down';
  else trend = 'sideways';

  let volatility: ChartInsights['volatility'];
  if (stats.spreadVariance > 0.6) volatility = 'high';
  else if (stats.spreadVariance > 0.3) volatility = 'moderate';
  else volatility = 'low';

  const momentumShift = stats.rightBias - stats.leftBias;
  let momentum: ChartInsights['momentum'];
  if (Math.abs(momentumShift) < 0.15) {
    momentum = 'stable';
  } else if (
    (momentumShift > 0 && stats.rightBias > 0) ||
    (momentumShift < 0 && stats.rightBias < 0)
  ) {
    momentum = 'strengthening';
  } else {
    momentum = 'weakening';
  }

  // Bias: bullish if more green candles, bearish if more red.
  // Neutral is deliberately rare — only when the candle mix is within ±1%
  // of 50/50 AND the slope is flat. Most charts pick a side.
  const nearEven = Math.abs(greenRatio - 0.5) < 0.01;
  const flatSlope = Math.abs(stats.slope) < 0.08;
  let bias: ChartInsights['bias'];
  if (nearEven && flatSlope) bias = 'neutral';
  else if (greenRatio > 0.5) bias = 'bullish';
  else if (greenRatio < 0.5) bias = 'bearish';
  else bias = stats.slope >= 0 ? 'bullish' : 'bearish';

  // ── Signal — bias-first ────────────────────────────────────────────
  // Bullish candles → BUY. Bearish candles → SELL. Neutral → WAIT (rare).
  let action: TradeSignal['action'];
  if (bias === 'bullish') action = 'BUY';
  else if (bias === 'bearish') action = 'SELL';
  else action = 'WAIT';

  // Strength uses slope + momentum as confirmations. A contradicting slope
  // drops the signal to weak (exhaustion / reversal language in the pool).
  const slopeAgrees =
    (action === 'BUY' && stats.slope > 0.05) ||
    (action === 'SELL' && stats.slope < -0.05);
  const slopeContradicts =
    (action === 'BUY' && stats.slope < -0.05) ||
    (action === 'SELL' && stats.slope > 0.05);
  const momentumSupports =
    (action === 'BUY' && stats.rightBias > 0.1 && momentum === 'strengthening') ||
    (action === 'SELL' && stats.rightBias < -0.1 && momentum === 'strengthening');

  let strength: TradeSignal['strength'];
  if (action === 'WAIT') strength = 'weak';
  else if (slopeContradicts) strength = 'weak';
  else if (slopeAgrees && momentumSupports) strength = 'strong';
  else strength = 'moderate';

  const biasLabel =
    bias === 'bullish' ? 'Bullish' : bias === 'bearish' ? 'Bearish' : 'Balanced';
  const trendLabel =
    trend === 'up' ? 'uptrend' : trend === 'down' ? 'downtrend' : 'sideways range';

  // ── Deterministic variation picker ─────────────────────────────────
  const seed = pickSeed(stats);
  const bucket = `${action}-${strength}` as Bucket;

  const headline = pickFrom(HEADLINES[bucket] || HEADLINES['WAIT-weak'], seed, 0);
  const rationaleTpl = pickFrom(RATIONALES[bucket] || RATIONALES['WAIT-weak'], seed, 1);
  const volNoteTpl = pickFrom(VOL_NOTES[volatility], seed, 2);
  const summaryTpl = pickFrom(SUMMARIES, seed, 3);

  const vars = {
    bullishPercent,
    bearishPercent,
    biasLabel,
    trendLabel,
    momentum,
    volatility,
  };

  const rationale = `${interpolate(rationaleTpl, vars)} ${volNoteTpl}`;
  const summary = interpolate(summaryTpl, vars);

  // Confidence — bias-first floors higher for BUY/SELL, drops hard on
  // slope contradictions (that's the exhaustion case).
  let confidence = 55;
  confidence += Math.abs(stats.slope) * 25;
  const biasExtremity = Math.abs(bullishPercent - 50) / 50;
  confidence += biasExtremity * 30;
  if (slopeAgrees) confidence += 8;
  if (slopeContradicts) confidence -= 20;
  if (momentumSupports) confidence += 6;
  if (action === 'WAIT') confidence = Math.min(confidence, 40);
  confidence = Math.max(10, Math.min(96, Math.round(confidence)));

  const signal: TradeSignal = { action, strength, headline, rationale };

  const structureLabel =
    trend === 'up' ? 'Uptrend' : trend === 'down' ? 'Downtrend' : 'Sideways range';

  const bullets = [
    `Candle mix: ${bullishPercent}% bullish, ${bearishPercent}% bearish`,
    `Structure: ${structureLabel}`,
    `Volatility: ${volatility}`,
    `Momentum: ${momentum}`,
  ];

  return {
    bias,
    trend,
    volatility,
    momentum,
    bullishPercent,
    bearishPercent,
    trendSlope: stats.slope,
    volatilityScore: stats.spreadVariance,
    momentumShift,
    confidence,
    levels: Array.isArray(stats.levels) ? stats.levels.slice(0, 3) : [],
    signal,
    summary,
    bullets,
  };
}

/**
 * Analyzer core as a JS source string — runs inside a browser-like context
 * (HTMLCanvas ImageData or a hidden WebView).
 *
 * Exposes `analyzePixels(imageData, width, height)` → RawStats.
 */
export const ANALYZER_CORE = `function analyzePixels(imageData, width, height) {
  var data = imageData.data;
  var greenCount = 0, redCount = 0;
  var colSums = new Array(width);
  var colCounts = new Array(width);
  var colMinY = new Array(width);
  var colMaxY = new Array(width);
  for (var x = 0; x < width; x++) {
    colSums[x] = 0; colCounts[x] = 0; colMinY[x] = height; colMaxY[x] = 0;
  }
  var leftGreen = 0, leftRed = 0, rightGreen = 0, rightRed = 0;
  var half = Math.floor(width / 2);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var i = (y * width + x) * 4;
      var r = data[i], g = data[i+1], b = data[i+2];
      var maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
      var minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
      if (maxC < 30) continue;
      if (minC > 220) continue;
      var isGreen = g > r + 18 && g > b + 10;
      var isRed = r > g + 18 && r > b + 10;
      if (!isGreen && !isRed) continue;
      if (isGreen) {
        greenCount++;
        if (x < half) leftGreen++; else rightGreen++;
      } else {
        redCount++;
        if (x < half) leftRed++; else rightRed++;
      }
      colSums[x] += y;
      colCounts[x] += 1;
      if (y < colMinY[x]) colMinY[x] = y;
      if (y > colMaxY[x]) colMaxY[x] = y;
    }
  }
  var n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  var spreads = [];
  for (var x = 0; x < width; x++) {
    if (colCounts[x] > 0) {
      var cy = colSums[x] / colCounts[x];
      n++;
      sx += x; sy += cy; sxx += x * x; sxy += x * cy;
      spreads.push(colMaxY[x] - colMinY[x]);
    }
  }
  var slope = 0;
  if (n > 2) {
    var denom = n * sxx - sx * sx;
    if (denom !== 0) {
      var m = (n * sxy - sx * sy) / denom;
      slope = -m * (width / height);
      if (slope > 1) slope = 1;
      if (slope < -1) slope = -1;
    }
  }
  var meanSpread = 0;
  for (var k = 0; k < spreads.length; k++) meanSpread += spreads[k];
  meanSpread = spreads.length ? meanSpread / spreads.length : 0;
  var variance = 0;
  for (var k = 0; k < spreads.length; k++) {
    var d = spreads[k] - meanSpread;
    variance += d * d;
  }
  variance = spreads.length ? variance / spreads.length : 0;
  var spreadVariance = Math.min(1, Math.sqrt(variance) / (height * 0.25 || 1));
  var leftTotal = Math.max(1, leftGreen + leftRed);
  var rightTotal = Math.max(1, rightGreen + rightRed);
  var leftBias = (leftGreen - leftRed) / leftTotal;
  var rightBias = (rightGreen - rightRed) / rightTotal;
  var histBins = 16;
  var hist = new Array(histBins);
  for (var h = 0; h < histBins; h++) hist[h] = 0;
  for (var x = 0; x < width; x++) {
    if (colCounts[x] > 0) {
      var cy = colSums[x] / colCounts[x];
      var bin = Math.floor((cy / height) * histBins);
      if (bin < 0) bin = 0;
      if (bin >= histBins) bin = histBins - 1;
      hist[bin] += 1;
    }
  }
  var binIdx = [];
  for (var j = 0; j < histBins; j++) binIdx.push({ i: j, c: hist[j] });
  binIdx.sort(function(a, b) { return b.c - a.c; });
  var levels = [];
  var used = [];
  for (var k = 0; k < binIdx.length && levels.length < 3; k++) {
    if (binIdx[k].c <= 0) break;
    var candidate = (binIdx[k].i + 0.5) / histBins;
    var tooClose = false;
    for (var u = 0; u < used.length; u++) {
      if (Math.abs(used[u] - candidate) < 0.08) { tooClose = true; break; }
    }
    if (tooClose) continue;
    used.push(candidate);
    levels.push(candidate);
  }
  return {
    greenCount: greenCount,
    redCount: redCount,
    totalSampled: greenCount + redCount,
    slope: slope,
    spreadVariance: spreadVariance,
    leftBias: leftBias,
    rightBias: rightBias,
    levels: levels
  };
}`;

/**
 * Web-only analyzer — uses an offscreen HTMLCanvas to read pixels directly.
 * On React Native, use the hidden-WebView path (see buildAnalyzerHtml below).
 */
export async function analyzeOnWeb(uri: string): Promise<ChartInsights> {
  if (typeof window === 'undefined' || typeof (window as any).document === 'undefined') {
    throw new Error('analyzeOnWeb can only run in a browser context');
  }
  const w: any = window;
  const img: HTMLImageElement = new w.Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not load image for analysis.'));
    img.src = uri;
  });

  const maxDim = 600;
  const longest = Math.max(img.width || 1, img.height || 1);
  const scale = Math.min(1, maxDim / longest);
  const width = Math.max(1, Math.floor((img.width || 1) * scale));
  const height = Math.max(1, Math.floor((img.height || 1) * scale));

  const canvas: HTMLCanvasElement = w.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  // eslint-disable-next-line no-new-func
  const runner = new Function(
    'imageData',
    'width',
    'height',
    `${ANALYZER_CORE}\nreturn analyzePixels(imageData, width, height);`
  ) as (d: ImageData, w: number, h: number) => RawStats;

  const stats = runner(imageData, width, height);
  return buildInsights(stats);
}

/**
 * Self-contained HTML page that loads the given data URI into a canvas,
 * runs the analyzer, and posts the RawStats back via ReactNativeWebView.
 */
export function buildAnalyzerHtml(dataUri: string): string {
  const safeUri = JSON.stringify(dataUri);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>html,body{margin:0;padding:0;background:#000;}</style>
</head>
<body>
<script>
${ANALYZER_CORE}
(function() {
  function post(obj) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    } catch (e) {}
  }
  try {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      try {
        var maxDim = 500;
        var longest = Math.max(img.width || 1, img.height || 1);
        var scale = Math.min(1, maxDim / longest);
        var w = Math.max(1, Math.floor((img.width || 1) * scale));
        var h = Math.max(1, Math.floor((img.height || 1) * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var imageData = ctx.getImageData(0, 0, w, h);
        var stats = analyzePixels(imageData, w, h);
        post(stats);
      } catch (err) {
        post({ __error: 'analyze_failed', detail: String(err && err.message || err) });
      }
    };
    img.onerror = function() {
      post({ __error: 'image_load_failed' });
    };
    img.src = ${safeUri};
  } catch (err) {
    post({ __error: 'bootstrap_failed', detail: String(err && err.message || err) });
  }
})();
</script>
</body>
</html>`;
}
