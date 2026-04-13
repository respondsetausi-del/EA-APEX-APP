/**
 * Client-side chart "diagnostics" — no AI involved.
 *
 * Looks at candlestick colors and shape on a chart screenshot and produces a
 * descriptive readout (bias, trend, volatility, momentum). Intentionally
 * framed as *diagnostics*, not predictions.
 */

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
};

/**
 * Pure function — turns raw pixel stats into human-friendly insights.
 * No DOM / no Image / no Canvas — runs on any JS runtime.
 */
export function buildInsights(stats: RawStats): ChartInsights {
  const total = Math.max(1, stats.greenCount + stats.redCount);
  const bullishPercent = Math.round((stats.greenCount / total) * 100);
  const bearishPercent = 100 - bullishPercent;

  let bias: ChartInsights['bias'];
  if (bullishPercent >= 58) bias = 'bullish';
  else if (bullishPercent <= 42) bias = 'bearish';
  else bias = 'neutral';

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

  const biasLabel =
    bias === 'bullish' ? 'Bullish' : bias === 'bearish' ? 'Bearish' : 'Balanced';
  const trendLabel =
    trend === 'up' ? 'Uptrend' : trend === 'down' ? 'Downtrend' : 'Sideways range';

  const summary =
    `${biasLabel} candle majority (${bullishPercent}% green / ${bearishPercent}% red) on a ` +
    `${trendLabel.toLowerCase()} with ${volatility} volatility. Recent momentum is ${momentum}.`;

  const bullets = [
    `Candle mix: ${bullishPercent}% bullish, ${bearishPercent}% bearish`,
    `Structure: ${trendLabel}`,
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
  return {
    greenCount: greenCount,
    redCount: redCount,
    totalSampled: greenCount + redCount,
    slope: slope,
    spreadVariance: spreadVariance,
    leftBias: leftBias,
    rightBias: rightBias
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
