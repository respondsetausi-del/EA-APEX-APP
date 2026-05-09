/**
 * Smoke-test login auth endpoints (no secrets).
 *
 * Usage:
 *   node scripts/login-api-smoke.mjs
 *   node scripts/login-api-smoke.mjs http://127.0.0.1:3000/api/check-email
 *   node scripts/login-api-smoke.mjs https://ea-apex.vercel.app/payment/check_email_device.php
 */
const body = {
  email: 'smoke-test@example.com',
  mentor: '115',
  device_id: `smoke-${Date.now()}`,
};

const defaults = [
  'http://127.0.0.1:3000/api/check-email',
  'https://ea-apex.vercel.app/payment/check_email_device.php',
];

const targets = process.argv.slice(2).filter(Boolean);

for (const url of targets.length ? targets : defaults) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let preview = text;
    try {
      preview = JSON.stringify(JSON.parse(text), null, 0);
    } catch {
      preview = text.replace(/\s+/g, ' ').slice(0, 400);
    }
    console.log(`\n${url}\n  status: ${res.status}\n  body:   ${preview}`);
  } catch (e) {
    console.log(`\n${url}\n  error:  ${e?.message || e}`);
  }
}
