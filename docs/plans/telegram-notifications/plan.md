# Telegram-уведомления о новых бронях — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить второй канал уведомлений о новых бронях — Telegram, параллельно с MAX. Сообщение уходит двум фиксированным получателям (владелец + жена) через Cloudflare Worker-релей.

**Architecture:** Новый модуль `backend/src/services/telegramBot.ts` отправляет сообщения через существующий Cloudflare Worker `lemonadka-tg.ivladok01.workers.dev` (тот же, что использует проект «Сайт Вика»). Воркер универсальный: принимает `{ botToken, chatId, text }` в теле и пересылает в `api.telegram.org`. `notifications.ts` вызывает `broadcastBookingToTelegram` параллельно с уже существующим `broadcastBookingToMax` — падение одного канала не валит другой. Формат сообщения — переиспользуем `formatBookingMessage` из `maxBot.ts` без изменений.

**Tech Stack:** TypeScript 5.9, Express 4, Node 22, Vitest, undici fetch (через глобальный `fetch`). Миграция БД не требуется.

**Спека:** `docs/superpowers/specs/2026-07-18-telegram-notifications-design.md`

---

## Scope Check

Один независимый подпроект: второй канал уведомлений. Не требует миграций, не ломает MAX. Укладывается в один план.

## File Structure

**Создаваемые файлы:**

- `backend/src/services/telegramBot.ts` — сервис отправки Telegram-сообщений через релей. Публичный API: `sendTelegramMessage(chatId, text)`, `getTelegramChatIds()`, `isTelegramEnabled()`. Без зависимостей от БД.
- `backend/src/services/telegramBot.test.ts` — Vitest-тесты с моком глобального `fetch`.

**Изменяемые файлы:**

- `backend/src/services/notifications.ts` — добавляем функцию `broadcastBookingToTelegram(booking)` и вызов в `notifyNewBooking` рядом с уже существующим `broadcastBookingToMax`. Никаких других изменений.
- `backend/.env.example` — добавляем блок переменных окружения для Telegram-канала (комментарии, не секреты).

**Не трогаем:**

- `backend/src/services/maxBot.ts` — переиспользуем `formatBookingMessage` через импорт.
- `backend/src/services/maxPoller.ts` — MAX-поллер не имеет отношения к Telegram.
- `backend/src/db/schema.ts` — миграция не нужна.
- Фронтенд (`src/**`) — уведомления уходят в мессенджеры, в UI ничего не меняется.

---

## Task 1: Тесты для telegramBot (TDD — сначала красные)

**Files:**
- Create: `backend/src/services/telegramBot.test.ts`

**Зачем:** Пишем тесты ДО реализации. Это фиксирует контракт модуля: `sendTelegramMessage` шлёт POST с правильным телом и заголовком секрета; `getTelegramChatIds` парсит env; `isTelegramEnabled` учитывает все три env-переменные.

- [ ] **Step 1.1: Создать файл с тестами**

Создай `backend/src/services/telegramBot.test.ts` со следующим содержимым:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTelegramChatIds,
  isTelegramEnabled,
  sendTelegramMessage,
} from './telegramBot';

const originalEnv = { ...process.env };

beforeEach(() => {
  // Чистый env для каждого теста
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_RELAY_URL;
  delete process.env.TELEGRAM_RELAY_SECRET;
  delete process.env.TELEGRAM_CHAT_IDS;
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('isTelegramEnabled', () => {
  it('false когда ни одна env не задана', () => {
    expect(isTelegramEnabled()).toBe(false);
  });

  it('true когда все три заданы', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    process.env.TELEGRAM_RELAY_URL = 'https://relay.example.workers.dev';
    process.env.TELEGRAM_RELAY_SECRET = 'secret';
    expect(isTelegramEnabled()).toBe(true);
  });

  it('false когда задан только токен', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    expect(isTelegramEnabled()).toBe(false);
  });

  it('false когда задан только relay URL', () => {
    process.env.TELEGRAM_RELAY_URL = 'https://relay.example.workers.dev';
    expect(isTelegramEnabled()).toBe(false);
  });
});

