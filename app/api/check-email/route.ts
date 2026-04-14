import { getPool } from '@/app/api/_db';

export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json().catch(() => ({}));
        const email = (body?.email as string | undefined)?.trim().toLowerCase();
        const mentor = (body?.mentor as string | undefined)?.toString().trim();
        const deviceId = (body?.device_id as string | undefined)?.toString().trim();

        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }

        const pool = await getPool();
        const conn = await pool.getConnection();
        try {
            const [rows] = await conn.execute(
                'SELECT id, email, paid, used, device_id, max_devices, expiry_date FROM members WHERE email = ? LIMIT 1',
                [email]
            );

            const result = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : null;

            if (!result) {
                return Response.json({ found: 0, used: 0, paid: 0, invalidMentor: 0, expired: 0, device_mismatch: 0 });
            }

            const paid: number = Number(result.paid ?? 0);

            // --- EXPIRY CHECK ---
            if (result.expiry_date) {
                const expiryDate = new Date(result.expiry_date);
                const now = new Date();
                if (expiryDate < now) {
                    return Response.json({
                        found: 1,
                        used: 0,
                        paid,
                        invalidMentor: 0,
                        expired: 1,
                        expiry_date: result.expiry_date,
                        device_mismatch: 0
                    });
                }
            }

            // --- DEVICE BINDING ---
            const storedDeviceId = result.device_id ? String(result.device_id).trim() : null;

            if (deviceId) {
                if (!storedDeviceId) {
                    // First login — bind this device
                    await conn.execute(
                        'UPDATE members SET device_id = ?, used = 1 WHERE email = ?',
                        [deviceId, email]
                    );
                    return Response.json({
                        found: 1,
                        used: 0,
                        paid,
                        invalidMentor: 0,
                        expired: 0,
                        expiry_date: result.expiry_date || null,
                        device_mismatch: 0
                    });
                } else if (storedDeviceId === deviceId) {
                    // Same device — allow
                    return Response.json({
                        found: 1,
                        used: 0,
                        paid,
                        invalidMentor: 0,
                        expired: 0,
                        expiry_date: result.expiry_date || null,
                        device_mismatch: 0
                    });
                } else {
                    // DIFFERENT device — BLOCKED
                    return Response.json({
                        found: 1,
                        used: 1,
                        paid,
                        invalidMentor: 0,
                        expired: 0,
                        expiry_date: result.expiry_date || null,
                        device_mismatch: 1
                    });
                }
            }

            // No device_id sent (legacy client fallback)
            let used: number = Number(result.used ?? 0);
            const shouldAllowLogin = used === 0;
            if (used === 0) {
                await conn.execute('UPDATE members SET used = 1 WHERE email = ?', [email]);
            }

            return Response.json({
                found: 1,
                used: shouldAllowLogin ? 0 : used,
                paid,
                invalidMentor: 0,
                expired: 0,
                expiry_date: result.expiry_date || null,
                device_mismatch: 0
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('check-email error:', error);
        return Response.json({ found: 0, used: 0, paid: 0, invalidMentor: 0, expired: 0, device_mismatch: 0 }, { status: 200 });
    }
}

export async function GET(): Promise<Response> {
    return Response.json({ ok: true });
}
