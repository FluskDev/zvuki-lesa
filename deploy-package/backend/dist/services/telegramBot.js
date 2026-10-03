/**
 * Telegram-уведомления через Cloudflare Worker-релей.
 *
 * Почему не напрямую: api.telegram.org недоступен с российских IP на уровне
 * TCP. Релей (https://lemonadka-tg.ivladok01.workers.dev, тот же что у
 * проекта «Сайт Вика») пересылает запросы с европейского egress.
 *
 * Воркер универсальный: принимает { botToken, chatId, text } в теле, поэтому
 * токен бота и chat_id передаются в каждом запросе, а не зашиты в воркере.
 *
 * В отличие от MAX: chat_id фиксированные (в .env), подписчиков и поллинга
 * нет. Уведомления просто рассылаются всем из TELEGRAM_CHAT_IDS.
 */
function getEnv(key) {
    const v = process.env[key];
    if (!v || v.trim() === '')
        return undefined;
    return v;
}
/**
 * Канал включён, если заданы все три: токен, URL релея, секрет релея.
 * Без хотя бы одной переменной broadcastBookingToTelegram — no-op.
 */
export function isTelegramEnabled() {
    return Boolean(getEnv('TELEGRAM_BOT_TOKEN') &&
        getEnv('TELEGRAM_RELAY_URL') &&
        getEnv('TELEGRAM_RELAY_SECRET'));
}
/**
 * Парсит TELEGRAM_CHAT_IDS (через запятую) в массив строк. Пустые сегменты и
 * пробелы игнорируются. Возвращает [] если env не задан или пуст.
 */
export function getTelegramChatIds() {
    const raw = getEnv('TELEGRAM_CHAT_IDS');
    if (!raw)
        return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
/**
 * Отправляет одно сообщение в Telegram через Worker-релей.
 * Не пробрасывает ошибки наружу — возвращает { ok, error? }.
 *
 * Таймаут 10с: релей обычно отвечает за <1с, запас на холодный старт.
 */
export async function sendTelegramMessage(chatId, text) {
    const botToken = getEnv('TELEGRAM_BOT_TOKEN');
    const relayUrl = getEnv('TELEGRAM_RELAY_URL');
    const secret = getEnv('TELEGRAM_RELAY_SECRET');
    if (!botToken || !relayUrl || !secret) {
        return { ok: false, error: 'Telegram relay not configured' };
    }
    try {
        const res = await fetch(relayUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-relay-secret': secret,
            },
            body: JSON.stringify({ botToken, chatId, text }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return { ok: false, error: `relay HTTP ${res.status}: ${body.slice(0, 500)}` };
        }
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
}