describe('getTelegramChatIds', () => {
  it('возвращает пустой массив когда env не задан', () => {
    expect(getTelegramChatIds()).toEqual([]);
  });

  it('возвращает пустой массив для пустой строки', () => {
    process.env.TELEGRAM_CHAT_IDS = '';
    expect(getTelegramChatIds()).toEqual([]);
  });

  it('парсит два id через запятую', () => {
    process.env.TELEGRAM_CHAT_IDS = '5750357876,5743780836';
    expect(getTelegramChatIds()).toEqual(['5750357876', '5743780836']);
  });

  it('обрезает пробелы и игнорирует пустые сегменты', () => {
    process.env.TELEGRAM_CHAT_IDS = ' 1 , , 2 ,  ';
    expect(getTelegramChatIds()).toEqual(['1', '2']);
  });
});

describe('sendTelegramMessage', () => {
  it('шлёт POST с правильным URL, headers и body', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_RELAY_URL = 'https://relay.example.workers.dev';
    process.env.TELEGRAM_RELAY_SECRET = 'test-secret';

    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTelegramMessage('5750357876', 'hello');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://relay.example.workers.dev');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'x-relay-secret': 'test-secret',
    });
    expect(JSON.parse(init.body)).toEqual({
      botToken: 'test-bot-token',
      chatId: '5750357876',
      text: 'hello',
    });
  });

  it('возвращает { ok: false, error } на HTTP 500', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_RELAY_URL = 'https://relay.example.workers.dev';
    process.env.TELEGRAM_RELAY_SECRET = 'test-secret';

    vi.stubGlobal('fetch', async () => new Response('boom', { status: 500 }));

    const result = await sendTelegramMessage('1', 'x');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('500');
  });

  it('возвращает { ok: false, error } на сетевую ошибку', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_RELAY_URL = 'https://relay.example.workers.dev';
    process.env.TELEGRAM_RELAY_SECRET = 'test-secret';

    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNRESET');
    });

    const result = await sendTelegramMessage('1', 'x');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ECONNRESET');
  });
});
```

- [ ] **Step 1.2: Запустить тесты — должны упасть**

Run: `cd backend && npx vitest run src/services/telegramBot.test.ts`
Expected: FAIL с ошибкой вроде "Cannot find module './telegramBot'". Тестов ещё нет, модуль не существует — это правильное «красное» состояние.

- [ ] **Step 1.3: Закоммитить красные тесты**

```bash
cd backend
git add src/services/telegramBot.test.ts
git commit -m "test(telegram): add failing tests for telegramBot service"
```

---

## Task 2: Реализация telegramBot.ts (зелёные тесты)

**Files:**
- Create: `backend/src/services/telegramBot.ts`

**Зачем:** Реализуем модуль ровно по контракту, зафиксированному в тестах. Никакой бизнес-логики — только отправка, парсинг env, проверка конфигурации.

- [ ] **Step 2.1: Создать файл с реализацией**

Создай `backend/src/services/telegramBot.ts` со следующим содержимым:

```typescript
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

export interface SendResult {
  ok: boolean;
  error?: string;
}

function getEnv(key: string): string | undefined {
  const v = process.env[key];
  if (!v || v.trim() === '') return undefined;
  return v;
}

/**
 * Канал включён, если заданы все три: токен, URL релея, секрет релея.
 * Без хотя бы одной переменной broadcastBookingToTelegram — no-op.
 */
export function isTelegramEnabled(): boolean {
  return Boolean(
    getEnv('TELEGRAM_BOT_TOKEN') &&
      getEnv('TELEGRAM_RELAY_URL') &&
      getEnv('TELEGRAM_RELAY_SECRET'),
  );
}

