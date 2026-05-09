// Symbols proxy: forwards to EA APEX `admin/api/symbols/`
// (the same endpoint Android's RoboTraderAPI.getSymbols hits).
//
// This used to query MySQL directly via getPool() with a hand-written
// SELECT on licences.phone_secret_code / symbols.ea — but that schema
// didn't match what the PHP admin actually writes, so it silently
// returned zero symbols. Proxying through the PHP endpoint keeps the
// web build in lock-step with Android without any schema drift.

import { proxySymbols } from '@/services/ea-converter-proxy';

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const phoneSecret = (url.searchParams.get('phone_secret') || '').toString().trim();

    if (!phoneSecret) {
      return Response.json({ message: 'error' }, { status: 200 });
    }

    const result = await proxySymbols(phoneSecret);
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('❌ symbols proxy error:', error);
    return Response.json({ message: 'error' }, { status: 200 });
  }
}

export async function POST(): Promise<Response> {
  return Response.json({ message: 'error' }, { status: 405 });
}
