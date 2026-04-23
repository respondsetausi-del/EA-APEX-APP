// Proxy to PHP device-binding endpoint on ea-converter.com
// PHP runs on the same server as the DB — no remote MySQL needed

const PHP_ENDPOINT = 'https://ea-converter.com/payment/check_email_device.php';
const DIRECT_IP_ENDPOINT = 'https://37.148.203.172/payment/check_email_device.php';
const TIMEOUT_MS = 20000;

async function fetchWithTimeout(url: string, options: RequestInit, host?: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(host ? { Host: host } : {}),
    };
    try {
        return await fetch(url, { ...options, headers, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function proxyToPhp(body: object): Promise<Response> {
    const jsonBody = JSON.stringify(body);

    // Try domain first, fallback to direct IP
    try {
        const res = await fetchWithTimeout(PHP_ENDPOINT, { method: 'POST', body: jsonBody });
        if (res.ok) return res;
    } catch {}

    // Fallback
    try {
        const res = await fetchWithTimeout(DIRECT_IP_ENDPOINT, { method: 'POST', body: jsonBody }, 'ea-converter.com');
        if (res.ok) return res;
    } catch {}

    throw new Error('Both PHP endpoints unreachable');
}

export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json().catch(() => ({}));
        const email = (body?.email as string | undefined)?.trim().toLowerCase();
        const mentor = (body?.mentor as string | undefined)?.toString().trim();
        const deviceId = (body?.device_id as string | undefined)?.toString().trim();

        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }

        const phpRes = await proxyToPhp({ email, mentor, device_id: deviceId });
        const data = await phpRes.json();
        return Response.json(data);
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