/**
 * Парсит TELEGRAM_CHAT_IDS (через запятую) в массив строк. Пустые сегменты и
 * пробелы игнорируются. Возвращает [] если env не задан или пуст.
 */
export function getTelegramChatIds(): string[] {
  const raw = getEnv('TELEGRAM_CHAT_IDS');
  if (!raw) return [];
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
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<SendResult> {
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
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 2.2: Запустить тесты — должны позеленеть**

Run: `cd backend && npx vitest run src/services/telegramBot.test.ts`
Expected: PASS, все 11 тестов зелёные (4 для isTelegramEnabled, 4 для getTelegramChatIds, 3 для sendTelegramMessage).

- [ ] **Step 2.3: Закоммитить**

```bash
cd backend
git add src/services/telegramBot.ts
git commit -m "feat(telegram): add telegramBot service with relay support"
```

---

## Task 3: Интеграция в notifications.ts

**Files:**
- Modify: `backend/src/services/notifications.ts` (добавляем broadcast в Telegram)

**Зачем:** Подключаем новый канал в существующий поток `notifyNewBooking`. Параллельно с MAX, не блокируя его, не пробрасывая ошибки.

- [ ] **Step 3.1: Прочитать текущий `notifications.ts`**

Run: `cat backend/src/services/notifications.ts`
Expected: увидишь импорт из `./maxBot`, функцию `broadcastBookingToMax`, и `notifyNewBooking`, вызывающий `broadcastBookingToMax` в `try/catch`.

- [ ] **Step 3.2: Добавить импорт и функцию broadcastBookingToTelegram**

В начало файла `backend/src/services/notifications.ts` после существующих импортов добавь:

```typescript
import {
  formatBookingMessage,
  getActiveSubscribers,
  sendMessage,
  unsubscribeUser,
  type BookingSummary,
} from './maxBot';
import {
  getTelegramChatIds,
  isTelegramEnabled,
  sendTelegramMessage,
} from './telegramBot';
```

(Импорт из `./maxBot` уже есть — оставь как было, добавь только вторую строку с `telegramBot`.)

Затем в конец файла (после `broadcastBookingToMax`, перед `notifyNewBooking` или после `notifyNewBooking` — оба варианта ОК) добавь:

```typescript
async function broadcastBookingToTelegram(booking: BookingSummary): Promise<void> {
  if (!isTelegramEnabled()) return;
  const chatIds = getTelegramChatIds();
  if (chatIds.length === 0) return;

  const text = formatBookingMessage(booking);
  console.log(
    `[tg] sending booking #${booking.id} to ${chatIds.length} recipients, text length=${text.length}`,
  );

  const results = await Promise.allSettled(
    chatIds.map((id) => sendTelegramMessage(id, text)),
  );

  let successCount = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      if (r.value.ok) {
        successCount++;
      } else {
        console.error(`[tg] send to chat ${chatIds[i]} failed: ${r.value.error}`);
      }
    } else {
      console.error(`[tg] send to chat ${chatIds[i]} rejected: ${r.reason}`);
    }
  }
  console.log(
    `[tg] notified ${successCount}/${chatIds.length} recipients about booking #${booking.id}`,
  );
}
```

- [ ] **Step 3.3: Вызвать broadcastBookingToTelegram из notifyNewBooking**

В функции `notifyNewBooking`, в блоке после существующего `try { await broadcastBookingToMax(booking); } catch ...` добавь параллельный блок для Telegram:

```typescript
  // Рассылка подписчикам MAX — не блокирует основной флоу и не пробрасывает ошибки.
  try {
    await broadcastBookingToMax(booking);
  } catch (err) {
    console.error('[max] broadcast failed', err);
  }

  // Рассылка в Telegram (фиксированные chat_id из env) — независимый канал,
  // падение не валит MAX и не валит бронь.
  try {
    await broadcastBookingToTelegram(booking);
  } catch (err) {
    console.error('[tg] broadcast failed', err);
  }
