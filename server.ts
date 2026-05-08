// Simple Bun server to serve static web export and handle API routes
// - Serves files from ./dist
// - Login & license auth proxy to ea-converter.com (Android backend) to avoid DB connection issues
// TODO Fix #15: This file is ~1700 lines. Refactor into modules:
//   - server/static.ts (serveStatic)
//   - server/proxy-mt5.ts (handleMT5Proxy + auth script)
//   - server/proxy-mt4.ts (handleMT4Proxy + auth script)
//   - server/api.ts (handleApi + all /api/* routes)

import path from 'path';
import { proxyCheckEmail, proxyAuthLicense, proxySignals } from './services/ea-converter-proxy';
import { getPool as getSharedPool, shutdownPool } from './app/api/_db';
import crypto from 'crypto';
// Declare Bun global for TypeScript linting in non-Bun tooling contexts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const Bun: any;

// --- Proxy session store (Fix #2: credentials no longer in GET query strings) ---
interface ProxySession {
  params: Record<string, string>;
  createdAt: number;
}
const proxySessions = new Map<string, ProxySession>();
const SESSION_TTL_MS = 60_000; // sessions expire after 60s

function createProxySession(params: Record<string, string>): string {
  const token = crypto.randomBytes(24).toString('hex');
  proxySessions.set(token, { params, createdAt: Date.now() });
  return token;
}

function consumeProxySession(token: string): Record<string, string> | null {
  const session = proxySessions.get(token);
  if (!session) return null;
  proxySessions.delete(token); // single-use
  if (Date.now() - session.createdAt > SESSION_TTL_MS) return null;
  return session.params;
}

// Cleanup expired sessions every 30s
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of proxySessions) {
    if (now - session.createdAt > SESSION_TTL_MS) proxySessions.delete(token);
  }
}, 30_000);

const DIST_DIR = path.join(process.cwd(), 'dist');

// Fix #3: Sanitize values before injecting into HTML <script> blocks
// Escapes characters that could break out of JS string literals or close script tags
function sanitizeForJS(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/<\//g, '<\\/'); // prevent </script> injection
}
const PORT = Number(process.env.PORT || 3000);

// Fix #7: Single shared pool — imported from app/api/_db.ts (no duplicate)

