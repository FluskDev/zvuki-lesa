# MAX-бот: уведомления о новых бронях владельцу и жене

Дата: 2026-07-12
Проект: «Звуки леса» — гостевой дом (React + Vite, Express + SQLite/Drizzle)

## Цель

Когда с сайта приходит новая заявка на бронь, она автоматически уходит сообщением в MAX всем, кто подписался командой `/join 1501` боту.

## Ключевые решения (из брейншторминга)

1. **Платформа** — мессенджер MAX. API: `https://platform-api2.max.ru`. Документация: https://dev.max.ru/docs-api.
2. **Режим updates** — **long polling через `GET /updates`**. Без публичного URL; в production переезд на webhook через `POST /subscriptions` — потом, без правок архитектуры (только `MAX_POLLING_ENABLED=false` + `MAX_WEBHOOK_URL`).
3. **Подписка** — пользователь пишет боту `/join 1501`, бот запоминает его `user_id`. Код `1501` хранится в `MAX_JOIN_CODE` в `.env` (на случай смены).
4. **Токен** — `MAX_BOT_TOKEN` в `backend/.env`. В коде не светится, передаётся в заголовке `Authorization: <token>` (без Bearer).
5. **Что рассылаем** — только новые брони с сайта (`source='site'`). Ручные и подтверждения/отмены — не трогаем.
6. **Формат уведомления** — текст с гостем, телефоном, датами, домиком, суммой, ссылкой в админку.
7. **Отказоустойчивость** — если MAX недоступен, бронь всё равно создаётся; ошибка рассылки логируется, но не падает.

## 1. БД — новая таблица `max_subscribers`

```ts
// backend/src/db/schema.ts — добавить
export const maxSubscribers = sqliteTable('max_subscribers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique(),
  chatId: text('chat_id'),                    // если бот пишет в чат, не в ЛС — необязательно
  joinCode: text('join_code').notNull(),      // для аудита, какой код использовали
  joinedAt: text('joined_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastNotifiedAt: text('last_notified_at'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});
```

Миграция: `cd backend && npx drizzle-kit generate` → `npm run backend:migrate`.

## 2. Сервис `backend/src/services/maxBot.ts`

```ts
const MAX_API = 'https://platform-api2.max.ru';
const TIMEOUT_MS = 5_000;

export interface SendResult { ok: boolean; error?: string; }

export async function sendMessage(userId: number, text: string): Promise<SendResult> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return { ok: false, error: 'MAX_BOT_TOKEN not configured' };
  try {
    const res = await fetch(`${MAX_API}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[max] sendMessage ${userId} -> ${res.status}: ${body}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('[max] sendMessage error:', err);
    return { ok: false, error: String(err) };
  }
}

export function formatBookingMessage(b: BookingSummary): string {
  return [
    '🏡 Новая бронь с сайта',
    `Гость: ${b.guestName}`,
    `Телефон: ${b.phone}`,
    `Домик: ${b.cottageName}`,
    `Даты: ${b.checkInDate} → ${b.checkOutDate} (${b.nights} ноч.)`,
    `Сумма: ${b.totalPrice} ₽`,
    '',
    'Открыть в админке: /admin',
  ].join('\n');
}
```

`BookingSummary` уже есть в `services/notifications.ts` — расширим или используем.

## 3. Polling updates — `backend/src/services/maxPoller.ts`

```ts
const POLL_INTERVAL_MS = 2_000;

let marker: string | undefined;
let timer: NodeJS.Timeout | undefined;

interface MaxUpdate { update_id: string; type: string; payload?: any; }

export function startMaxPolling(): void {
  if (!process.env.MAX_BOT_TOKEN) {
    console.log('[max] polling disabled (no MAX_BOT_TOKEN)');
    return;
  }
  console.log('[max] polling started');
  schedulePoll();
}

export function stopMaxPolling(): void {
  if (timer) clearTimeout(timer);
}

function schedulePoll(): void {
  timer = setTimeout(pollOnce, POLL_INTERVAL_MS);
}