```

(Не трогай уже существующий `try/catch` для MAX. Просто добавь новый блок после него, перед `}` функции.)

- [ ] **Step 3.4: Проверить, что бэкенд собирается без ошибок**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 ошибок.

- [ ] **Step 3.5: Закоммитить**

```bash
cd backend
git add src/services/notifications.ts
git commit -m "feat(notifications): broadcast new bookings to Telegram"
```

---

## Task 4: Интеграционный тест + .env.example

**Files:**
- Modify: `backend/src/services/notifications.test.ts` (добавляем тест для Telegram-канала)
- Modify: `backend/.env.example` (документируем новые переменные)

**Зачем:** Проверяем, что `notifyNewBooking` действительно дёргает Telegram-канал параллельно с MAX. Задокументированный `.env.example` — единственное место, где новый разработчик узнает, какие переменные нужны.

- [ ] **Step 4.1: Прочитать существующий `notifications.test.ts`**

Run: `cat backend/src/services/notifications.test.ts`
Expected: увидишь мок `db` (через `vi.mock('../db/client')`), мок `./maxBot`, и тесты для `notifyNewBooking`, проверяющие запись в `notifications` и вызов `broadcastBookingToMax`.

- [ ] **Step 4.2: Замокать telegramBot и добавить тест**

В начало файла `backend/src/services/notifications.test.ts` после мока `./maxBot` добавь мок `telegramBot`:

```typescript
vi.mock('./telegramBot', () => ({
  isTelegramEnabled: vi.fn(),
  getTelegramChatIds: vi.fn(),
  sendTelegramMessage: vi.fn(),
}));
```

Затем добавь импорт в начало файла:

```typescript
import * as telegramBot from './telegramBot';
```

В существующем блоке `beforeEach` сбрось моки telegramBot и выстави дефолт «канал включён, два chat_id»:

```typescript
  vi.mocked(telegramBot.isTelegramEnabled).mockReturnValue(true);
  vi.mocked(telegramBot.getTelegramChatIds).mockReturnValue(['1', '2']);
  vi.mocked(telegramBot.sendTelegramMessage).mockResolvedValue({ ok: true });
```

Добавь новый тест в конец блока `describe('notifyNewBooking', ...)`:

```typescript
  it('отправляет уведомление в Telegram когда канал включён', async () => {
    const booking = makeBooking({ id: 100 });
    await notifyNewBooking(booking);

    expect(telegramBot.getTelegramChatIds).toHaveBeenCalled();
    expect(telegramBot.sendTelegramMessage).toHaveBeenCalledTimes(2);
    expect(telegramBot.sendTelegramMessage).toHaveBeenCalledWith(
      '1',
      expect.stringContaining('Новая бронь #100'),
    );
    expect(telegramBot.sendTelegramMessage).toHaveBeenCalledWith(
      '2',
      expect.stringContaining('Новая бронь #100'),
    );
  });

  it('не падает когда Telegram-канал выключен', async () => {
    vi.mocked(telegramBot.isTelegramEnabled).mockReturnValue(false);
    const booking = makeBooking({ id: 101 });
    await expect(notifyNewBooking(booking)).resolves.toBeUndefined();
    expect(telegramBot.sendTelegramMessage).not.toHaveBeenCalled();
  });
