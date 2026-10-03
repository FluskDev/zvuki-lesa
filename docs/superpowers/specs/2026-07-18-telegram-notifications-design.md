# Telegram-уведомления о новых бронях

**Дата:** 2026-07-18
**Статус:** черновик → ревью пользователя → план → реализация

## Цель

Добавить второй канал уведомлений о новых бронях с сайта — Telegram. Сейчас уведомления идут только в MAX через подписчиков (`/join 1501`). Нужно, чтобы параллельно с MAX сообщение уходило двум фиксированным получателям в Telegram (владелец + жена).

## Почему через релей, а не напрямую

`api.telegram.org` заблокирован с российских IP на уровне TCP (DNS резолвится, 443/tcp дропается). Сервер `zvukilesa` хостится в РФ — прямые запросы в Telegram не пройдут. Решение — пересылать через Cloudflare Worker с европейским egress, как в проекте «Сайт Вика».

Переиспользуем тот же воркер (`https://lemonadka-tg.ivladok01.workers.dev`). Воркер универсален: принимает `{ botToken, chatId, text }` в теле и просто проксирует в `https://api.telegram.org/bot<token>/sendMessage`. Токен бота и chat_id передаются в теле, а не зашиты в воркере, поэтому один воркер обслуживает оба проекта без изменений.

## Архитектура

```
notifyNewBooking(booking)
  ├─ INSERT в notifications (как было)
  ├─ broadcastBookingToMax(booking)      — уже есть, не трогаем
  └─ broadcastBookingToTelegram(booking) — НОВОЕ
       ├─ getTelegramChatIds()           — парсит TELEGRAM_CHAT_IDS из env
       ├─ text = formatBookingMessage(booking)   — переиспользуем из maxBot.ts
       └─ Promise.allSettled по всем chat_id
```

Оба broadcast'а запускаются `Promise.allSettled`-ом (или последовательно внутри `notifyNewBooking` с `try/catch`) — падение одного канала не влияет на другой. Ошибки Telegram пишутся в `console.error` с префиксом `[tg]`.

## Файлы

### Новые

- **`backend/src/services/telegramBot.ts`** — аналог `maxBot.ts`, но без подписчиков/поллинга:
  - `sendTelegramMessage(chatId, text): Promise<SendResult>` — POST на `TELEGRAM_RELAY_URL` с заголовком `x-relay-secret: <TELEGRAM_RELAY_SECRET>` и JSON-телом `{ botToken: TELEGRAM_BOT_TOKEN, chatId, text }`. Таймаут 10с. Возвращает `{ ok, error? }`.
  - `getTelegramChatIds(): string[]` — парсит `TELEGRAM_CHAT_IDS` (через запятую), фильтрует пустые, возвращает массив строк. Пустая/не заданная → `[]`.
  - `isTelegramEnabled(): boolean` — `true`, если заданы все три: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_RELAY_URL`, `TELEGRAM_RELAY_SECRET`.

- **`backend/src/services/telegramBot.test.ts`** — Vitest. Мокаем глобальный `fetch`:
  - Отправляет POST с правильным URL/headers/body.
  - Рассылает на оба chat_id из `TELEGRAM_CHAT_IDS`.
  - Возвращает пустой массив, если `TELEGRAM_CHAT_IDS` пуст/не задан.
  - Канал отключён при отсутствии любой из трёх переменных.
  - `chat not found` от воркера (HTTP 400 / 404) — логируем, не деактивируем (в отличие от MAX, тут фиксированные id).

### Изменения

- **`backend/src/services/notifications.ts`** — добавляем `broadcastBookingToTelegram(booking)`, вызываем его из `notifyNewBooking` в отдельном `try/catch` рядом с уже существующим блоком для MAX. Никаких изменений в сигнатуре `notifyNewBooking` и в порядке записи в `notifications`.

- **`backend/.env.example`** — добавляем секцию:
  ```
  # ─── Telegram-уведомления (через Cloudflare Worker-релей) ───────────────
  # api.telegram.org недоступен с российских IP, поэтому шлём через воркер.
  # Тот же релей, что у проекта «Сайт Вика» (lemonadka-tg.ivladok01.workers.dev).
  # Нужен НОВЫЙ бот для «Звуков леса» (не бот Вики) — @BotFather в Telegram.
  TELEGRAM_BOT_TOKEN=
  # Chat ID получателей через запятую (владелец, жена). Чтобы узнать свой id:
  # напишите боту @userinfobot или любому вашему боту и посмотрите sender id.
  TELEGRAM_CHAT_IDS=5750357876,5743780836
  TELEGRAM_RELAY_URL=https://lemonadka-tg.ivladok01.workers.dev
  TELEGRAM_RELAY_SECRET=ZRPa9CQjnwyv4MVebmulT5ziBf201SDLs6XrG8NHF7YxkhU3
  ```
  `TELEGRAM_RELAY_URL` и `TELEGRAM_RELAY_SECRET` — конкретные значения, они не являются секретом уровня токена. `TELEGRAM_BOT_TOKEN` остаётся пустым — его заполнит владелец после создания нового бота.

- **`backend/.env`** (реальный, уже в `.gitignore`) — добавить тот же блок, заполнив `TELEGRAM_BOT_TOKEN` от нового бота. Делает владелец.

## Формат сообщения

Переиспользуем `formatBookingMessage(booking)` из `backend/src/services/maxBot.ts` без изменений. Тот же plain-text, та же эмодзи-карточка:
```
🏡 Новая бронь #443
...
```

Никакого HTML/Telegram-специфичного форматирования — воркер передаёт как plain text.

## Поведение при ошибках

| Сценарий | Поведение |
|---|---|
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_RELAY_URL` / `TELEGRAM_RELAY_SECRET` не заданы | Канал молча отключён (как MAX без токена). `broadcastBookingToTelegram` — no-op. |
| `TELEGRAM_CHAT_IDS` пуст | То же — no-op. |
| HTTP-ошибка от воркера (не 2xx) | `SendResult { ok: false, error: 'relay HTTP <status>: <body>' }`, логируем, **не пробрасываем**. Бронь уже в БД. |
| Таймаут / сеть | `SendResult { ok: false, error: <message> }`, логируем. |
| `chat not found` / 400 от Telegram API | Логируем с указанием chat_id. В отличие от MAX, **не деактивируем** — id фиксированные, проблему должен решать владелец. |

