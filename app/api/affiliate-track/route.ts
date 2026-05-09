// Proxy to EA APEX PHP affiliate pending-ref (`affiliate/api/track.php`).
// Mirrors the existing /r/CODE landing page POST so the mobile app can
// attribute an (email, ref_code) pair before redirecting to PayFast.
// On payment success, payment/affiliate_track.php joins eac_pending_refs
// on email and credits the affiliate exactly the same as a web visitor.

import { apexAffiliateTrackUrl } from '@/constants/apex-backend';

const PHP_ENDPOINT = apexAffiliateTrackUrl();
const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    try {
        return await fetch(url, { ...options, headers, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function proxyToPhp(body: object): Promise<Response> {
    const jsonBody = JSON.stringify(body);
    const res = await fetchWithTimeout(PHP_ENDPOINT, { method: 'POST', body: jsonBody });
    if (res.ok) return res;
    throw new Error('PHP endpoint unreachable');
}

export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json().catch(() => ({}));
        const email = (body?.email as string | undefined)?.trim().toLowerCase();
        const refCode = (body?.ref_code as string | undefined)?.toString().trim().toUpperCase();

        if (!email) {
            return Response.json({ ok: false, error: 'Email is required' }, { status: 400 });
        }
        if (!refCode) {
            return Response.json({ ok: false, error: 'Referral code is required' }, { status: 400 });
        }

        const phpRes = await proxyToPhp({ email, ref_code: refCode });
        const data = await phpRes.json();
        return Response.json(data);
    } catch (error) {
        console.error('affiliate-track proxy error:', error);
        // Soft-fail: surface a non-blocking error so the client can still
        // continue to payment without affiliate attribution.
        return Response.json(
            { ok: false, error: 'Affiliate tracker unavailable', transient: true },
            { status: 503 }
        );
    }
}

export async function GET(): Promise<Response> {
    return Response.json({ ok: true });
}
