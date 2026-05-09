// License auth proxy: forwards to EA APEX `admin/api/auth/`

import { proxyAuthLicense } from '@/services/ea-converter-proxy';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const licenceRaw = (body?.licence ?? body?.license ?? '').toString();
    const licence = licenceRaw.trim();
    const phoneSecret = (body?.phone_secret as string | undefined)?.toString().trim();

    if (!licence) {
      return Response.json({ message: 'error' }, { status: 200 });
    }

    const result = await proxyAuthLicense(licence, phoneSecret);
    return Response.json(result);
  } catch (error) {
    console.error('❌ auth-license proxy error:', error);
    return Response.json({ message: 'error' }, { status: 200 });
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ ok: true });
}
