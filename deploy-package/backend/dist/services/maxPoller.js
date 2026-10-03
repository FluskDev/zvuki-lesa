import { sendMessage, subscribeUser, unsubscribeUser, maxFetch } from './maxBot.js';
const MAX_API_BASE = 'https://platform-api2.max.ru';
const POLL_INTERVAL_MS = 1_000;
const MAX_LONG_POLL_TIMEOUT_S = 30;
let timer = null;
let running = false;
let inFlight = false;
let marker = null;
let stopped = false;
// MAX иногда отдаёт одно и то же обновление несколько раз подряд (пока
// наш marker не «закрепится» на сервере). Дедуплицируем по body.mid —
// это уникальный ID сообщения в MAX.
const RECENT_MIDS_MAX = 500;
const recentMids = new Set();
function shouldProcessMid(mid) {
    if (!mid)
        return true; // нет id — пропустить дедуп, разрешить обработку
    if (recentMids.has(mid))
        return false;
    recentMids.add(mid);
    if (recentMids.size > RECENT_MIDS_MAX) {
        // FIFO-усечение: дропаем первую половину, чтобы не текла память.
        const drop = Math.floor(recentMids.size / 2);
        const iter = recentMids.values();
        for (let i = 0; i < drop; i++) {
            const v = iter.next().value;
            if (v !== undefined)
                recentMids.delete(v);
        }
    }
    return true;
}
// Дополнительный дедуп: если у событий нет mid (или mid разный на каждый
// внутренний ретрай MAX), не даём одному и тому же юзеру получить одинаковый
// ответ чаще чем раз в TTL.
const RECENT_TEXT_TTL_MS = 5_000;
const lastTextByUser = new Map();
function recentlyProcessed(userId, text) {
    const key = `${userId}:${text}`;
    const now = Date.now();
    const prev = lastTextByUser.get(key);
    if (prev !== undefined && now - prev < RECENT_TEXT_TTL_MS)
        return true;
    lastTextByUser.set(key, now);
    // Чистка мусора, чтобы Map не рос бесконечно.
    if (lastTextByUser.size > 500) {
        for (const [k, ts] of lastTextByUser) {
            if (now - ts > RECENT_TEXT_TTL_MS)
                lastTextByUser.delete(k);
        }
    }
    return false;
}
// Юзеры, которым уже отправили приветствие. Повторные /start молча игнорим,
// пока пользователь не сделает /leave — тогда сможет «перезайти» через /start.
const welcomedUsers = new Set();
function getToken() {
    const t = process.env.MAX_BOT_TOKEN;
    if (!t || t.trim() === '')
        return undefined;
    return t;
}
function getJoinCode() {
    const c = process.env.MAX_JOIN_CODE;
    if (!c || c.trim() === '')
        return undefined;
    return c;
}
function buildWelcomeText() {
    return [
        'Привет! Это бот гостевого дома «Звуки леса».',
        'Я буду присылать уведомления о новых бронях.',
        'Чтобы подписаться, отправьте: /join <код>',
        'Чтобы отписаться: /leave',
    ].join('\n');
}
async function handleUpdate(update) {
    if (update.update_type !== 'message_created')
        return;
    const message = update.message;
    if (!message)
        return;
    const userId = message.sender?.user_id;
    if (typeof userId !== 'number')
        return;
    // Дедуп: MAX может прислать одно сообщение несколько раз подряд.
    if (!shouldProcessMid(message.body?.mid)) {
        if (process.env.MAX_DEBUG === 'true') {
            console.log('[max] skip duplicate mid=', message.body?.mid);
        }
        return;
    }
    const text = (message.body?.text ?? '').trim();
    if (!text)
        return;
    if (text === '/start' || text.startsWith('/start')) {
        if (welcomedUsers.has(userId)) {
            if (process.env.MAX_DEBUG === 'true')
                console.log('[max] skip /start for already-welcomed user', userId);
            return;
        }
        welcomedUsers.add(userId);
        await sendMessage(userId, buildWelcomeText());
        return;
    }
    if (text.startsWith('/join')) {
        if (recentlyProcessed(userId, text)) {
            if (process.env.MAX_DEBUG === 'true')
                console.log('[max] skip /join dup for user', userId);
            return;
        }
        const parts = text.split(/\s+/, 2);
        const code = parts[1] ?? '';
        const expected = getJoinCode();
        if (!expected) {
            await sendMessage(userId, 'Код подписки не настроен на сервере.');
            return;
        }
        if (code !== expected) {
            await sendMessage(userId, 'Неверный код.');
            return;
        }
        try {
            await subscribeUser(userId, code);
            await sendMessage(userId, 'Готово! Теперь вы будете получать уведомления о новых бронях.');
        }
        catch (err) {
            console.error('[max] subscribe failed', err);
        }
        return;
    }
    if (text === '/leave') {
        if (recentlyProcessed(userId, text)) {
            if (process.env.MAX_DEBUG === 'true')
                console.log('[max] skip /leave dup for user', userId);
            return;
        }
        try {
            await unsubscribeUser(userId);
            welcomedUsers.delete(userId); // разрешаем повторный /start
            await sendMessage(userId, 'Вы отписались от уведомлений.');
        }
        catch (err) {
            console.error('[max] unsubscribe failed', err);
        }
        return;
    }
    // Прочие сообщения — игнорируем.
}
async function pollOnce() {
    const token = getToken();
    if (!token)
        return;
    const url = new URL(`${MAX_API_BASE}/updates`);
    url.searchParams.set('timeout', String(MAX_LONG_POLL_TIMEOUT_S));
    if (marker !== null)
        url.searchParams.set('marker', String(marker));
    try {
        const res = await maxFetch(url.toString(), {
            method: 'GET',
            headers: { Authorization: token },
        });
        if (!res.ok) {
            console.error(`[max] updates HTTP ${res.status}`);
            return;
        }
        const data = (await res.json());
        if (typeof data.marker !== 'undefined') {
            marker = data.marker ?? null;
        }
        const updates = data.updates ?? [];
        for (const u of updates) {
            if (process.env.MAX_DEBUG === 'true') {
                console.log('[max] update keys=', Object.keys(u), ' message keys=', u.message ? Object.keys(u.message) : null, ' body=', JSON.stringify(u.message?.body ?? null), ' sender=', JSON.stringify(u.message?.sender ?? null));
            }
            try {
                await handleUpdate(u);
            }
            catch (err) {
                console.error('[max] handleUpdate error', err);
            }
        }
    }
    catch (err) {
        // ECONNRESET — штатное завершение long-polling, MAX закрывает соединение
        // по истечении server-side timeout. Не считаем это ошибкой.
        const code = err.cause?.code
            ?? err.code;
        if (code !== 'ECONNRESET') {
            console.error('[max] polling error', err);
        }
    }
}
function tick() {
    if (stopped || inFlight)
        return;
    inFlight = true;
    pollOnce()
        .catch((err) => console.error('[max] pollOnce crashed', err))
        .finally(() => {
        inFlight = false;
    });
}
export function startMaxPolling() {
    if (running)
        return;
    if (!getToken()) {
        console.log('[max] polling disabled (no MAX_BOT_TOKEN)');
        return;
    }
    running = true;
    stopped = false;
    console.log('[max] polling started');
    // Первый тик — сразу, далее по интервалу.
    timer = setInterval(tick, POLL_INTERVAL_MS);
}
export function stopMaxPolling() {
    stopped = true;
    running = false;
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    console.log('[max] polling stopped');
}
