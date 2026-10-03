import crypto from 'node:crypto';
const SECRET = process.env.ADMIN_TOKEN_SECRET ?? 'dev-insecure-secret';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней
function hmac(input) {
    return crypto.createHmac('sha256', SECRET).update(input).digest('base64url');
}
// signedAt по умолчанию — текущее время; параметр нужен для тестов срока.
export function signToken(signedAt = Date.now()) {
    const payload = Buffer.from(JSON.stringify({ exp: signedAt + TTL_MS })).toString('base64url');
    return `${payload}.${hmac(payload)}`;
}
export function verifyToken(token, now = Date.now()) {
    const parts = token.split('.');
    if (parts.length !== 2)
        return false;
    const [payload, sig] = parts;
    const expected = hmac(payload);
    if (sig.length !== expected.length)
        return false;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
        return false;
    try {
        const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return typeof exp === 'number' && exp > now;
    }
    catch {
        return false;
    }
}