```

(`makeBooking` — это существующая фабрика из теста; если её нет, посмотри как создаётся объект в других тестах файла и переиспользуй тот же паттерн.)

- [ ] **Step 4.3: Запустить тесты**

Run: `cd backend && npx vitest run src/services/notifications.test.ts`
Expected: PASS, все тесты зелёные, включая два новых.

- [ ] **Step 4.4: Обновить `backend/.env.example`**

В конец `backend/.env.example` добавь:

```
# ─── Telegram-уведомления (через Cloudflare Worker-релей) ───────────────
# api.telegram.org недоступен с российских IP, поэтому шлём через воркер.
# Тот же релей, что у проекта «Сайт Вика» (lemonadka-tg.ivladok01.workers.dev).
# Нужен НОВЫЙ бот для «Звуков леса» (не бот Вики) — @BotFather в Telegram.
TELEGRAM_BOT_TOKEN=
# Chat ID получателей через запятую. Чтобы узнать свой id: напишите боту
# @userinfobot или любому вашему боту и посмотрите sender id.
TELEGRAM_CHAT_IDS=5750357876,5743780836
TELEGRAM_RELAY_URL=https://lemonadka-tg.ivladok01.workers.dev
TELEGRAM_RELAY_SECRET=ZRPa9CQjnwyv4MVebmulT5ziBf201SDLs6XrG8NHF7YxkhU3
```

- [ ] **Step 4.5: Закоммитить**

```bash
cd backend
git add src/services/notifications.test.ts .env.example
git commit -m "test(notifications): cover Telegram channel; docs: add TELEGRAM_* envs"
```

---

## Task 5: Smoke-тест + финальная проверка

**Files:**
- Modify: `backend/.env` (вручную, владелец) — добавить реальный `TELEGRAM_BOT_TOKEN`

**Зачем:** Убедиться, что end-to-end всё работает на живом окружении, и весь план выполняется без замечаний.

- [ ] **Step 5.1: Создать нового бота в Telegram**

1. Открыть `@BotFather` в Telegram.
2. `/newbot` → имя «Звуки леса — уведомления» → username `zvuki_lesa_notify_bot` (или любой свободный).
3. Скопировать токен.

- [ ] **Step 5.2: Добавить токен в `backend/.env`**

Открыть `backend/.env` (файл в `.gitignore`, не коммитится) и в конец добавить:

```
TELEGRAM_BOT_TOKEN=<скопированный_токен>
TELEGRAM_CHAT_IDS=5750357876,5743780836
TELEGRAM_RELAY_URL=https://lemonadka-tg.ivladok01.workers.dev
TELEGRAM_RELAY_SECRET=ZRPa9CQjnwyv4MVebmulT5ziBf201SDLs6XrG8NHF7YxkhU3
```

Все 4 переменные обязательны; воркер отбросит запрос без секрета.

- [ ] **Step 5.3: Стартовать боты у получателей**

Каждый из двух получателей (владелец + жена) должен **один раз** открыть чат с новым ботом и нажать `/start`. Без этого Telegram API вернёт `chat not found` — сообщение не дойдёт.

- [ ] **Step 5.4: Поднять бэкенд**

Run: `cd backend && npm run dev`
Expected: сервер слушает на :3001, в логах нет ошибок про Telegram (без токена MAX или TELEGRAM_* просто молчат).

- [ ] **Step 5.5: Создать тестовую бронь**

Run:
```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "cottageId": 1,
    "guestName": "Тест Telegram",
    "phone": "+79000000000",
    "checkInDate": "2026-08-01",
    "checkOutDate": "2026-08-03",
    "nights": 2,
    "totalPrice": 5000
  }'