async function pollOnce(): Promise<void> {
  try {
    const url = new URL('https://platform-api2.max.ru/updates');
    url.searchParams.set('timeout', '10');
    if (marker) url.searchParams.set('marker', marker);
    const res = await fetch(url, {
      headers: { Authorization: process.env.MAX_BOT_TOKEN! },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { schedulePoll(); return; }
    const body = await res.json() as { updates: MaxUpdate[]; marker?: string };
    if (body.marker) marker = body.marker;
    for (const u of body.updates ?? []) {
      if (u.type === 'message_created') await handleMessage(u.payload);
    }
  } catch (err) {
    console.error('[max] poll error:', err);
  } finally {
    schedulePoll();
  }
}

async function handleMessage(payload: any): Promise<void> {
  const text: string = (payload?.body ?? '').trim();
  const userId: number | undefined = payload?.sender?.user_id ?? payload?.user_id;
  if (!userId || !text) return;
  if (text.startsWith('/start')) {
    await sendMessage(userId, 'Привет! Напиши /join 1501, чтобы получать уведомления о новых бронях.');
    return;
  }
  if (text.startsWith('/join ')) {
    const code = text.slice(6).trim();
    if (code !== process.env.MAX_JOIN_CODE) {
      await sendMessage(userId, 'Неверный код.');
      return;
    }
    await subscribeUser(userId, code);
    await sendMessage(userId, 'Готово! Теперь ты будешь получать уведомления о новых бронях.');
    return;
  }
  if (text === '/leave') {
    await unsubscribeUser(userId);
    await sendMessage(userId, 'Отписал. Напиши /join 1501, чтобы снова получать уведомления.');
    return;
  }
}
```

`subscribeUser`/`unsubscribeUser` — `INSERT OR IGNORE INTO max_subscribers ...` и `UPDATE max_subscribers SET is_active=0 WHERE user_id=?`.

Запуск в `server.ts` после `app.listen`:
```ts
import { startMaxPolling } from './services/maxPoller';
startMaxPolling();
```

## 4. Рассылка при новой брони с сайта

В `services/notifications.ts` расширяем `notifyNewBooking`:

```ts
export async function notifyNewBooking(booking: BookingSummary): Promise<void> {
  // … существующая запись в notifications и console.log …
  await broadcastBookingToMax(booking);
}

async function broadcastBookingToMax(booking: BookingSummary): Promise<void> {
  const subs = await db.select().from(maxSubscribers).where(eq(maxSubscribers.isActive, true));
  if (!subs.length) return;
  const text = formatBookingMessage(booking);
  const results = await Promise.allSettled(
    subs.map((s) => sendMessage(s.userId, text)),
  );
  const ok = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  console.log(`[max] notified ${ok}/${subs.length} subscribers about booking #${booking.id}`);
}
```

Критично: `Promise.allSettled`, чтобы один упавший запрос не отменял остальные.

## 5. Тесты (Vitest)

- `maxBot.test.ts` — `sendMessage` мокает `fetch`, проверяет: ok при 200, error при 4xx/5xx, ok=false без токена.
- `maxBot.test.ts` — `formatBookingMessage` содержит имя, телефон, даты, домик, сумму.
- `notifications.test.ts` — `notifyNewBooking` вызывает рассылку, если есть активные подписчики; рассылка НЕ ломает основной поток при ошибке MAX.
- E2E сценарий: подписчик в БД → новая бронь → мок fetch вызван с правильным `user_id` и текстом.

## 6. Конфиг и документация

- `backend/.env.example` — добавить `MAX_BOT_TOKEN`, `MAX_JOIN_CODE`.
- `CLAUDE.md` — раздел «Уведомления MAX»: переменные, таблица, эндпоинт, формат текста, как подписаться.
- `package.json` бэка: новых npm-зависимостей нет (используем встроенный `fetch` и `AbortSignal.timeout` — Node 18+).

## 7. Чек-лист запуска для владельца

1. Создать бота в MAX (через @metabot или аналог).
2. Получить токен, положить в `backend/.env` как `MAX_BOT_TOKEN=...`.
3. Указать `MAX_JOIN_CODE=1501`.
4. Перезапустить `npm run backend:dev`.
5. Владелец и жена пишут боту `/join 1501` — получают «Готово!».
6. Тестовая бронь с сайта → приходит сообщение обоим.

## Вне объёма (YAGNI)

- Webhook-режим (long polling достаточно для текущего потока).
- Отправка кнопок/inline-клавиатур (потом, если попросят).
- Подтверждение/отмена через бота (только уведомления).
- Реакция на любые команды кроме `/join`, `/leave`, `/start`.
- Ограничение скорости (30 rps MAX — для 3 домиков не актуально).
