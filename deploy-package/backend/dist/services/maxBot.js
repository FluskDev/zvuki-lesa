import { and, eq } from 'drizzle-orm';
import { Agent, fetch as undiciFetch } from 'undici';
import { db } from '../db/client.js';
import { maxSubscribers } from '../db/schema.js';
const MAX_API_BASE = 'https://platform-api2.max.ru';
// На Windows-дев-машинах Node не находит системные CA-сертификаты и падает с
// UNABLE_TO_GET_ISSUER_CERT_LOCALLY. По умолчанию для MAX отключаем проверку TLS;
// можно включить обратно через MAX_TLS_REJECT_UNAUTHORIZED=true.
const tlsRejectUnauthorized = process.env.MAX_TLS_REJECT_UNAUTHORIZED === 'true';
const insecureAgent = tlsRejectUnauthorized ? undefined : new Agent({ connect: { rejectUnauthorized: false } });
export function maxFetch(url, init = {}) {
    if (insecureAgent) {
        // dispatcher — расширение undici; тип RequestInit из DOM его не знает, приводим явно.
        return undiciFetch(url, { ...init, dispatcher: insecureAgent });
    }
    return fetch(url, init);
}
function getToken() {
    const t = process.env.MAX_BOT_TOKEN;
    if (!t || t.trim() === '')
        return undefined;
    return t;
}
export async function sendMessage(userId, text) {
    const token = getToken();
    if (!token) {
        return { ok: false, error: 'MAX_BOT_TOKEN not set' };
    }
    // Реальный MAX API (см. docs / продакшн dns-max-bot) принимает chat_id или
    // user_id как query-параметр. Для ЛС (dialog) — user_id.
    const url = new URL(`${MAX_API_BASE}/messages`);
    url.searchParams.set('user_id', String(userId));
    try {
        const res = await maxFetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: token,
            },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return { ok: false, error: `HTTP ${res.status}: ${body}` };
        }
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
}
function fmtDate(iso) {
    // Ожидаем YYYY-MM-DD; на всякий случай — вернуть как есть, если парсинг не удался.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m)
        return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
}
function fmtMoney(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount);
}
function pluralNights(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11)
        return 'ночь';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
        return 'ночи';
    return 'ночей';
}
function formatServiceLine(s) {
    const qty = s.quantity > 1 ? ` × ${s.quantity}` : '';
    if (s.priceAtBooking == null) {
        return `  • ${s.name}${qty}`;
    }
    const total = s.priceAtBooking * s.quantity;
    return `  • ${s.name}${qty} — ${fmtMoney(total)} ₽`;
}
export function formatBookingMessage(b) {
    const lines = [];
    lines.push(`🏡 Новая бронь #${b.id}`);
    lines.push('');
    lines.push(`🏠 ${b.cottageName}`);
    lines.push(`👤 ${b.guestName}`);
    lines.push(`📞 ${b.phone}`);
    lines.push('');
    lines.push(`📅 Заезд: ${fmtDate(b.checkInDate)}`);
    lines.push(`📅 Выезд: ${fmtDate(b.checkOutDate)}`);
    lines.push(`🌙 ${b.nights} ${pluralNights(b.nights)}`);
    if (b.services && b.services.length > 0) {
        lines.push('');
        lines.push('🛎 Услуги:');
        for (const s of b.services) {
            lines.push(formatServiceLine(s));
        }
    }
    lines.push('');
    lines.push(`💰 Итого: ${fmtMoney(b.totalPrice)} ₽`);
    return lines.join('\n');
}
export async function subscribeUser(userId, code) {
    const now = new Date();
    // INSERT OR IGNORE — если уже есть, ничего не делаем.
    await db
        .insert(maxSubscribers)
        .values({
        userId,
        chatId: null,
        joinCode: code,
        joinedAt: now,
        isActive: true,
    })
        .onConflictDoNothing({ target: maxSubscribers.userId });
    // Если пользователь есть, но is_active=0 — реактивируем.
    await db
        .update(maxSubscribers)
        .set({ isActive: true, joinCode: code })
        .where(and(eq(maxSubscribers.userId, userId), eq(maxSubscribers.isActive, false)));
}
export async function unsubscribeUser(userId) {
    await db
        .update(maxSubscribers)
        .set({ isActive: false })
        .where(eq(maxSubscribers.userId, userId));
}
export async function getActiveSubscribers() {
    const rows = await db
        .select({ userId: maxSubscribers.userId })
        .from(maxSubscribers)
        .where(eq(maxSubscribers.isActive, true));
    return rows;
}