```

(Подставить реальный `cottageId` из БД; см. `npm run backend:dev` логи или SQL `SELECT id FROM cottages;`.)

Expected: HTTP 200/201, в ответе — созданная бронь с `id`.

- [ ] **Step 5.6: Проверить логи и Telegram**

В консоли бэкенда должны появиться строки:
```
[BOOKING #N] New: ...
[tg] sending booking #N to 2 recipients, text length=XXX
[tg] notified 2/2 recipients about booking #N
```

В обоих Telegram-чатах — сообщение `🏡 Новая бронь #N ...` от бота `zvuki_lesa_notify_bot`.

Если `notified 1/2` или `0/2` — смотреть `[tg] send to chat <id> failed: <error>`. Частые причины:
- Чат с ботом не открыт (не сделали `/start`).
- Неверный chat_id.
- Воркер изменил URL/секрет (проверить у владельца Вики).

- [ ] **Step 5.7: Финальный прогон всех тестов бэкенда**

Run: `cd backend && npm test`
Expected: PASS, никаких регрессий. `telegramBot.test.ts` и `notifications.test.ts` — зелёные.

- [ ] **Step 5.8: Закоммитить возможный фикс `.env.example` (если правили)**

Если в процессе что-то поправили в `.env.example` (например, формат комментариев) — закоммитить. Реальный `.env` **не** коммитится (он в `.gitignore`).

```bash
cd backend
git add .env.example   # только если были правки
git diff --cached --quiet || git commit -m "chore(env): refine Telegram config docs"
```

---

## Готово

План реализован:
- `backend/src/services/telegramBot.ts` — отправка через Worker-релей.
- `backend/src/services/telegramBot.test.ts` — 11 unit-тестов.
- `backend/src/services/notifications.ts` — broadcast в Telegram параллельно с MAX.
- `backend/src/services/notifications.test.ts` — 2 новых интеграционных теста.
- `backend/.env.example` — задокументированы `TELEGRAM_*` переменные.

Что **не** сделано (по спецификации, YAGNI):
- Нет таблицы `tg_subscribers`.
- Нет Telegram-поллера / вебхука.
- Нет HTML-форматирования.
- Воркер не изменён.

---

## Self-Review

### 1. Spec coverage

Проверяю требования спеки `docs/superpowers/specs/2026-07-18-telegram-notifications-design.md` против плана:

| Требование спеки | Покрыто в плане |
|---|---|
| Создать `telegramBot.ts` с `sendTelegramMessage`, `getTelegramChatIds`, `isTelegramEnabled` | Task 2, Steps 2.1 |
| POST на `TELEGRAM_RELAY_URL` с `x-relay-secret` и телом `{ botToken, chatId, text }` | Task 2, Steps 2.1 (код) + Task 1, Steps 1.1 (тест) |
| Таймаут 10с | Task 2, Steps 2.1 (`AbortSignal.timeout(10_000)`) |
| Парсинг `TELEGRAM_CHAT_IDS` через запятую, trim, пустые → `[]` | Task 1 (тесты 1.1) + Task 2 (реализация 2.1) |
| `isTelegramEnabled`: все три env → true | Task 1 (тесты 1.1) + Task 2 (реализация 2.1) |
| Канал молча отключён при отсутствии конфига | Task 2, Steps 2.1 + Task 3, Steps 3.2 (early return) |
| HTTP-ошибка от воркера → `{ ok: false, error }` с префиксом `relay HTTP` | Task 2, Steps 2.1 + Task 1, Steps 1.1 (тест на 500) |
| Сетевая ошибка → `{ ok: false, error }` с текстом | Task 1, Steps 1.1 (тест на ECONNRESET) |
| `broadcastBookingToTelegram` в `notifications.ts` | Task 3, Steps 3.2 (функция) + 3.3 (вызов) |
| Параллельный вызов с MAX через `Promise.allSettled` | Task 3, Steps 3.2 (использован `Promise.allSettled`) |
| `try/catch` вокруг broadcast, ошибки только логируются | Task 3, Steps 3.3 |
| Переиспользовать `formatBookingMessage` из `maxBot.ts` | Task 3, Steps 3.2 (импорт) |
| `chat not found` — логируем, **не деактивируем** (фиксированные id) | Task 3, Steps 3.2 (нет логики unsubscribeUser) |
| Обновить `.env.example` с 4 переменными | Task 4, Steps 4.4 |
| Значения `TELEGRAM_RELAY_URL` и `TELEGRAM_RELAY_SECRET` конкретные | Task 4, Steps 4.4 |
| `TELEGRAM_BOT_TOKEN` пустой | Task 4, Steps 4.4 |
| `TELEGRAM_CHAT_IDS=5750357876,5743780836` | Task 4, Steps 4.4 |
| Без миграции БД | План явно не создаёт миграций (File Structure, раздел «Не трогаем») |
| Без подписчиков, без поллера, без HTML | YAGNI-раздел в Task 5, Steps «Готово» |
| Vitest-тесты с моком `fetch` | Task 1, Steps 1.1 |
| Покрытие: URL, headers, body, парсинг, isTelegramEnabled, error 500, ECONNRESET | Task 1, Steps 1.1 (все 11 тестов) |
| TDD: красные тесты до реализации | Task 1, Steps 1.2 (verify FAIL) + Task 2, Steps 2.2 (verify PASS) |
| Частые коммиты | Task 1.3, 2.3, 3.5, 4.5, 5.8 — 5 коммитов |
| Smoke-тест: создать бронь, проверить оба чата | Task 5, Steps 5.4–5.6 |

**Итог:** все требования спеки покрыты. Пробелов нет.

### 2. Placeholder scan

- ❌ «TBD» / «TODO» / «implement later» — нет.
- ❌ «add appropriate error handling» — нет, ошибки явно покрыты в Task 1 и 2.
- ❌ «similar to Task N» — нет, весь код воспроизведён дословно.
- ❌ Шаги «что делать» без кода — есть один шаг (3.1 — прочитать файл), это разумно, без кода.
- ❌ «Write tests for the above» без самих тестов — нет, все тесты в коде.
- ❌ Ссылки на типы/функции не из плана — есть `makeBooking` в Task 4, упомянуто явно с проверкой «если её нет, посмотри как создаётся объект». Это валидный пограничный случай, не скрытая зависимость.

**Итог:** заглушек нет.

### 3. Type consistency

Проверяю соответствие имён/сигнатур между задачами:

- `sendTelegramMessage(chatId: string, text: string): Promise<SendResult>` — определена в Task 2.1, используется в Task 3.2 и Task 4.2. Сигнатура совпадает везде.
- `getTelegramChatIds(): string[]` — определена в Task 2.1, используется в Task 3.2 и Task 4.2. Тип `string[]` совпадает.
- `isTelegramEnabled(): boolean` — определена в Task 2.1, используется в Task 3.2 и Task 4.2. Совпадает.
- `SendResult { ok, error? }` — определена в Task 2.1, возвращается в `sendTelegramMessage` и используется в Task 3.2 через `r.value.ok` / `r.value.error`. Совпадает.
- `BookingSummary` — импортируется из `maxBot` в Task 3.2 (используется как тип `broadcastBookingToTelegram(booking: BookingSummary)`). Поле `booking.id` используется в логах Task 3.2 и в тестах Task 4.2 — совпадает.
- `formatBookingMessage(booking)` — импортируется из `maxBot`, вызывается в Task 3.2. В Task 4.2 тест проверяет `expect.stringContaining('Новая бронь #100')` — соответствует формату из `maxBot.ts:108-131`.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_RELAY_URL`, `TELEGRAM_RELAY_SECRET`, `TELEGRAM_CHAT_IDS` — имена env-переменных совпадают в Task 1 (тесты), Task 2 (реализация), Task 4 (.env.example) и Task 5 (smoke-тест).

**Итог:** типы и имена консистентны между всеми задачами. Багов из-за рассинхрона нет.

### 4. Прочее

- **TDD соблюдён:** Task 1 пишет тесты и проверяет FAIL, Task 2 пишет реализацию и проверяет PASS. Task 4 пишет интеграционный тест параллельно с обновлением `.env.example` (тест-код там тоже красный до коммита реализации из Task 3, но Task 3 уже выполнен и закоммичен к этому моменту).
- **Файлы в правильных путях:** все пути `backend/src/services/...` соответствуют существующему layout проекта.
- **Длина чанков:** каждый файл секции в пределах 1.5k токенов.
- **Самодостаточность:** код в каждом шаге полный и копипастится буквально.

План готов к сборке.