## Миграция БД

Не требуется. Существующая таблица `max_subscribers` остаётся как есть — Telegram использует фиксированные chat_id, отдельная таблица не нужна.

## Тесты

`telegramBot.test.ts` пишется **до** реализации (TDD):

1. `sendTelegramMessage` шлёт POST с правильными `url`, `headers: { 'x-relay-secret', 'Content-Type' }` и `body: { botToken, chatId, text }`.
2. `sendTelegramMessage` возвращает `{ ok: false, error: ... }` на HTTP 500 (или 400 с `chat not found`).
3. `getTelegramChatIds` парсит `"1,2,3"` → `["1","2","3"]`, обрезает пробелы, игнорирует пустые.
4. `getTelegramChatIds` возвращает `[]` для не заданной/пустой env.
5. `isTelegramEnabled` — `true` при всех трёх, `false` если любая отсутствует.
6. `broadcastBookingToTelegram` (через `notifications.ts`): без конфига — no-op; с конфигом и двумя chat_id — два вызова `fetch`, оба успешны, оба с `ok: true`.

Сброс env между тестами — `vi.stubEnv` или ручное сохранение/восстановление `process.env`.

## Что НЕ делаем (YAGNI)

- **Нет таблицы подписчиков** (`tg_subscribers`) и команды `/join` — chat_id фиксированные.
- **Нет Telegram-поллера / вебхука** — только исходящие сообщения.
- **Нет HTML-форматирования** (`parse_mode=HTML`) — plain text, как в MAX.
- **Нет отдельного воркера** — переиспользуем воркер Вики.
- **Не трогаем** `maxBot.ts`, `maxPoller.ts`, `notifications.ts`-логику для MAX, схему БД, фронтенд.

## Совместимость и риски

- **Риск 1:** воркер Вики может в любой момент сменить URL или быть отозван. Если переиспользование станет невозможным — выкатываем свой воркер (отдельная задача, не блокирует основную).
- **Риск 2:** `TELEGRAM_RELAY_SECRET` в `.env.example` — не настоящий секрет (а только пароль релея), но лучше хранить релейный секрет так же, как токен. Решение: оставляем в `.env.example` для удобства dev-окружения; в `.env` (gitignored) копируется автоматически. Документируем предупреждение: при смене релея — обновить оба файла.
- **Риск 3:** MAX и Telegram шлют в одном порядке, но независимо. Если MAX сломан — Telegram всё равно придёт. Это сделано осознанно: «шум лучше тишины для владельца».

## Порядок внедрения

1. Заполнить `backend/.env` реальным `TELEGRAM_BOT_TOKEN` (владелец создаёт нового бота через @BotFather).
2. Создать `backend/src/services/telegramBot.test.ts` (red).
3. Создать `backend/src/services/telegramBot.ts` (green).
4. Обновить `backend/src/services/notifications.ts` — добавить `broadcastBookingToTelegram`.
5. Обновить `backend/.env.example`.
6. Прогнать `npm run backend:test`.
7. Локально создать тестовую бронь через `POST /api/bookings` — проверить, что сообщение пришло в оба чата.
