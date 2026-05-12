// Proxy to EA APEX PHP auth endpoint (`admin/api/auth/app/`).
// Previously pointed at `payment/check_email_device.php` which does not exist
// on the live site. Now uses the working auth endpoint via proxyCheckEmail.

import { proxyCheckEmail } from '@/services/ea-converter-proxy';

export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json().catch(() => ({}));
        const email = (body?.email as string | undefined)?.trim().toLowerCase();
        const mentor = (body?.mentor as string | undefined)?.toString().trim();
        const deviceId = (body?.device_id as string | undefined)?.toString().trim();

        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }

        console.log('[check-email] authenticating:', email, 'mentor:', mentor);

        // Use the existing working proxy that talks to admin/api/auth/app/
        const result = await proxyCheckEmail(email);

        console.log('[check-email] PHP response:', result);

        // Return the translated response — proxyCheckEmail already maps
        // the PHP { message } into { found, used, paid, invalidMentor }.
        // The client (services/api.ts) expects these exact fields.
        return Response.json(result);
    } catch (error) {
        console.error('check-email proxy error:', error);
        // Return 503 (not faked zeros) so the client treats upstream
        // failure as transient and doesn't count it as a revocation
        // signal. Faking { paid:0, found:0 } here was indistinguishable
        // from a real "subscription revoked" response and fed the
        // background check's 3-strike kick.
        return Response.json(
            { error: 'auth upstream unavailable', transient: true },
            { status: 503 }
        );
    }
}

export async function GET(): Promise<Response> {
    return Response.json({ ok: true });
}
