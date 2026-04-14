import { getPool } from '@/app/api/_db';

// POST /api/admin-reset-device
// Body: { email: string, admin_key: string }
// Resets device_id and used flag so user can re-bind on a new device

const ADMIN_KEY = process.env.ADMIN_RESET_KEY || 'ShadowMonarch_2026';

export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json().catch(() => ({}));
        const email = (body?.email as string | undefined)?.trim().toLowerCase();
        const adminKey = (body?.admin_key as string | undefined)?.trim();

        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }

        if (adminKey !== ADMIN_KEY) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const pool = await getPool();
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'UPDATE members SET device_id = NULL, used = 0 WHERE email = ?',
                [email]
            );

            const affected = (result as any).affectedRows ?? 0;

            if (affected === 0) {
                return Response.json({ success: false, message: 'Email not found' });
            }

            return Response.json({
                success: true,
                message: `Device binding reset for ${email}. User can now login on a new device.`
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('admin-reset-device error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function GET(): Promise<Response> {
    return Response.json({ ok: true });
}
