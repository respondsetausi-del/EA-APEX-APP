// Signals proxy: forwards to EA APEX `admin/api/signals/`
// (the same endpoint Android's RoboTraderAPI.getSignals hits).
//
// GET /api/signals?phone_secret=X  → latest active signal (or null)

import { proxySignals } from '@/services/ea-converter-proxy';

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const phoneSecret = (url.searchParams.get('phone_secret') || '').toString().trim();

    if (!phoneSecret) {
      return Response.json({ message: 'error' }, { status: 200 });
    }

    const result = await proxySignals(phoneSecret);
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('signals proxy error:', error);
    return Response.json({ message: 'error' }, { status: 200 });
  }
}

export async function POST(): Promise<Response> {
  return Response.json({ message: 'error' }, { status: 405 });
}
