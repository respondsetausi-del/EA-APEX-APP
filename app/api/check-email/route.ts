// Login/auth proxy: forwards to ea-converter.com/admin/api/auth/app/ (Android backend)

import { proxyCheckEmail } from '@/services/ea-converter-proxy';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email as string | undefined)?.trim().toLowerCase();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const result = await proxyCheckEmail(email);
    return Response.json(result);
  } catch (error) {
    console.error('❌ check-email proxy error:', error);
    return Response.json({ found: 0, used: 0, paid: 0, invalidMentor: 0 }, { status: 200 });
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const testEmail = url.searchParams.get('email') || 'respondscooby@gmail.com';

    const result = await proxyCheckEmail(testEmail);
    return Response.json({
      db_connected: true,
      proxy: 'ea-converter.com',
      email_tested: testEmail,
      found: result.found === 1,
      data: result.found === 1 ? { found: result.found, paid: result.paid, used: result.used } : null,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    return Response.json({
      db_connected: false,
      proxy: 'ea-converter.com',
      error: err.message || 'Unknown error',
      code: err.code || 'UNKNOWN',
    });
  }
}