// Graceful shutdown
async function shutdownServer() {
  console.log('🔄 Shutting down server...');
  try {
    await shutdownPool();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdownServer);
process.on('SIGINT', shutdownServer);

async function serveStatic(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    let filePath = url.pathname;

    // Prevent path traversal
    if (filePath.includes('..')) {
      return new Response('Not Found', { status: 404 });
    }

    // Default to index.html
    if (filePath === '/' || filePath === '') {
      filePath = '/index.html';
    }

    const absolutePath = path.join(DIST_DIR, filePath);
    const file = Bun.file(absolutePath);
    if (await file.exists()) {
      // Set proper MIME type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';

      switch (ext) {
        case '.html':
          contentType = 'text/html; charset=utf-8';
          break;
        case '.css':
          contentType = 'text/css; charset=utf-8';
          break;
        case '.js':
          contentType = 'application/javascript; charset=utf-8';
          break;
        case '.json':
          contentType = 'application/json; charset=utf-8';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
        case '.ico':
          contentType = 'image/x-icon';
          break;
        case '.woff':
          contentType = 'font/woff';
          break;
        case '.woff2':
          contentType = 'font/woff2';
          break;
        case '.ttf':
          contentType = 'font/ttf';
          break;
        case '.eot':
          contentType = 'application/vnd.ms-fontobject';
          break;
      }

      return new Response(file, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000',
        },
      });
    }

    // SPA fallback
    const indexFile = Bun.file(path.join(DIST_DIR, 'index.html'));
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('Static serve error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Helper function to extract base URL from terminal URL
// --- Broker proxy: forward terminal API / asset requests to the real broker ---
const ALLOWED_BROKER_HOSTS = [
  'webtrader.razormarkets.co.za',
  'webtrader.rcgmarkets.com',
  'webtrader.trade245.com',
  'metatraderweb.app',
  'trade.mql5.com',
];

async function handleBrokerProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('target');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing target parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ALLOWED_BROKER_HOSTS.some(h => target.hostname === h || target.hostname.endsWith('.' + h))) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const fwdHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
    };
    const ct = request.headers.get('Content-Type');
    if (ct) fwdHeaders['Content-Type'] = ct;
    const accept = request.headers.get('Accept');
    if (accept) fwdHeaders['Accept'] = accept;

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: fwdHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    });

    const responseHeaders = new Headers();
    const respCt = resp.headers.get('Content-Type');
    if (respCt) responseHeaders.set('Content-Type', respCt);
    const respCl = resp.headers.get('Content-Length');
    if (respCl) responseHeaders.set('Content-Length', respCl);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
    responseHeaders.set('Cache-Control', 'no-cache');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    return new Response(resp.body, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('Broker proxy error:', e);
    return new Response(JSON.stringify({ error: 'Broker proxy failed: ' + e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function getBaseUrlFromTerminalUrl(terminalUrl: string): string {
  try {
    const url = new URL(terminalUrl);
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    // Default to RazorMarkets if URL parsing fails
    return 'https://webtrader.razormarkets.co.za';
  }
}

// Tracks the broker base URL of the most recently served MT5 terminal HTML.
// The asset-proxy handler at /terminal/* uses this to forward .js / .css /
// .ws-init requests to the right broker (referer-based detection breaks on
// localhost where the iframe's origin is our own proxy host, not the
// broker). Updated every time handleMT5Proxy serves a fresh terminal page.
let lastMt5BrokerBaseUrl: string | null = null;

async function handleMT5Proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Fix #2: Resolve params from session token (credentials never in URL)
  const sessionToken = url.searchParams.get('session');
  const sessionParams = sessionToken ? consumeProxySession(sessionToken) : null;
  const p = (key: string) => sessionParams?.[key] ?? url.searchParams.get(key) ?? '';

  const targetUrl = p('url') || null;
  // Fix #3: Sanitize all values before injecting into script templates
  const login = sanitizeForJS(p('login'));
  const password = sanitizeForJS(p('password'));
  const server = sanitizeForJS(p('server'));
  const asset = sanitizeForJS(p('asset'));
  const action = sanitizeForJS(p('action'));
  const price = sanitizeForJS(p('price'));
  const tp = sanitizeForJS(p('tp'));
  const sl = sanitizeForJS(p('sl'));
  const volume = sanitizeForJS(p('volume'));
  const numberOfTrades = sanitizeForJS(p('numberOfTrades'));
  const botname = sanitizeForJS(p('botname'));

  // Check if this is a trading request (has trading parameters)
  // Note: tp and sl can be 0 or empty string, so we check for asset, action, and volume
  const isTradingRequest = asset && action && volume && numberOfTrades;

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Extract base URL for WebSocket and asset proxying
  const baseUrl = getBaseUrlFromTerminalUrl(targetUrl);

  // Remember which broker we just served so the /terminal/* asset proxy
  // forwards subsequent JS/CSS requests to the same host instead of
  // defaulting to RazorMarkets (which doesn't have other brokers' bundles).
  lastMt5BrokerBaseUrl = baseUrl;

  // Construct WebSocket URL - different brokers may have different paths
  let wsUrl = `${baseUrl.replace('http://', 'wss://').replace('https://', 'wss://')}/terminal/ws`;
  
  console.log('MT5 Proxy - Target URL:', targetUrl);
  console.log('MT5 Proxy - Base URL:', baseUrl);
  console.log('MT5 Proxy - WebSocket URL:', wsUrl);
  console.log('MT5 Proxy - Is Trading Request:', isTradingRequest);
  console.log('MT5 Proxy - Trading Params:', { asset, action, volume, numberOfTrades, tp, sl });

  try {
    // Fetch the target terminal page. Some brokers (e.g. RCG Markets) ship
    // an incomplete TLS chain that Bun's strict verifier rejects with
    // "unable to verify the first certificate". Skipping verification is
    // safe here because the target host is constrained to ALLOWED_BROKER_HOSTS.
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      tls: { rejectUnauthorized: false },
    } as any);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    let html = await response.text();

    // Create the authentication script based on your Android code
    const authScript = `
          <script>
            (function() {
              // IMMEDIATE: notify parent that proxy script is running
              try {
                window.parent.postMessage(JSON.stringify({
                  type: 'step_update',
                  message: 'Proxy script loaded — waiting for terminal...'
                }), '*');
              } catch(e) {}

              // Global error capture — so we know if something explodes
              window.addEventListener('error', function(e) {
                try {
                  window.parent.postMessage(JSON.stringify({
                    type: 'step_update',
                    message: 'JS error: ' + (e.message || 'unknown')
                  }), '*');
                } catch(_) {}
              });
              window.addEventListener('unhandledrejection', function(e) {
                try {
                  window.parent.postMessage(JSON.stringify({
                    type: 'step_update',
                    message: 'Promise rejected: ' + (e.reason && e.reason.message || e.reason || 'unknown')
                  }), '*');
                } catch(_) {}
              });

              // Spoof a desktop browser environment inside the iframe.
              // MT5 web's app JS reads navigator.userAgent / platform /
              // touch capability and falls into a mobile layout when the
              // user is on a phone — which strips the One-Click BUY/SELL
              // toolbar and breaks the fast-trade path. Forcing a desktop
              // identity keeps the desktop UI on every device.
              try {
                const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                Object.defineProperty(navigator, 'userAgent', { get: function() { return DESKTOP_UA; }, configurable: true });
                Object.defineProperty(navigator, 'platform', { get: function() { return 'Win32'; }, configurable: true });
                Object.defineProperty(navigator, 'maxTouchPoints', { get: function() { return 0; }, configurable: true });
                Object.defineProperty(navigator, 'vendor', { get: function() { return 'Google Inc.'; }, configurable: true });
              } catch(_) {}

              // Override console methods to suppress warnings
              const originalWarn = console.warn;
              const originalError = console.error;
              const originalLog = console.log;
              
              function shouldSuppress(message) {
                return message.includes('interactive-widget') || 
                       message.includes('viewport') ||
                       message.includes('Viewport argument key') ||
                       message.includes('AES-CBC') ||
                       message.includes('AES-CTR') ||
                       message.includes('AES-GCM') ||
                       message.includes('chosen-ciphertext') ||
                       message.includes('authentication by default') ||
                       message.includes('not recognized and ignored');
              }
              
              console.warn = function(...args) {
                const message = args.join(' ');
                if (shouldSuppress(message)) return;
                originalWarn.apply(console, args);
              };
              
              console.error = function(...args) {
                const message = args.join(' ');
                if (shouldSuppress(message)) return;
                originalError.apply(console, args);
              };
              
              console.log = function(...args) {
                const message = args.join(' ');
                if (shouldSuppress(message)) return;
                originalLog.apply(console, args);
              };

              // Message sending function
              const sendMessage = (type, message) => {
                try {
                  window.parent.postMessage(JSON.stringify({ type, message }), '*');
                } catch(e) {
                  console.log('Message send error:', e);
                }
              };

              // Override WebSocket to redirect to original terminal
              const originalWebSocket = window.WebSocket;
              window.WebSocket = function(url, protocols) {
                console.log('WebSocket connection attempt to:', url);
                
                // Redirect WebSocket connections to the original terminal (broker-specific)
                if (url.includes('/terminal') || url.includes('ea-converter-app')) {
                  const newUrl = '${wsUrl}';
                  console.log('Redirecting WebSocket from', url, 'to:', newUrl);
                  
                  try {
                    const ws = new originalWebSocket(newUrl, protocols);
                    
                    // Add event listeners for debugging
                    ws.addEventListener('open', function() {
                      console.log('WebSocket connection established successfully to:', newUrl);
                    });
                    
                    ws.addEventListener('error', function(error) {
                      console.log('WebSocket error for URL:', newUrl, 'Error:', error);
                      console.log('This is expected - terminal will work without WebSocket for authentication');
                    });
                    
                    ws.addEventListener('close', function(event) {
                      console.log('WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
                    });
                    
                    return ws;
                  } catch (error) {
                    console.log('WebSocket creation error:', error, '- Continuing without WebSocket');
                    // Return a mock WebSocket that doesn't fail
                    return new originalWebSocket(url, protocols);
                  }
                }
                
                return new originalWebSocket(url, protocols);
              };
              
              // Copy static properties
              Object.setPrototypeOf(window.WebSocket, originalWebSocket);
              Object.defineProperty(window.WebSocket, 'prototype', {
                value: originalWebSocket.prototype,
                writable: false
              });

              // Optimized authentication function with strict symbol search validation
              const authenticateMT5 = async () => {
                try {
                  sendMessage('step_update', 'Initializing MT5 Account...');
                  await new Promise(r => setTimeout(r, 2000));
                  
                  // Check for disclaimer and accept if present
                  const disclaimer = document.querySelector('#disclaimer');
                  if (disclaimer) {
                    const acceptButton = document.querySelector('.accept-button');
                    if (acceptButton) {
                      acceptButton.click();
                      sendMessage('step_update', 'Accepting disclaimer...');
                      await new Promise(r => setTimeout(r, 1500));
                    }
                  }
                  
                  // Check if form is visible and remove any existing connections
                  const form = document.querySelector('.form');
                  if (form && !form.classList.contains('hidden')) {
                    // Press remove button first
                    const removeButton = document.querySelector('.button.svelte-1wrky82.red');
                    if (removeButton) {
                      removeButton.click();
                      sendMessage('step_update', 'Removing existing connection...');
                      await new Promise(r => setTimeout(r, 2000));
                    } else {
                      // Fallback: look for Remove button by text
                      const buttons = document.getElementsByTagName('button');
                      for (let i = 0; i < buttons.length; i++) {
                        if (buttons[i].textContent.trim() === 'Remove') {
                          buttons[i].click();
                          sendMessage('step_update', 'Removing existing connection...');
                          await new Promise(r => setTimeout(r, 2000));
                          break;
                        }
                      }
                    }
                  }
                  
                  // Fill login credentials
                  const loginField = document.querySelector('input[name="login"]');
                  const passwordField = document.querySelector('input[name="password"]');
                  
                  if (loginField && '${login}') {
                    loginField.value = '${login}';
                    loginField.dispatchEvent(new Event('input', { bubbles: true }));
                    sendMessage('step_update', 'Entering login credentials...');
                    await new Promise(r => setTimeout(r, 500));
                  }
                  
                  if (passwordField && '${password}') {
                    passwordField.value = '${password}';
                    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
                    sendMessage('step_update', 'Entering password...');
                    await new Promise(r => setTimeout(r, 500));
                  }
                  
                  // Click login button
                  const loginButton = document.querySelector('.button.svelte-1wrky82.active');
                  if (loginButton) {
                    loginButton.click();
                    sendMessage('step_update', 'Connecting to Server...');
                  }

                  // Poll for full terminal readiness instead of a fixed 14s wait.
                  // Brokers commonly take 20–40s from login to fully-drawn terminal.
                  // We require TWO overlapping ready signals (order button + any data
                  // signal, or search field + any data signal) so we don't fire into
                  // a half-rendered UI. Falls back to a hard 60s cap — beyond that we
                  // surface an error instead of trying to trade blind.
                  sendMessage('step_update', 'Loading terminal interface...');
                  const TERM_READY_TIMEOUT_MS = 60000;
                  const TERM_POLL_MS = 500;
                  let termReady = null;
                  const termStart = Date.now();
                  while (Date.now() - termStart < TERM_READY_TIMEOUT_MS) {
                    await new Promise(r => setTimeout(r, TERM_POLL_MS));
                    const sf = document.querySelector('input[placeholder="Search symbol"]');
                    const ob = Array.from(document.querySelectorAll('button')).find(btn =>
                      (btn.textContent || '').toLowerCase().includes('create') &&
                      (btn.textContent || '').toLowerCase().includes('order')
                    );
                    const bal = document.body.innerText.includes('Balance:') ||
                                document.body.innerText.includes('Equity:') ||
                                document.body.innerText.includes('Free margin:');
                    const syms = document.querySelectorAll('[class*="symbol"]').length > 0 ||
                                 document.querySelectorAll('td').length > 5;
                    const ready = (!!sf && !!ob) || (!!sf && (bal || syms)) || (!!ob && (bal || syms));
                    if (ready) {
                      termReady = { sf: !!sf, ob: !!ob, bal: bal, syms: syms };
                      break;
                    }
                    const elapsed = Math.round((Date.now() - termStart) / 1000);
                    if (elapsed % 5 === 0) {
                      sendMessage('step_update', 'Loading terminal... (' + elapsed + 's)');
                    }
                  }

                  console.log('MT5 Terminal readiness check:', termReady);

                  if (termReady) {
                    console.log('MT5 Authentication successful - terminal is fully ready');
                    sendMessage('authentication_success', 'Logged in (search=' + termReady.sf + ', order=' + termReady.ob + ', balance=' + termReady.bal + ', symbols=' + termReady.syms + ')');

                    // Small settle so the final DOM state is consistent before
                    // the first trade runs.
                    await new Promise(r => setTimeout(r, 800));

                    // If this is a trading request, proceed with trading immediately
                    ${isTradingRequest ? `
                    executeTrading();
                    ` : ''}

                    // Register listener for on-demand trades from the parent frame.
                    // After the initial trade (if any) completes, the parent can
                    // send new trade commands without re-loading / re-logging in.
                    window.__mt5SessionReady = true;
                    window.addEventListener('message', function(event) {
                      try {
                        var cmd = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                        if (cmd && cmd.type === 'execute_trade') {
                          console.log('[MT5 KeepAlive] Received trade command:', cmd);
                          sendMessage('step', 'Received trade command for ' + cmd.asset + '...');
                          // Dynamically build a trade runner from the command payload
                          (async function runOnDemandTrade() {
                            try {
                              var _asset = cmd.asset || '${asset}';
                              var _action = cmd.action || '${action}';
                              var _volume = cmd.volume || '${volume}';
                              var _sl = cmd.sl || '';
                              var _tp = cmd.tp || '';
                              var _count = parseInt(cmd.count) || 1;
                              var _botname = cmd.botname || '${botname}';

                              // Poll for an element every 60ms up to maxMs, then return whatever
                              // the selector produces (element or null). Replaces the conservative
                              // fixed setTimeout waits so we move on the instant the DOM is ready.
                              function waitFor(selectorFn, maxMs) {
                                return new Promise(function(resolve) {
                                  var start = Date.now();
                                  var hit = selectorFn();
                                  if (hit) { resolve(hit); return; }
                                  var iv = setInterval(function() {
                                    var el = selectorFn();
                                    if (el || Date.now() - start >= maxMs) {
                                      clearInterval(iv);
                                      resolve(el || null);
                                    }
                                  }, 60);
                                });
                              }

                              sendMessage('step', 'Executing ' + _count + ' ' + _action + ' trade(s) on ' + _asset + '...');
                              for (var ti = 0; ti < _count; ti++) {
                                var tnum = ti + 1;

                                // Only search + select the symbol on the first trade of a batch.
                                // After that it stays the active chart, so subsequent iterations
                                // can jump straight to opening a fresh order dialog — saves ~3s
                                // per trade from the second one onward.
                                if (ti === 0) {
                                  sendMessage('step', 'Trade ' + tnum + ' of ' + _count + ': searching ' + _asset + '...');

                                  // Search symbol
                                  var sf = document.querySelector('input[placeholder="Search symbol"]') ||
                                           document.querySelector('input[placeholder*="Search"]');
                                  if (sf) {
                                    sf.focus(); sf.select(); sf.value = ''; sf.value = _asset;
                                    sf.dispatchEvent(new Event('input', { bubbles: true }));
                                    sf.dispatchEvent(new Event('change', { bubbles: true }));
                                    sf.dispatchEvent(new Event('keyup', { bubbles: true }));
                                  }
                                  await waitFor(function(){ return document.querySelector('.symbol.svelte-19bwscl'); }, 1500);

                                  // Select symbol
                                  var found = false;
                                  var candidates = document.querySelectorAll('.name.svelte-19bwscl .symbol.svelte-19bwscl, .symbol.svelte-19bwscl, [class*="symbol"]');
                                  for (var ci = 0; ci < candidates.length; ci++) {
                                    var txt = (candidates[ci].innerText || '').trim();
                                    if (txt === _asset || txt.includes(_asset)) { candidates[ci].click(); found = true; break; }
                                  }
                                  if (!found) {
                                    var all = document.querySelectorAll('*');
                                    for (var ai = 0; ai < all.length; ai++) {
                                      if ((all[ai].textContent||'').trim() === _asset) {
                                        var cl = all[ai].closest('button, [role="button"], td, tr');
                                        if (cl) { cl.click(); found = true; break; }
                                      }
                                    }
                                  }
                                  await waitFor(function(){ return document.querySelector('.icon-button.withText span.button-text'); }, 1500);
                                }

                                sendMessage('step', 'Trade ' + tnum + ': opening order dialog...');
                                // Open order dialog
                                var orderBtn = document.querySelector('.icon-button.withText span.button-text');
                                if (orderBtn) { orderBtn.click(); }
                                else {
                                  var btns = document.querySelectorAll('button');
                                  for (var bi = 0; bi < btns.length; bi++) {
                                    var bt = (btns[bi].textContent||'').toLowerCase();
                                    if (bt.includes('create') && bt.includes('order')) { btns[bi].click(); break; }
                                  }
                                }
                                await waitFor(function(){ return document.querySelector('.trade-input input[type="text"]'); }, 1500);

                                // Set volume
                                sendMessage('step', 'Trade ' + tnum + ': setting params (Vol:' + _volume + ')...');
                                var volField = document.querySelector('.trade-input input[type="text"]') || document.querySelector('input[type="text"]');
                                if (volField) {
                                  volField.focus(); volField.select(); volField.value = ''; volField.value = _volume;
                                  volField.dispatchEvent(new Event('input', { bubbles: true }));
                                  volField.dispatchEvent(new Event('change', { bubbles: true }));
                                  volField.dispatchEvent(new Event('blur', { bubbles: true }));
                                }

                                // Set SL
                                if (_sl && _sl !== '0' && _sl !== '') {
                                  var slField = document.querySelector('.sl input[type="text"]');
                                  if (slField) { slField.focus(); slField.value = ''; slField.value = _sl; slField.dispatchEvent(new Event('input',{bubbles:true})); slField.dispatchEvent(new Event('change',{bubbles:true})); }
                                }
                                // Set TP
                                if (_tp && _tp !== '0' && _tp !== '') {
                                  var tpField = document.querySelector('.tp input[type="text"]');
                                  if (tpField) { tpField.focus(); tpField.value = ''; tpField.value = _tp; tpField.dispatchEvent(new Event('input',{bubbles:true})); tpField.dispatchEvent(new Event('change',{bubbles:true})); }
                                }
                                // Set comment
                                var cmtField = document.querySelector('.input.svelte-mtorg2 input[type="text"]') || document.querySelector('.input.svelte-1d8k9kk input[type="text"]');
                                if (cmtField) { cmtField.focus(); cmtField.value = ''; cmtField.value = _botname; cmtField.dispatchEvent(new Event('input',{bubbles:true})); cmtField.dispatchEvent(new Event('change',{bubbles:true})); }
                                // Brief settle so the terminal registers the value changes.
                                await new Promise(function(r){ setTimeout(r, 200); });

                                // Execute order
                                sendMessage('step', 'Trade ' + tnum + ': placing ' + _action + ' order...');
                                var exBtn = null;
                                if (_action === 'BUY') { exBtn = document.querySelector('.footer-row button.trade-button:not(.red)'); }
                                else { exBtn = document.querySelector('.footer-row button.trade-button.red'); }
                                if (!exBtn) {
                                  var allBtns = document.querySelectorAll('button');
                                  for (var xi = 0; xi < allBtns.length; xi++) {
                                    var btext = allBtns[xi].textContent.toLowerCase();
                                    if (_action === 'BUY' && btext.includes('buy') && btext.includes('market')) { exBtn = allBtns[xi]; break; }
                                    if (_action === 'SELL' && btext.includes('sell') && btext.includes('market')) { exBtn = allBtns[xi]; break; }
                                  }
                                }
                                if (exBtn) { exBtn.click(); }
                                // Wait for the confirmation dialog instead of a flat 2s sleep.
                                await waitFor(function(){
                                  var b = document.querySelector('.trade-button.svelte-16cwwe0');
                                  if (b) return b;
                                  var cbs = document.querySelectorAll('button');
                                  for (var i = 0; i < cbs.length; i++) {
                                    var t = (cbs[i].textContent||'').toLowerCase();
                                    if (t.includes('ok') || t.includes('confirm')) return cbs[i];
                                  }
                                  return null;
                                }, 2000);

                                // Confirm
                                var cfmBtn = document.querySelector('.trade-button.svelte-16cwwe0');
                                if (!cfmBtn) {
                                  var cBtns = document.querySelectorAll('button');
                                  for (var cbi = 0; cbi < cBtns.length; cbi++) {
                                    var cbt = (cBtns[cbi].textContent||'').toLowerCase();
                                    if (cbt.includes('ok') || cbt.includes('confirm')) { cfmBtn = cBtns[cbi]; break; }
                                  }
                                }
                                if (cfmBtn) { cfmBtn.click(); }
                                sendMessage('step', 'Trade ' + tnum + ' of ' + _count + ' placed!');
                                // Brief settle so the terminal accepts the order before the next round.
                                await new Promise(function(r){ setTimeout(r, 500); });

                                // Close dialogs (keep ONLY for the final trade — leaving them open
                                // between trades lets iteration 2+ re-open the order dialog faster).
                                if (ti === _count - 1) {
                                  var closeBtns = document.querySelectorAll('button');
                                  for (var di = 0; di < closeBtns.length; di++) {
                                    var dbt = (closeBtns[di].textContent||'').toLowerCase();
                                    if (dbt.includes('close') || dbt === 'x') { closeBtns[di].click(); break; }
                                  }
                                  await new Promise(function(r){ setTimeout(r, 300); });
                                }
                              }
                              sendMessage('trade_executed', 'All ' + _count + ' ' + _action + ' trade(s) on ' + _asset + ' completed');
                            } catch(err) {
                              sendMessage('error', 'On-demand trade failed: ' + err.message);
                            }
                          })();
                        }
                      } catch(e) { /* ignore non-trade messages */ }
                    });
                    sendMessage('step_update', 'Session ready — waiting for trades...');
                    return;
                  }
                  
                  // If we reach here, authentication validation failed
                  sendMessage('authentication_failed', 'Authentication failed - Terminal did not load properly');
                  
                } catch(e) {
                  sendMessage('authentication_failed', 'Error during authentication: ' + e.message);
                }
                };
               
                 // Trading execution function with STRICT trade count control
                 const executeTrading = async () => {
                   try {
                     const numberOfTrades = parseInt('${numberOfTrades}') || 1;
                     let completedTrades = 0;
                     let failedTrades = 0;
                     
                     // Log all trading parameters for verification
                     console.log('=== MT5 TRADING PARAMETERS ===');
                     console.log('Asset: ${asset}');
                     console.log('Action: ${action}');
                     console.log('Volume: ${volume}');
                     console.log('Stop Loss: ${sl}');
                     console.log('Take Profit: ${tp}');
                     console.log('Number of Trades: ${numberOfTrades}');
                     console.log('Bot Name: ${botname}');
                     console.log('==============================');
                     
                     // STRICT VALIDATION: Ensure numberOfTrades is valid
                     if (numberOfTrades < 1 || numberOfTrades > 100) {
                       sendMessage('error', 'Invalid number of trades: ' + numberOfTrades + '. Must be between 1 and 100.');
                       return;
                     }
                     
                     // Wait for terminal trading UI to be fully ready before executing
                     sendMessage('step', 'Waiting for terminal trading UI...');
                     var maxWait = 15000;
                     var pollMs = 1000;
                     var elapsed = 0;
                     while (elapsed < maxWait) {
                       var hasSearch = !!document.querySelector('input[placeholder="Search symbol"]') ||
                                       !!document.querySelector('input[placeholder*="Search"]');
                       var hasButtons = document.querySelectorAll('button').length > 3;
                       if (hasSearch && hasButtons) {
                         console.log('MT5 Trading: Terminal UI ready after', elapsed, 'ms');
                         sendMessage('step', 'Terminal ready — starting trades...');
                         break;
                       }
                       await new Promise(r => setTimeout(r, pollMs));
                       elapsed += pollMs;
                       sendMessage('step', 'Waiting for terminal UI... (' + (elapsed / 1000) + 's)');
                     }
                     if (elapsed >= maxWait) {
                       console.log('MT5 Trading: Terminal UI wait timed out — proceeding anyway');
                       sendMessage('step', 'Terminal wait timed out — attempting trades...');
                     }

                     sendMessage('step', 'Starting execution of ' + numberOfTrades + ' ${action} trade(s) for ${asset}...');
                     console.log('MT5 Trading: STRICT MODE - Target: EXACTLY', numberOfTrades, 'trades');

                     // ──────────────────────────────────────────────────────
                     // ONE-TIME SETUP — search/select symbol, then activate
                     // the chart's one-click toolbar. Do this ONCE before
                     // the trade loop, not on every iteration. Massive win.
                     // ──────────────────────────────────────────────────────
                     const setupSymbol = async () => {
                       sendMessage('step', 'Locating ${asset}...');

                       // Try direct click first — symbol might already be in
                       // the Market Watch list. If yes, skip the search.
                       const tryDirectSelect = () => {
                         const razorAsset = document.querySelector('.name.svelte-19bwscl .symbol.svelte-19bwscl');
                         if (razorAsset && razorAsset.textContent.includes('${asset}')) {
                           razorAsset.click();
                           console.log('MT5 Trading: Direct-selected ${asset} (already in market watch)');
                           return true;
                         }
                         const allSymbols = document.querySelectorAll('[class*="symbol"]');
                         for (let i = 0; i < allSymbols.length; i++) {
                           const txt = allSymbols[i].textContent.trim();
                           if (txt === '${asset}' || txt === '${asset}.mic') {
                             allSymbols[i].click();
                             console.log('MT5 Trading: Direct-selected ${asset} via generic selector');
                             return true;
                           }
                         }
                         return false;
                       };

                       if (tryDirectSelect()) {
                         await new Promise(r => setTimeout(r, 400));
                         return true;
                       }

                       // Fallback: search box then select.
                       const searchField = document.querySelector('input[placeholder="Search symbol"]') ||
                                           document.querySelector('input[placeholder*="Search"]') ||
                                           document.querySelector('input[placeholder*="search"]');
                       if (searchField) {
                         searchField.focus();
                         searchField.select();
                         searchField.value = '';
                         searchField.value = '${asset}';
                         searchField.dispatchEvent(new Event('input', { bubbles: true }));
                         searchField.dispatchEvent(new Event('change', { bubbles: true }));
                         searchField.dispatchEvent(new Event('keyup', { bubbles: true }));
                         console.log('MT5 Trading: Searched for ${asset}');
                         await new Promise(r => setTimeout(r, 800));
                       }

                       if (tryDirectSelect()) {
                         await new Promise(r => setTimeout(r, 400));
                         return true;
                       }

                       // Last resort: any element matching the symbol text.
                       const allElements = document.querySelectorAll('*');
                       for (let i = 0; i < allElements.length; i++) {
                         const text = allElements[i].textContent.trim();
                         if (text === '${asset}' || text === '${asset}.mic') {
                           const clickable = allElements[i].closest('button, [role="button"], [onclick], td, tr');
                           if (clickable || allElements[i].tagName === 'BUTTON') {
                             (clickable || allElements[i]).click();
                             console.log('MT5 Trading: Selected ${asset} via text-based selector');
                             await new Promise(r => setTimeout(r, 400));
                             return true;
                           }
                         }
                       }

                       sendMessage('step', '⚠ Could not find ${asset} in symbol list');
                       console.log('MT5 Trading: WARNING - Could not select ${asset}');
                       return false;
                     };

                     // The one-click BUY/SELL bar can be collapsed/hidden.
                     // The MT5 web terminal exposes a toggle in the top
                     // toolbar (title/aria-label like "One Click Trading"
                     // or "Show One-Click Trading"). If the BUY/SELL bar
                     // isn't visible, click the toggle to reveal it.
                     const ensureOneClickBarVisible = () => {
                       const candidates = document.querySelectorAll('button, [role="button"], a, [class*="icon"]');
                       for (let i = 0; i < candidates.length; i++) {
                         const el = candidates[i];
                         const title = (el.getAttribute('title') || '').toLowerCase();
                         const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                         const dataTip = (el.getAttribute('data-tooltip') || el.getAttribute('data-title') || '').toLowerCase();
                         const meta = title + ' ' + aria + ' ' + dataTip;
                         if (!meta.trim()) continue;
                         // Match "one click", "one-click", "1-click", "one click trading"
                         if (meta.indexOf('one click') < 0 && meta.indexOf('one-click') < 0 && meta.indexOf('1-click') < 0 && meta.indexOf('one click trading') < 0) continue;
                         const rect = el.getBoundingClientRect();
                         if (rect.width === 0 || rect.height === 0) continue;
                         if (rect.top > 200) continue; // only top toolbar
                         el.click();
                         console.log('MT5 Trading: Toggled One-Click Trading toolbar via:', meta.trim());
                         return true;
                       }
                       return false;
                     };

                     // Find the chart's one-click BUY/SELL toolbar button.
                     // The MT5 web terminal's one-click bar renders SELL/BUY
                     // labels alongside their bid/ask prices. Layouts vary
                     // (sometimes "SELL 4587.817", sometimes "4587.817 SELL",
                     // sometimes nested spans without spaces). Match BUY/SELL
                     // as a whole word anywhere in the label, then filter by
                     // viewport position to lock onto the chart toolbar.
                     const findOneClickButton = () => {
                       const target = '${action}'; // 'BUY' or 'SELL'
                       const opposite = target === 'BUY' ? 'SELL' : 'BUY';
                       const candidates = [];
                       const els = document.querySelectorAll('button, [role="button"], a, div, span');
                       const wordRe = new RegExp('(^|[^A-Z])' + target + '($|[^A-Z])', 'i');
                       for (let i = 0; i < els.length; i++) {
                         const el = els[i];
                         const raw = (el.textContent || '').trim();
                         if (!raw) continue;
                         const txt = raw.toUpperCase();
                         if (txt.length > 60) continue;
                         if (!wordRe.test(txt)) continue;
                         // Skip elements that mention BOTH (likely a parent wrapping both sides)
                         if (txt.indexOf(opposite) >= 0) continue;
                         const rect = el.getBoundingClientRect();
                         if (rect.width < 30 || rect.height < 16) continue;
                         if (rect.top > 300) continue;
                         candidates.push({ el, top: rect.top, txt });
                       }
                       if (candidates.length === 0) {
                         console.log('MT5 Trading: One-click ' + target + ' button not found (no candidates)');
                         return null;
                       }
                       // Topmost wins — chart toolbar sits above any duplicates.
                       candidates.sort((a, b) => a.top - b.top);
                       console.log('MT5 Trading: One-click ' + target + ' candidates:', candidates.map(c => c.txt).slice(0, 3).join(' | '));
                       return candidates[0].el;
                     };

                     // Set the volume on the chart-toolbar one-click bar.
                     const setOneClickVolume = (vol) => {
                       const els = document.querySelectorAll('input, [contenteditable="true"]');
                       for (let i = 0; i < els.length; i++) {
                         const el = els[i];
                         const rect = el.getBoundingClientRect();
                         if (rect.top > 300 || rect.width === 0) continue;
                         const v = (el.value !== undefined ? el.value : (el.textContent || '')).trim();
                         const ctx = ((el.className || '') + ' ' + (el.getAttribute && el.getAttribute('placeholder') || '') + ' ' + ((el.closest && el.closest('[class]')||{}).className || '')).toLowerCase();
                         const looksLikeLot = /^[0-9]+(\\.[0-9]+)?$/.test(v) && parseFloat(v) <= 1000;
                         const hasLotContext = ctx.indexOf('volume') >= 0 || ctx.indexOf('lot') >= 0;
                         if (looksLikeLot || hasLotContext) {
                           try {
                             if (el.tagName === 'INPUT') {
                               el.focus();
                               el.value = '';
                               el.value = vol;
                               el.dispatchEvent(new Event('input', { bubbles: true }));
                               el.dispatchEvent(new Event('change', { bubbles: true }));
                               el.dispatchEvent(new Event('blur', { bubbles: true }));
                             } else {
                               el.textContent = vol;
                             }
                             console.log('MT5 Trading: One-click volume set to ' + vol);
                             return true;
                           } catch (e) {}
                         }
                       }
                       return false;
                     };

                     // Accept the "One Click Trading - Disclaimer" modal that
                     // MT5 web shows the first time a toolbar BUY/SELL is
                     // clicked. Subsequent clicks then fire orders directly.
                     // Returns true if a disclaimer was visible & dismissed.
                     const acceptOneClickDisclaimer = () => {
                       // Detect the disclaimer by its title text.
                       let disclaimerRoot = null;
                       const allElements = document.querySelectorAll('*');
                       for (let i = 0; i < allElements.length; i++) {
                         const txt = (allElements[i].textContent || '');
                         if (txt.length > 4000) continue;
                         const lower = txt.toLowerCase();
                         if (lower.indexOf('one click trading') >= 0 && lower.indexOf('disclaimer') >= 0) {
                           disclaimerRoot = allElements[i];
                           break;
                         }
                       }
                       if (!disclaimerRoot) return false;

                       // Tick the "I Accept these Terms and Conditions" box.
                       const checkboxes = disclaimerRoot.querySelectorAll('input[type="checkbox"]');
                       for (let i = 0; i < checkboxes.length; i++) {
                         const cb = checkboxes[i];
                         if (!cb.checked) {
                           cb.click();
                           console.log('MT5 Trading: Ticked one-click disclaimer checkbox');
                         }
                       }
                       return true;
                     };

                     // Click the OK / Continue / Accept button on the disclaimer.
                     const confirmOneClickDisclaimer = () => {
                       const buttons = document.querySelectorAll('button');
                       for (let i = 0; i < buttons.length; i++) {
                         const btn = buttons[i];
                         const t = (btn.textContent || '').trim().toLowerCase();
                         if (t === 'ok' || t === 'accept' || t === 'continue' || t === 'agree' ||
                             t.indexOf('accept') >= 0 || t.indexOf('continue') >= 0) {
                           // Skip disabled buttons (checkbox not yet ticked)
                           if (btn.disabled) continue;
                           const rect = btn.getBoundingClientRect();
                           if (rect.width === 0 || rect.height === 0) continue;
                           btn.click();
                           console.log('MT5 Trading: Confirmed one-click disclaimer (' + t + ')');
                           return true;
                         }
                       }
                       return false;
                     };

                     await setupSymbol();
                     // If the One-Click Trading bar is collapsed, expand it
                     // now so volume + BUY/SELL clicks have something to land
                     // on. No-op if it's already open.
                     if (!findOneClickButton()) {
                       if (ensureOneClickBarVisible()) {
                         await new Promise(r => setTimeout(r, 400));
                       }
                     }
                     setOneClickVolume('${volume}');
                     await new Promise(r => setTimeout(r, 300));

                     // Disclaimer is handled inside the trade loop (the first
                     // iteration's click triggers it if MT5 hasn't seen consent
                     // yet; if consent is stored, the click places an order
                     // directly). No probe — that double-fires when consent is
                     // already given.

                     // Function to execute a single trade with enhanced tracking
                     const executeSingleTrade = async (tradeIndex) => {
                       try {
                         console.log('MT5 Trading: Starting trade', (tradeIndex + 1), 'of', numberOfTrades);
                         sendMessage('step', 'Executing trade ' + (tradeIndex + 1) + ' of ' + numberOfTrades + ' for ${asset}...');

                         // ── FAST PATH: chart-toolbar one-click ──
                         // Retry briefly — after a fired order MT5 redraws
                         // the toolbar for a frame or two and the button can
                         // disappear / be 0-size momentarily. If still not
                         // visible after retries, click the toolbar toggle
                         // to expand the One-Click Trading bar, then retry.
                         let oneClickBtn = findOneClickButton();
                         if (!oneClickBtn) {
                           for (let r = 0; r < 4 && !oneClickBtn; r++) {
                             await new Promise(res => setTimeout(res, 100));
                             oneClickBtn = findOneClickButton();
                           }
                         }
                         if (!oneClickBtn) {
                           if (ensureOneClickBarVisible()) {
                             // Give the bar a moment to render, then look again.
                             for (let r = 0; r < 6 && !oneClickBtn; r++) {
                               await new Promise(res => setTimeout(res, 150));
                               oneClickBtn = findOneClickButton();
                             }
                           }
                         }
                         if (oneClickBtn) {
                           oneClickBtn.click();
                           console.log('MT5 Trading: One-click ${action} fired for trade', (tradeIndex + 1));
                           await new Promise(r => setTimeout(r, 200));

                           // Safety: if the disclaimer popped (e.g. session
                           // changed, broker reset terms), accept and re-fire.
                           if (acceptOneClickDisclaimer()) {
                             await new Promise(r => setTimeout(r, 250));
                             confirmOneClickDisclaimer();
                             await new Promise(r => setTimeout(r, 500));
                             const retry = findOneClickButton();
                             if (retry) {
                               retry.click();
                               console.log('MT5 Trading: Re-fired ${action} after disclaimer');
                               await new Promise(r => setTimeout(r, 200));
                             }
                           }

                           sendMessage('step', 'Trade ' + (tradeIndex + 1) + ' of ' + numberOfTrades + ' fired');
                           return true;
                         }

                         // ── FALLBACK: full dialog flow (legacy code below) ──
                         console.log('MT5 Trading: One-click toolbar not found, falling back to dialog');

                        // Open order dialog - Universal approach
                        let dialogOpened = false;

                        // Try RazorMarkets selector
                        const razorOrderBtn = document.querySelector('.icon-button.withText span.button-text');
                        if (razorOrderBtn) {
                          razorOrderBtn.click();
                          dialogOpened = true;
                          console.log('MT5 Trading: Opened order dialog using RazorMarkets selector');
                        }

                        // Try text-based search (generic and others)
                        if (!dialogOpened) {
                          const allButtons = document.querySelectorAll('button');
                          for (let i = 0; i < allButtons.length; i++) {
                            const btnText = allButtons[i].textContent.toLowerCase();
                            if (btnText.includes('create') && btnText.includes('order')) {
                              allButtons[i].click();
                              dialogOpened = true;
                              console.log('MT5 Trading: Opened order dialog using text-based selector');
                              break;
                            }
                          }
                        }

                        if (dialogOpened) {
                          sendMessage('step', 'Order dialog opened — setting params...');
                          await new Promise(r => setTimeout(r, 1500));
                        } else {
                          sendMessage('step', '⚠ Could not open order dialog — button not found');
                          console.log('MT5 Trading: WARNING - Could not open order dialog');
                        }

                        // Universal field setting function with multiple selector attempts
                        const setFieldValue = (selectors, value, fieldName) => {
                          // Try each selector in order
                          for (let selector of selectors) {
                            const field = document.querySelector(selector);
                            if (field) {
                              field.focus();
                              field.select();
                              field.value = '';
                              field.value = value;
                              field.dispatchEvent(new Event('input', { bubbles: true }));
                              field.dispatchEvent(new Event('change', { bubbles: true }));
                              field.dispatchEvent(new Event('keyup', { bubbles: true }));
                              field.dispatchEvent(new Event('blur', { bubbles: true }));
                              console.log('MT5 Trading: Set ' + fieldName + ' to: ' + value + ' using selector: ' + selector);
                              return true;
                            }
                          }
                          console.log('MT5 Trading: Field not found for ' + fieldName + ', tried selectors:', selectors);
                          return false;
                        };
                        
                        // Set volume (lot size from trade config) - Try multiple selectors
                        console.log('MT5 Trading: Setting Volume to ${volume}');
                        const volumeSet = setFieldValue([
                          '.trade-input input[type="text"]',  // RazorMarkets
                          'input[type="text"]',                // Generic first input
                          'input[inputmode="decimal"]'         // Numeric input
                        ], '${volume}', 'Volume');
                        await new Promise(r => setTimeout(r, 500));
                        
                        // Set stop loss - Only if value is provided and not 0
                        if ('${sl}' && '${sl}' !== '0' && '${sl}' !== '') {
                          console.log('MT5 Trading: Setting Stop Loss to ${sl}');
                          const slSet = setFieldValue([
                            '.sl input[type="text"]',           // RazorMarkets
                            'input[placeholder*="Stop"]',       // By placeholder
                            'input[placeholder*="stop"]',
                            'input[placeholder*="S/L"]'
                          ], '${sl}', 'Stop Loss');
                          await new Promise(r => setTimeout(r, 500));
                        } else {
                          console.log('MT5 Trading: Skipping Stop Loss (value is 0 or empty)');
                        }
                        
                        // Set take profit - Only if value is provided and not 0
                        if ('${tp}' && '${tp}' !== '0' && '${tp}' !== '') {
                          console.log('MT5 Trading: Setting Take Profit to ${tp}');
                          const tpSet = setFieldValue([
                            '.tp input[type="text"]',           // RazorMarkets
                            'input[placeholder*="Take"]',       // By placeholder
                            'input[placeholder*="take"]',
                            'input[placeholder*="T/P"]'
                          ], '${tp}', 'Take Profit');
                          await new Promise(r => setTimeout(r, 500));
                        } else {
                          console.log('MT5 Trading: Skipping Take Profit (value is 0 or empty)');
                        }
                        
                        // Set comment with bot name - Try multiple selectors
                        console.log('MT5 Trading: Setting Comment to ${botname}');
                        const commentSet = setFieldValue([
                          '.input.svelte-mtorg2 input[type="text"]',  // RazorMarkets
                          '.input.svelte-1d8k9kk input[type="text"]',
                          'input[placeholder*="Comment"]',             // By placeholder
                          'input[placeholder*="comment"]'
                        ], '${botname}', 'Comment');
                        await new Promise(r => setTimeout(r, 500));
                         
                        sendMessage('step', 'Parameters set for trade ' + (tradeIndex + 1) + ', executing ${action} order...');
                        await new Promise(r => setTimeout(r, 800));
                        
                        // Execute the order - Universal approach
                        let executeButton = null;
                        
                        // Try RazorMarkets selectors first
                        if ('${action}' === 'BUY') {
                          executeButton = document.querySelector('.footer-row button.trade-button:not(.red)');
                        } else {
                          executeButton = document.querySelector('.footer-row button.trade-button.red');
                        }
                        
                        // Try text-based search (generic and others)
                        if (!executeButton) {
                          const allButtons = document.querySelectorAll('button');
                          for (let i = 0; i < allButtons.length; i++) {
                            const btnText = allButtons[i].textContent.toLowerCase();
                            if ('${action}' === 'BUY') {
                              if (btnText.includes('buy') && btnText.includes('market')) {
                                executeButton = allButtons[i];
                                console.log('MT5 Trading: Found BUY button using text search');
                                break;
                              }
                            } else {
                              if (btnText.includes('sell') && btnText.includes('market')) {
                                executeButton = allButtons[i];
                                console.log('MT5 Trading: Found SELL button using text search');
                                break;
                              }
                            }
                          }
                        }
                        
                        if (executeButton) {
                          console.log('MT5 Trading: Executing ${action} order for trade', (tradeIndex + 1));
                          executeButton.click();
                          sendMessage('step', '${action} button clicked — confirming...');
                          await new Promise(r => setTimeout(r, 2000));
                          
                          // Confirm the order - Universal approach
                          let confirmButton = document.querySelector('.trade-button.svelte-16cwwe0');
                          
                          // Try text-based search if RazorMarkets selector fails
                          if (!confirmButton) {
                            const allButtons = document.querySelectorAll('button');
                            for (let i = 0; i < allButtons.length; i++) {
                              const btnText = allButtons[i].textContent.toLowerCase();
                              if (btnText.includes('ok') || btnText.includes('confirm') || btnText.includes('yes')) {
                                confirmButton = allButtons[i];
                                console.log('MT5 Trading: Found confirm button using text search');
                                break;
                              }
                            }
                          }
                          
                          if (confirmButton) {
                            confirmButton.click();
                            sendMessage('step', 'Trade ' + (tradeIndex + 1) + ' of ' + numberOfTrades + ' completed successfully');
                            await new Promise(r => setTimeout(r, 2000));
                            console.log('MT5 Trading: Trade', (tradeIndex + 1), 'completed successfully');
                            
                            // Close any success dialogs
                            const closeButtons = document.querySelectorAll('button');
                            for (let i = 0; i < closeButtons.length; i++) {
                              const btnText = closeButtons[i].textContent.toLowerCase();
                              if (btnText.includes('close') || btnText === 'x') {
                                closeButtons[i].click();
                                console.log('MT5 Trading: Closed success dialog');
                                break;
                              }
                            }
                            
                            return true;
                          } else {
                            console.log('MT5 Trading: Confirm button not found for trade', (tradeIndex + 1));
                            return false;
                          }
                        } else {
                          sendMessage('step', '⚠ ${action} button not found — cannot place order');
                          console.log('MT5 Trading: ${action} button not found for trade', (tradeIndex + 1));
                          return false;
                        }
                         
                       } catch (error) {
                         console.log('MT5 Trading: Trade', (tradeIndex + 1), 'failed:', error.message);
                         sendMessage('error', 'Trade ' + (tradeIndex + 1) + ' failed: ' + error.message);
                         return false;
                       }
                     };
                     
                     // STRICT SEQUENTIAL EXECUTION - Execute trades one by one, no retries
                     console.log('MT5 Trading: STRICT SEQUENTIAL EXECUTION - Target: EXACTLY', numberOfTrades, 'trades');
                     
                     for (let tradeIndex = 0; tradeIndex < numberOfTrades; tradeIndex++) {
                       // CRITICAL SAFETY CHECK: Prevent over-execution
                       if (completedTrades >= numberOfTrades) {
                         console.log('MT5 Trading: SAFETY BREAK - Target already reached, stopping execution');
                         break;
                       }
                       
                       const currentTradeNumber = tradeIndex + 1;
                       console.log('MT5 Trading: EXECUTING TRADE', currentTradeNumber, 'of', numberOfTrades);
                       sendMessage('step', 'Executing trade ' + currentTradeNumber + ' of ' + numberOfTrades + ' for ${asset}...');
                       
                       const success = await executeSingleTrade(tradeIndex);
                       
                       if (success) {
                         completedTrades++;
                         console.log('MT5 Trading: SUCCESS - Trade', currentTradeNumber, 'completed! Progress:', completedTrades, 'of', numberOfTrades);
                         sendMessage('step', 'SUCCESS - Trade ' + currentTradeNumber + ' completed! Progress: ' + completedTrades + ' of ' + numberOfTrades);
                         
                         // CRITICAL: Check if we've reached the target
                         if (completedTrades >= numberOfTrades) {
                           console.log('MT5 Trading: TARGET REACHED - All', numberOfTrades, 'trades completed!');
                           sendMessage('step', 'TARGET REACHED - All ' + numberOfTrades + ' trades completed!');
                           break;
                         }
                         
                         // Tiny pause between trades — one-click toolbar
                         // refreshes prices in ~150ms and we don't want the
                         // next click landing before the price tick.
                         if (completedTrades < numberOfTrades) {
                           await new Promise(r => setTimeout(r, 200));
                         }
                       } else {
                         failedTrades++;
                         console.log('MT5 Trading: FAILED - Trade', currentTradeNumber, 'failed. Continuing to next trade...');
                         sendMessage('step', 'FAILED - Trade ' + currentTradeNumber + ' failed. Continuing to next trade...');
                         
                         // Wait before next trade even if this one failed
                         if (tradeIndex < numberOfTrades - 1) {
                           await new Promise(r => setTimeout(r, 2000));
                         }
                       }
                       
                       // Log current status after each trade
                       console.log('MT5 Trading: STATUS - Completed:', completedTrades, 'Target:', numberOfTrades, 'Current:', currentTradeNumber);
                     }
                     
                     // Final verification
                     console.log('MT5 Trading: EXECUTION COMPLETED - Final count:', completedTrades, 'trades completed out of', numberOfTrades, 'target');

                     // Final summary with detailed tracking
                     console.log('MT5 Trading: Final summary - Completed:', completedTrades, 'Failed:', failedTrades, 'Total:', numberOfTrades);

                     if (completedTrades === numberOfTrades) {
                       sendMessage('trade_executed', completedTrades + ' of ' + numberOfTrades + ' ${action} trade(s) placed for ${asset}');
                       sendMessage('close', 'All ' + numberOfTrades + ' trades executed successfully');
                     } else if (completedTrades > 0) {
                       sendMessage('trade_executed', 'Partial: ' + completedTrades + ' of ' + numberOfTrades + ' placed for ${asset}');
                       sendMessage('close', 'Partial completion');
                     } else {
                       sendMessage('error', 'Trade failed: could not place order. Terminal may not have loaded fully.');
                     }
                     
                   } catch (error) {
                     console.log('MT5 Trading: Overall execution failed:', error.message);
                     sendMessage('error', 'Trading execution failed: ' + error.message);
                   }
                 };

                // Start authentication — don't rely solely on 'load' event
                // (it may never fire if some sub-resources hang).
                var __authStarted = false;
                function __startAuth() {
                  if (__authStarted) return;
                  __authStarted = true;
                  setTimeout(authenticateMT5, 1500);
                }
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  __startAuth();
                } else {
                  document.addEventListener('DOMContentLoaded', __startAuth);
                  window.addEventListener('load', __startAuth);
                }
                // Absolute fallback: start after 8s no matter what
                setTimeout(__startAuth, 8000);
            })();
          </script>
        `;

    // Rewrite WebSocket URLs to point to the original terminal
    html = html.replace(/wss:\/\/ea-converter-app\.onrender\.com\/terminal\/ws/g, wsUrl);
    html = html.replace(/ws:\/\/ea-converter-app\.onrender\.com\/terminal\/ws/g, wsUrl);

    // Inject the script before the closing body tag
    if (html.includes('</body>')) {
      html = html.replace('</body>', authScript + '</body>');
    } else {
      html += authScript;
    }

    // Return the modified HTML
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('MT5 Proxy error:', error);
    return new Response(JSON.stringify({ error: `Proxy error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleMT4Proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Fix #2: Resolve params from session token (credentials never in URL)
  const sessionToken = url.searchParams.get('session');
  const sessionParams = sessionToken ? consumeProxySession(sessionToken) : null;
  const p = (key: string) => sessionParams?.[key] ?? url.searchParams.get(key) ?? '';

  const targetUrl = p('url') || null;
  // Fix #3: Sanitize all values before injecting into script templates
  const login = sanitizeForJS(p('login'));
  const password = sanitizeForJS(p('password'));
  const server = sanitizeForJS(p('server'));
  const asset = sanitizeForJS(p('asset'));
  const action = sanitizeForJS(p('action'));
  const price = sanitizeForJS(p('price'));
  const tp = sanitizeForJS(p('tp'));
  const sl = sanitizeForJS(p('sl'));
  const volume = sanitizeForJS(p('volume'));
  const numberOfTrades = sanitizeForJS(p('numberOfTrades'));
  const botname = sanitizeForJS(p('botname'));

  // Check if this is a trading request (has trading parameters)
  // Note: tp and sl can be 0 or empty string, so we check for asset, action, and volume
  const isTradingRequest = asset && action && volume && numberOfTrades;

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fix #9: Derive WebSocket URL dynamically from targetUrl (like MT5 proxy)
  const baseUrl = getBaseUrlFromTerminalUrl(targetUrl);
  const wsUrl = `${baseUrl.replace('http://', 'wss://').replace('https://', 'wss://')}/terminal/ws`;

  try {
    // Fetch the target terminal page. Some brokers (e.g. RCG Markets) ship
    // an incomplete TLS chain that Bun's strict verifier rejects with
    // "unable to verify the first certificate". Skipping verification is
    // safe here because the target host is constrained to ALLOWED_BROKER_HOSTS.
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      tls: { rejectUnauthorized: false },
    } as any);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    let html = await response.text();

    // Create the authentication script based on your Android code
    const authScript = `
          <script>
            (function() {
              // IMMEDIATE: notify parent that proxy script is running
              try {
                window.parent.postMessage(JSON.stringify({
                  type: 'step_update',
                  message: 'Proxy script loaded — waiting for terminal...'
                }), '*');
              } catch(e) {}

              // Global error capture — so we know if something explodes
              window.addEventListener('error', function(e) {
                try {
                  window.parent.postMessage(JSON.stringify({
                    type: 'step_update',
                    message: 'JS error: ' + (e.message || 'unknown')
                  }), '*');
                } catch(_) {}
              });
              window.addEventListener('unhandledrejection', function(e) {
                try {
                  window.parent.postMessage(JSON.stringify({
                    type: 'step_update',
                    message: 'Promise rejected: ' + (e.reason && e.reason.message || e.reason || 'unknown')
                  }), '*');
                } catch(_) {}
              });

              // Spoof a desktop browser environment inside the iframe.
              // MT5 web's app JS reads navigator.userAgent / platform /
              // touch capability and falls into a mobile layout when the
              // user is on a phone — which strips the One-Click BUY/SELL
              // toolbar and breaks the fast-trade path. Forcing a desktop
              // identity keeps the desktop UI on every device.
              try {
                const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                Object.defineProperty(navigator, 'userAgent', { get: function() { return DESKTOP_UA; }, configurable: true });
                Object.defineProperty(navigator, 'platform', { get: function() { return 'Win32'; }, configurable: true });
                Object.defineProperty(navigator, 'maxTouchPoints', { get: function() { return 0; }, configurable: true });
                Object.defineProperty(navigator, 'vendor', { get: function() { return 'Google Inc.'; }, configurable: true });
              } catch(_) {}

              // Override console methods to suppress warnings
              const originalWarn = console.warn;
              const originalError = console.error;
              const originalLog = console.log;
              
              function shouldSuppress(message) {
                return message.includes('interactive-widget') || 
                       message.includes('viewport') ||
                       message.includes('Viewport argument key') ||
                       message.includes('AES-CBC') ||
                       message.includes('AES-CTR') ||
                       message.includes('AES-GCM') ||
                       message.includes('chosen-ciphertext') ||
                       message.includes('authentication by default') ||
                       message.includes('not recognized and ignored');
              }
              
              console.warn = function(...args) {
                const message = args.join(' ');
                if (shouldSuppress(message)) return;
                originalWarn.apply(console, args);
              };
              
              console.error = function(...args) {
                const message = args.join(' ');
                if (shouldSuppress(message)) return;
                originalError.apply(console, args);
              };
              
              console.log = function(...args) {
                const message = args.join(' ');
                if (shouldSuppress(message)) return;
                originalLog.apply(console, args);
              };

              // Message sending function
              const sendMessage = (type, message) => {
                try {
                  window.parent.postMessage(JSON.stringify({ type, message }), '*');
                } catch(e) {
                  console.log('Message send error:', e);
                }
              };

              // Override WebSocket to redirect to original terminal
              const originalWebSocket = window.WebSocket;
              window.WebSocket = function(url, protocols) {
                console.log('WebSocket connection attempt to:', url);
                
                // Redirect WebSocket connections to the original terminal
                if (url.includes('/terminal/ws')) {
                  const newUrl = '${wsUrl}';
                  console.log('Redirecting WebSocket to:', newUrl);
                  return new originalWebSocket(newUrl, protocols);
                }
                
                return new originalWebSocket(url, protocols);
              };
              
              // Copy static properties
              Object.setPrototypeOf(window.WebSocket, originalWebSocket);
              Object.defineProperty(window.WebSocket, 'prototype', {
                value: originalWebSocket.prototype,
                writable: false
              });

              // Enhanced field input function from your Android code
              const typeInput = (el, value) => {
                try {
                  el.focus();
                  el.select();
                  el.value = '';
                  el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                  
                  setTimeout(function() {
                    el.focus();
                    el.value = String(value);
                    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                  }, 100);
                  
                  return true;
                } catch(e) { return false; }
              };

              // Authentication function based on your Android code
              const authenticateMT4 = async () => {
                try {
                  sendMessage('step_update', 'Starting MT4 authentication...');
                  await new Promise(r => setTimeout(r, 3000));
                  
                  // Fill login credentials using enhanced method from your Android code
                  const loginField = document.getElementById('login') || document.querySelector('input[name="login"]');
                  const passwordField = document.getElementById('password') || document.querySelector('input[type="password"]');
                  const serverField = document.getElementById('server') || document.querySelector('input[name="server"]');
                  
                  if (loginField && '${login}') {
                    typeInput(loginField, '${login}');
                    sendMessage('step_update', 'Filling MT4 credentials...');
                  }
                  
                  if (serverField && '${server}') {
                    typeInput(serverField, '${server}');
                  }
                  
                  if (passwordField && '${password}') {
                    typeInput(passwordField, '${password}');
                  }
                  
                  await new Promise(r => setTimeout(r, 500));
                  
                  // Submit login using MT4 specific button selector
                  const loginButton = document.querySelector('button.input-button:nth-child(4)');
                  if (loginButton) {
                    loginButton.removeAttribute('disabled');
                    loginButton.disabled = false;
                    loginButton.click();
                    sendMessage('step_update', 'Submitting MT4 login...');
                  } else {
                    sendMessage('authentication_failed', 'Login button not found');
                    return;
                  }
                  
                  await new Promise(r => setTimeout(r, 4000));
                  
                  // Show all symbols to verify authentication (copied from your Android code)
                  const marketWatchElement = document.querySelector('body > div.page-window.market-watch.compact > div > div.b > div.page-block > div > table > tbody > tr:nth-child(1)');
                  if (marketWatchElement) {
                    const ev1 = new MouseEvent("mousedown", {
                      bubbles: true,
                      cancelable: false,
                      view: window,
                      button: 2,
                      buttons: 2,
                      clientX: marketWatchElement.getBoundingClientRect().x,
                      clientY: marketWatchElement.getBoundingClientRect().y
                    });
                    marketWatchElement.dispatchEvent(ev1);
                    
                    const ev2 = new MouseEvent("mouseup", {
                      bubbles: true,
                      cancelable: false,
                      view: window,
                      button: 2,
                      buttons: 0,
                      clientX: marketWatchElement.getBoundingClientRect().x,
                      clientY: marketWatchElement.getBoundingClientRect().y
                    });
                    marketWatchElement.dispatchEvent(ev2);
                    
                    const ev3 = new MouseEvent("contextmenu", {
                      bubbles: true,
                      cancelable: false,
                      view: window,
                      button: 2,
                      buttons: 0,
                      clientX: marketWatchElement.getBoundingClientRect().x,
                      clientY: marketWatchElement.getBoundingClientRect().y
                    });
                    marketWatchElement.dispatchEvent(ev3);
                    
                    setTimeout(() => {
                      const showAllButton = document.querySelector('body > div.page-menu.context.expanded > div > div > span.box > span > div:nth-child(7)');
                      if (showAllButton) {
                        showAllButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                        showAllButton.click();
                        sendMessage('step_update', 'Verifying authentication - showing all symbols...');
                      }
                    }, 500);
                  }
                  
                  await new Promise(r => setTimeout(r, 5000));
                  
                  // Verify authentication by checking if symbols are visible
                  const tableB = document.querySelector('body > div.page-window.market-watch.compact > div > div.b > div.page-block > div > table > tbody');
                  if (tableB) {
                    const allTRs = tableB.querySelectorAll('tr');
                    if (allTRs.length > 0) {
                      // Try to find XAUUSD symbol
                      for (let i = 0; i < allTRs.length; i++) {
                        const a = allTRs[i].getElementsByTagName('td')[0];
                        if (a && a.textContent && a.textContent.trim() === 'XAUUSD') {
                          a.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                          sendMessage('authentication_success', 'MT4 Authentication Successful - XAUUSD symbol found and selected');
                          return;
                        }
                      }
                      // XAUUSD not found but symbols are visible - still successful
                      sendMessage('authentication_success', 'MT4 Authentication Successful - Symbol list accessible');
                      
                      // If this is a trading request, proceed with trading
                      ${isTradingRequest ? `
                      setTimeout(() => {
                        executeTrading();
                      }, 2000);
                      ` : ''}
                    } else {
                      sendMessage('authentication_failed', 'Authentication failed - No symbols visible in market watch');
                    }
                  } else {
                    sendMessage('authentication_failed', 'Authentication failed - Market watch not accessible');
                  }
                  
                } catch(e) {
                  sendMessage('authentication_failed', 'Error during authentication: ' + e.message);
                }
              };
              
               // Trading execution function for MT4 with STRICT trade count control
               const executeTrading = async () => {
                 try {
                   const numberOfTrades = parseInt('${numberOfTrades}') || 1;
                   let completedTrades = 0;
                   let failedTrades = 0;
                   
                   // STRICT VALIDATION: Ensure numberOfTrades is valid
                   if (numberOfTrades < 1 || numberOfTrades > 100) {
                     sendMessage('error', 'Invalid number of trades: ' + numberOfTrades + '. Must be between 1 and 100.');
                     return;
                   }
                   
                   sendMessage('step', 'Starting STRICT execution of EXACTLY ' + numberOfTrades + ' MT4 trade(s) for ${asset}...');
                   console.log('MT4 Trading: STRICT MODE - Target: EXACTLY', numberOfTrades, 'trades');
                   
                   // Function to execute a single MT4 trade with enhanced tracking
                   const executeSingleTrade = async (tradeIndex) => {
                     try {
                       console.log('MT4 Trading: Starting trade', (tradeIndex + 1), 'of', numberOfTrades);
                       sendMessage('step', 'Executing MT4 trade ' + (tradeIndex + 1) + ' of ' + numberOfTrades + ' for ${asset}...');
                       
                       // Search for the specific asset in Market Watch
                       const marketWatchTable = document.querySelector('body > div.page-window.market-watch.compact > div > div.b > div.page-block > div > table > tbody');
                       if (marketWatchTable) {
                         const allTRs = marketWatchTable.querySelectorAll('tr');
                         let assetFound = false;
                         
                         for (let i = 0; i < allTRs.length; i++) {
                           const a = allTRs[i].getElementsByTagName('td')[0];
                           if (a && a.textContent && a.textContent.trim() === '${asset}') {
                             // Double click to open order dialog
                             a.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                             assetFound = true;
                             sendMessage('step', 'Asset ${asset} selected for MT4 trade ' + (tradeIndex + 1) + '...');
                             break;
                           }
                         }
                         
                         if (!assetFound) {
                           console.log('MT4 Trading: Asset ${asset} not found for trade', (tradeIndex + 1));
                           sendMessage('error', 'Asset ${asset} not found in Market Watch for trade ' + (tradeIndex + 1));
                           return false;
                         }
                       }
                       
                       // Wait for order dialog to open
                       await new Promise(r => setTimeout(r, 1500));
                       
                       // Set trading parameters with enhanced validation
                       const setFieldValue = (selector, value, fieldName) => {
                         const field = document.querySelector(selector);
                         if (field) {
                           field.focus();
                           field.select();
                           field.value = value;
                           field.dispatchEvent(new Event('input', { bubbles: true }));
                           field.dispatchEvent(new Event('change', { bubbles: true }));
                           field.dispatchEvent(new Event('blur', { bubbles: true }));
                           console.log('MT4 Trading: Set ' + fieldName + ' to: ' + value);
                           return true;
                         }
                         console.log('MT4 Trading: Field not found: ' + selector);
                         return false;
                       };
                       
                       // Set volume (lot size from trade config)
                       const volumeSet = setFieldValue('#volume', '${volume}', 'Volume');
                       await new Promise(r => setTimeout(r, 500));
                       
                       // Set stop loss
                       const slSet = setFieldValue('#sl', '${sl}', 'Stop Loss');
                       await new Promise(r => setTimeout(r, 500));
                       
                       // Set take profit
                       const tpSet = setFieldValue('#tp', '${tp}', 'Take Profit');
                       await new Promise(r => setTimeout(r, 500));
                       
                       // Set comment with bot name only
                       const commentSet = setFieldValue('#comment', '${botname}', 'Comment');
                       
                       sendMessage('step', 'Parameters set for MT4 trade ' + (tradeIndex + 1) + ', executing ${action} order...');
                       await new Promise(r => setTimeout(r, 800));
                       
                       // Execute the order
                       const executeButton = '${action}' === 'BUY' ? 
                         document.querySelector('button.input-button.blue') :
                         document.querySelector('button.input-button.red');
                       
                       if (executeButton) {
                         executeButton.click();
                         sendMessage('step', 'MT4 trade ' + (tradeIndex + 1) + ' of ' + numberOfTrades + ' completed successfully');
                         await new Promise(r => setTimeout(r, 2000));
                         console.log('MT4 Trading: Trade', (tradeIndex + 1), 'completed successfully');
                         return true;
                       } else {
                         console.log('MT4 Trading: Execute button not found for trade', (tradeIndex + 1));
                         sendMessage('error', 'Execute button not found for MT4 trade ' + (tradeIndex + 1));
                         return false;
                       }
                       
                     } catch (error) {
                       console.log('MT4 Trading: Trade', (tradeIndex + 1), 'failed:', error.message);
                       sendMessage('error', 'MT4 trade ' + (tradeIndex + 1) + ' failed: ' + error.message);
                       return false;
                     }
                   };
                   
                   // STRICT SEQUENTIAL EXECUTION - Execute trades one by one, no retries
                   console.log('MT4 Trading: STRICT SEQUENTIAL EXECUTION - Target: EXACTLY', numberOfTrades, 'trades');
                   
                   for (let tradeIndex = 0; tradeIndex < numberOfTrades; tradeIndex++) {
                     // CRITICAL SAFETY CHECK: Prevent over-execution
                     if (completedTrades >= numberOfTrades) {
                       console.log('MT4 Trading: SAFETY BREAK - Target already reached, stopping execution');
                       break;
                     }
                     
                     const currentTradeNumber = tradeIndex + 1;
                     console.log('MT4 Trading: EXECUTING TRADE', currentTradeNumber, 'of', numberOfTrades);
                     sendMessage('step', 'Executing MT4 trade ' + currentTradeNumber + ' of ' + numberOfTrades + ' for ${asset}...');
                     
                     const success = await executeSingleTrade(tradeIndex);
                     
                     if (success) {
                       completedTrades++;
                       console.log('MT4 Trading: SUCCESS - Trade', currentTradeNumber, 'completed! Progress:', completedTrades, 'of', numberOfTrades);
                       sendMessage('step', 'SUCCESS - MT4 trade ' + currentTradeNumber + ' completed! Progress: ' + completedTrades + ' of ' + numberOfTrades);
                       
                       // CRITICAL: Check if we've reached the target
                       if (completedTrades >= numberOfTrades) {
                         console.log('MT4 Trading: TARGET REACHED - All', numberOfTrades, 'trades completed!');
                         sendMessage('step', 'TARGET REACHED - All ' + numberOfTrades + ' MT4 trades completed!');
                         break;
                       }
                       
                       // Wait between trades (only if we haven't reached the target)
                       if (completedTrades < numberOfTrades) {
                         sendMessage('step', 'Waiting before next MT4 trade... (' + completedTrades + '/' + numberOfTrades + ' completed)');
                         await new Promise(r => setTimeout(r, 2000));
                       }
                     } else {
                       failedTrades++;
                       console.log('MT4 Trading: FAILED - Trade', currentTradeNumber, 'failed. Continuing to next trade...');
                       sendMessage('step', 'FAILED - MT4 trade ' + currentTradeNumber + ' failed. Continuing to next trade...');
                       
                       // Wait before next trade even if this one failed
                       if (tradeIndex < numberOfTrades - 1) {
                         await new Promise(r => setTimeout(r, 2000));
                       }
                     }
                     
                     // Log current status after each trade
                     console.log('MT4 Trading: STATUS - Completed:', completedTrades, 'Target:', numberOfTrades, 'Current:', currentTradeNumber);
                   }
                   
                   // Final verification
                   console.log('MT4 Trading: EXECUTION COMPLETED - Final count:', completedTrades, 'trades completed out of', numberOfTrades, 'target');
                   
                   // Final summary with detailed tracking
                   console.log('MT4 Trading: Final summary - Completed:', completedTrades, 'Failed:', failedTrades, 'Total:', numberOfTrades);
                   sendMessage('trade_executed', 'All MT4 trades completed: ' + completedTrades + ' of ' + numberOfTrades + ' successful for ${asset}');
                   
                   // Close after completing all trades
                   if (completedTrades === numberOfTrades) {
                     sendMessage('close', 'All ' + numberOfTrades + ' MT4 trades executed successfully - closing window');
                   } else if (completedTrades > 0) {
                     sendMessage('close', 'Partial completion: ' + completedTrades + ' of ' + numberOfTrades + ' MT4 trades executed - closing window');
                   } else {
                     sendMessage('close', 'No MT4 trades executed successfully - closing window');
                   }
                   
                 } catch (error) {
                   console.log('MT4 Trading: Overall execution failed:', error.message);
                   sendMessage('error', 'MT4 trading execution failed: ' + error.message);
                 }
               };
              
              // Start authentication — don't rely solely on 'load' event
              var __authStarted = false;
              function __startAuth() {
                if (__authStarted) return;
                __authStarted = true;
                setTimeout(authenticateMT4, 3000);
              }
              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                __startAuth();
              } else {
                document.addEventListener('DOMContentLoaded', __startAuth);
                window.addEventListener('load', __startAuth);
              }
              setTimeout(__startAuth, 8000);
            })();
          </script>
        `;

    // Rewrite WebSocket URLs to point to the original terminal
    html = html.replace(/wss:\/\/ea-converter-app\.onrender\.com\/terminal\/ws/g, wsUrl);
    html = html.replace(/ws:\/\/ea-converter-app\.onrender\.com\/terminal\/ws/g, wsUrl);

    // Inject the script before the closing body tag
    if (html.includes('</body>')) {
      html = html.replace('</body>', authScript + '</body>');
    } else {
      html += authScript;
    }

    // Return the modified HTML
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('MT4 Proxy error:', error);
    return new Response(JSON.stringify({ error: `Proxy error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  try {
    // Fix #2: Session-based proxy — client POSTs credentials, gets a one-time token
    if (pathname === '/api/proxy-session') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      try {
        const body = await request.json().catch(() => ({}));
        if (!body || typeof body !== 'object' || !body.url) {
          return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
          });
        }
        const token = createProxySession(body as Record<string, string>);
        return new Response(JSON.stringify({ token }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to create session' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (pathname === '/api/check-email') {
      const route = await import('./app/api/check-email/route.ts');
      if (request.method === 'POST' && typeof route.POST === 'function') {
        return route.POST(request) as Promise<Response>;
      }
      if (request.method === 'GET' && typeof route.GET === 'function') {
        return route.GET() as Promise<Response>;
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (pathname === '/api/affiliate-track') {
      const route = await import('./app/api/affiliate-track/route.ts');
      if (request.method === 'POST' && typeof route.POST === 'function') {
        return route.POST(request) as Promise<Response>;
      }
      if (request.method === 'GET' && typeof route.GET === 'function') {
        return route.GET() as Promise<Response>;
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (pathname === '/api/auth-license') {
      if (request.method === 'GET') {
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({} as any));
          const licence = (body?.licence ?? body?.license ?? '').toString().trim();
          const phoneSecret = (body?.phone_secret as string | undefined)?.toString().trim();
          if (!licence) {
            return new Response(JSON.stringify({ message: 'error' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const result = await proxyAuthLicense(licence, phoneSecret);
          return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          console.error('❌ auth-license proxy error:', error);
          return new Response(JSON.stringify({ message: 'error' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Admin: reset device binding
    if (pathname === '/api/admin-reset-device') {
      const route = await import('./app/api/admin-reset-device/route.ts');
      if (request.method === 'POST' && typeof route.POST === 'function') {
        return route.POST(request) as Promise<Response>;
      }
      if (request.method === 'GET' && typeof route.GET === 'function') {
        return route.GET() as Promise<Response>;
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Add symbols routing
    if (pathname === '/api/symbols') {
      const route = await import('./app/api/symbols/route.ts');
      if (request.method === 'GET' && typeof route.GET === 'function') {
        return route.GET(request) as Promise<Response>;
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Add terminal-proxy routing
    if (pathname === '/api/terminal-proxy') {
      const route = await import('./services/terminal-proxy.ts');
      if (request.method === 'GET' && typeof route.default === 'function') {
        // Convert Bun Request to Express-like request/response
        const expressReq = {
          method: request.method,
          query: Object.fromEntries(new URL(request.url).searchParams),
          url: request.url
        } as any;

        const expressRes = {
          status: (code: number) => ({
            json: (data: any) => new Response(JSON.stringify(data), {
              status: code,
              headers: { 'Content-Type': 'application/json' }
            }),
            send: (data: string) => new Response(data, {
              status: code,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
          }),
          setHeader: (name: string, value: string) => { }
        } as any;

        return route.default(expressReq, expressRes);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Broker asset/API proxy — the MT5/MT4 terminal JS makes fetch/XHR calls
    // using relative URLs which resolve to OUR origin (not the broker).  This
    // endpoint forwards those requests to the real broker server so the
    // terminal actually initialises.
    if (pathname === '/api/broker-proxy') {
      return handleBrokerProxy(request);
    }

    // Add MT5 proxy routing
    if (pathname === '/api/mt5-proxy') {
      if (request.method === 'GET') {
        return handleMT5Proxy(request);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Add MT4 proxy routing
    if (pathname === '/api/mt4-proxy') {
      if (request.method === 'GET') {
        return handleMT4Proxy(request);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Database API endpoints
    // Get EA ID from license key
    if (pathname === '/api/get-ea-from-license') {
      if (request.method === 'GET') {
        const licenseKey = url.searchParams.get('licenseKey');
        if (!licenseKey) {
          return new Response(JSON.stringify({ error: 'License key required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        let conn = null;
        try {
          const pool = await getSharedPool();
          conn = await pool.getConnection();

          const [rows] = await conn.execute(
            'SELECT ea FROM licences WHERE k_ey = ? LIMIT 1',
            [licenseKey]
          );

          const result = rows as any[];
          return new Response(JSON.stringify({
            eaId: result.length > 0 ? result[0].ea : null
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('❌ Database error in get-ea-from-license:', error);
          return new Response(JSON.stringify({ error: 'Database error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        } finally {
          if (conn) {
            try {
              conn.release();
            } catch (releaseError) {
              console.error('❌ Failed to release connection:', releaseError);
            }
          }
        }
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Get new signals for this licence's EA.
    // Now proxies server-side to the PHP endpoint on ea-converter.com —
    // browser can't reach PHP directly (CORS), but server→server is fine.
    // EA-lock is enforced server-side: phone_secret → licences row → ea →
    // signals filtered to that ea only. Same lock the Android APK uses.
    if (pathname === '/api/get-new-signals') {
      if (request.method === 'GET') {
        const phoneSecret = url.searchParams.get('phone_secret');
        if (!phoneSecret) {
          return new Response(JSON.stringify({ error: 'phone_secret required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        try {
          const result = await proxySignals(phoneSecret);

          if (result.message !== 'accept') {
            return new Response(
              JSON.stringify({ error: 'Upstream PHP returned non-accept', signals: [] }),
              { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // PHP returns either a single signal object (newest active) or null.
          // Normalise to an array so the client polling code can iterate
          // uniformly even if we later switch to a batch-returning endpoint.
          const signals = result.data ? [result.data] : [];
          return new Response(JSON.stringify({ signals }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('❌ Error proxying signals:', error);
          return new Response(JSON.stringify({ error: 'Proxy error', signals: [] }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('API handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

function withCors(res: Response): Response {
  if (res.headers.has('Access-Control-Allow-Origin')) return res;
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health' || url.pathname === '/_health' || url.pathname === '/status') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle terminal assets (CSS, JS, etc.) - proxy to the original MT5 terminal
    if (url.pathname.startsWith('/terminal/')) {
      try {
        const assetPath = url.pathname.replace('/terminal/', '');

        // Pick the broker host: 1) the one we last served via handleMT5Proxy
        // (works across all configured brokers), 2) referer hostname (when
        // the iframe URL happens to include a recognisable broker host),
        // 3) RazorMarkets as a last-resort fallback.
        const referer = request.headers.get('referer') || '';
        let brokerBaseUrl = lastMt5BrokerBaseUrl
          || (referer.includes('rcgmarkets.com')   ? 'https://webtrader.rcgmarkets.com' :
              referer.includes('trade245.com')     ? 'https://webtrader.trade245.com'   :
              referer.includes('razormarkets.co.za') ? 'https://webtrader.razormarkets.co.za' :
              'https://webtrader.razormarkets.co.za');

        const targetUrl = `${brokerBaseUrl}/terminal/${assetPath}`;

        // Retry on Bun's intermittent ConnectionRefused that fires when the
        // iframe bursts ~30 parallel asset requests through the proxy.
        const fetchWithRetry = async (attempt = 0): Promise<Response> => {
          try {
            return await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
              // Same TLS-laxness as the main MT5 proxy — broker hosts are
              // allowlisted, and some (RCG) ship incomplete chains.
              tls: { rejectUnauthorized: false },
            } as any);
          } catch (err: any) {
            if (attempt < 3 && (err?.code === 'ConnectionRefused' || /ConnectionRefused|ECONNRESET|fetch failed/i.test(String(err?.message || err)))) {
              await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
              return fetchWithRetry(attempt + 1);
            }
            throw err;
          }
        };
        const response = await fetchWithRetry();

        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          const content = await response.arrayBuffer();

          return new Response(content, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      } catch (error) {
        console.error('Terminal asset proxy error:', error);
      }

      return new Response('Asset not found', { status: 404 });
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request);
    }

    // Static files
    return serveStatic(request);
}

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0', // Required for Render/Docker - listen on all interfaces
  async fetch(request: Request) {
    return withCors(await handleRequest(request));
  },
});

console.log(`Server running on http://localhost:${server.port}`);


