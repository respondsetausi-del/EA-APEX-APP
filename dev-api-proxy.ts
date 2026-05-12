/**
 * Lightweight dev API proxy — runs alongside Metro to handle /api/* routes.
 * Production uses server.ts; this is only for local `expo start --web` dev.
 *
 * Usage: bun dev-api-proxy.ts
 * Then set EXPO_PUBLIC_API_BASE_URL=http://localhost:3001 in .env
 */

const PORT = 3001;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Bun.serve({
  port: PORT,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (url.pathname === '/api/check-email') {
        const route = await import('./app/api/check-email/route.ts');
        let res: Response;
        if (request.method === 'POST' && typeof route.POST === 'function') {
          res = await route.POST(request);
        } else if (request.method === 'GET' && typeof route.GET === 'function') {
          res = await route.GET();
        } else {
          res = new Response('Method Not Allowed', { status: 405 });
        }
        // Add CORS headers
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      }

      if (url.pathname === '/api/auth-license') {
        const route = await import('./app/api/auth-license/route.ts');
        let res: Response;
        if (request.method === 'POST' && typeof route.POST === 'function') {
          res = await route.POST(request);
        } else if (request.method === 'GET' && typeof route.GET === 'function') {
          res = await route.GET();
        } else {
          res = new Response('Method Not Allowed', { status: 405 });
        }
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      }

      if (url.pathname === '/api/symbols') {
        const route = await import('./app/api/symbols/route.ts');
        let res: Response;
        if (request.method === 'GET' && typeof route.GET === 'function') {
          // Forward query params by constructing a new Request with the full URL
          res = await route.GET(request);
        } else {
          res = new Response('Method Not Allowed', { status: 405 });
        }
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      }

      if (url.pathname === '/api/signals') {
        const route = await import('./app/api/signals/route.ts');
        let res: Response;
        if (request.method === 'GET' && typeof route.GET === 'function') {
          res = await route.GET(request);
        } else {
          res = new Response('Method Not Allowed', { status: 405 });
        }
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      }

      if (url.pathname === '/api/health') {
        return Response.json({ ok: true, mode: 'dev-proxy' }, { headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Dev proxy error:', error);
      return Response.json(
        { error: 'proxy error', message: String(error) },
        { status: 500, headers: corsHeaders }
      );
    }
  },
});

console.log(`✅ Dev API proxy running on http://localhost:${PORT}`);
console.log(`   Set EXPO_PUBLIC_API_BASE_URL=http://localhost:${PORT} in .env`);
