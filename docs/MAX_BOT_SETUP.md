# MAX-бот для уведомлений о бронях

Этот документ — полное руководство по MAX-боту проекта «Звуки леса»: как он устроен, как подключить новый аккаунт, как тестировать и что делать при сбоях.

## Что делает бот

При создании брони через сайт (`POST /api/bookings`, `source='site'`) бэкенд рассылает push-уведомление в MAX каждому активному подписчику. Владелец и жена подписываются командой `/join 1501` и получают в ЛС сообщение с гостем, телефоном, датами, услугами и суммой.

Бот работает через long polling: раз в секунду открывает соединение с `GET /updates?timeout=30` и обрабатывает события `message_created` от подписанных пользователей.

## Переменные окружения

В `backend/.env`:

```env
MAX_BOT_TOKEN=<токен_бота>
MAX_JOIN_CODE=1501
MAX_TLS_REJECT_UNAUTHORIZED=false   # по умолчанию false, см. «TLS на Windows»
MAX_DEBUG=false                     # true — подробный лог обновлений
```

| Переменная | Назначение |
|---|---|
| `MAX_BOT_TOKEN` | Токен бота из https://dev.max.ru |
| `MAX_JOIN_CODE` | Кодовое слово для команды `/join`. По умолчанию `1501`. |
| `MAX_TLS_REJECT_UNAUTHORIZED` | Если `true` — включается строгая проверка TLS-сертификата. На Windows dev-машине обычно `false`. |
| `MAX_DEBUG` | Если `true` — логирует структуру каждого update (`update keys=...`, `body=...`). Удобно для отладки. |

Без `MAX_BOT_TOKEN` поллер не запускается, остальной функционал работает.

## Шаг 1. Создание бота

1. Открыть https://dev.max.ru, войти через MAX-аккаунт.
2. В разделе «Боты» → «Создать бота».
3. Задать имя (например, «Звуки леса»), получить токен.
4. Записать токен в `backend/.env` → `MAX_BOT_TOKEN=...`.
5. Перезапустить `npm run backend:dev`. В логах должно появиться `[max] polling started`.

## Шаг 2. Подключение владельца и жены

Каждый, кто хочет получать уведомления, делает в MAX:

1. Открыть чат с ботом (поиск по имени).
2. Отправить `/start` — бот пришлёт приветствие с инструкцией.
3. Отправить `/join 1501` — бот подтвердит «Готово! Теперь вы будете получать уведомления…».

Подписчик сохраняется в таблице `max_subscribers` (`user_id`, `join_code`, `is_active=1`). Чтобы отписаться — `/leave`.

### Повторная подписка после `/leave`

После `/leave` поле `is_active` ставится в `0`, но строка в БД остаётся (для аудита). Повторный `/join 1501` реактивирует ту же запись (благодаря `INSERT OR IGNORE` + `UPDATE … WHERE is_active=0`). Создавать дубль нельзя — есть `UNIQUE(user_id)`.

## Шаг 3. Проверка

Создать на сайте тестовую бронь (можно через форму или POST `/api/bookings`). Все активные подписчики должны получить сообщение вида:

```
🏡 Новая бронь #443

🏠 Шале Уют
👤 Влад Владимирович
📞 +79009892410

📅 Заезд: 12.07.2026
📅 Выезд: 14.07.2026
🌙 2 ночи

🛎 Услуги:
  • Завтрак × 2 — 1 400 ₽

💰 Итого: 12 500 ₽
```

В консоли бэкенда: `[max] notified 1/1 subscribers about booking #443`.

## Архитектура

### Файлы

| Файл | Назначение |
|---|---|
| `backend/src/services/maxBot.ts` | `sendMessage`, `subscribeUser`, `unsubscribeUser`, `getActiveSubscribers`, `formatBookingMessage`, `maxFetch` (TLS-обход) |
| `backend/src/services/maxPoller.ts` | Long polling `/updates`, обработчики `/start`, `/join`, `/leave`, дедуп |
| `backend/src/services/notifications.ts` | `notifyNewBooking` → пишет в `notifications` + рассылает MAX-подписчикам через `broadcastBookingToMax` |
| `backend/src/db/schema.ts` | Таблица `max_subscribers` |
| `backend/drizzle/0002_bent_franklin_storm.sql` | Миграция для `max_subscribers` |

### Реальная структура update (из MAX Bot API)

```json
{
  "update_type": "message_created",
  "timestamp": 1783779689225,
  "user_locale": "ru",
  "message": {
    "recipient": { "chat_id": 10123649, "chat_type": "dialog", "user_id": "361999451" },
    "timestamp": 1783779689225,
    "body": { "mid": "mid.00000000009a7981019f5605b3b26a52", "seq": 116906697824561740, "text": "/start" },
    "sender": { "user_id": 352966106, "first_name": "V", "is_bot": false }
  }
}
```

Ключевые поля:
- `message.body.text` — текст команды
- `message.body.mid` — уникальный ID сообщения (для дедупа)
- `message.sender.user_id` — отправитель (того, кто получит ответ)
- `message.recipient.user_id` — это `user_id` самого бота, не гостя

### Запросы к MAX API

| Операция | Метод | URL | Тело / параметры |
|---|---|---|---|
| Отправить сообщение в ЛС | `POST` | `https://platform-api2.max.ru/messages?user_id=<id>` | `{ "text": "..." }`, заголовок `Authorization: <token>` (без `Bearer`) |
| Получить обновления | `GET` | `https://platform-api2.max.ru/updates?timeout=30&marker=<N>` | — |

Авторизация: `Authorization: <token>` (raw-токен, без префикса `Bearer`).

### Дедупликация

MAX периодически возвращает одно и то же обновление несколько раз подряд (пока наш `marker` не «закрепится»). В `maxPoller.ts` три уровня защиты:

1. **По `body.mid`** — точная дедупликация (если MAX прислал тот же `mid`, второй раз не обрабатываем). Хранит до 500 последних `mid` в `Set`.
2. **По `(userId, text)`** — на случай если у разных событий вдруг разные `mid` (например, ретрай). TTL 5 секунд.
3. **«Уже приветствован» для `/start`** — отдельный `Set<number>` welcomedUsers, чтобы на повторные `/start` через минуту/час бот не отвечал. Сбрасывается через `/leave`.

Если пользователь нажал `/start`, получил приветствие, нажал ещё раз через час — ответа не будет, только лог `[max] skip /start for already-welcomed user <id>` при `MAX_DEBUG=true`.

## Troubleshooting

### Бот не отвечает на `/start`

1. Проверить `[max] polling started` в логах — иначе поллер не запустился (нет токена).
2. Проверить `MAX_DEBUG=true` в `.env`, перезапустить, отправить `/start`. В логах должна быть строка вида `[max] update keys= [...] text= "/start"`.
3. Если строк нет — MAX не отдаёт обновления. Проверить токен, попробовать `curl https://platform-api2.max.ru/updates?timeout=8 -H "Authorization: $TOKEN"`.
4. Если строки есть, но `handleUpdate` падает — добавить `console.log` в `handleUpdate`, посмотреть что приходит в `message`.

### `chat.not.found` при отправке

Если в БД есть `user_id`, для которого в MAX нет диалога с ботом (никогда не открывал чат, удалил бот, или это фантом из тестов), MAX вернёт:

```
{"code":"chat.not.found","message":"Chat with user 888 not found"}
```

Код автоматически деактивирует такого подписчика (`is_active=0`). Если вылезает регулярно — проверить, что тесты не пишут в прод-БД (см. «Изоляция тестов»).

### TLS-ошибка на Windows

```
TypeError: fetch failed
cause: Error: unable to get local issuer certificate
```

Node на Windows не находит системные CA-сертификаты. Обход — `undici` с `rejectUnauthorized: false`. Управляется через `MAX_TLS_REJECT_UNAUTHORIZED=false` (по умолчанию). На проде лучше поставить `true` и прописать корректные CA.

### ECONNRESET во время polling

MAX закрывает соединение по истечении server-side `timeout`. Это штатное поведение, не ошибка. В коде `cause.code === 'ECONNRESET'` явно игнорируется.

Если видишь другие ошибки polling — проверь сеть, токен и rate limit (30 rps на API).

### Дублирование `bookings` (несколько строк с одним check-in)

Форма бронирования на фронте не дебаунсит submit. Если пользователь быстро жмёт «Забронировать» несколько раз, создаётся несколько броней с одинаковыми параметрами. Это **не баг MAX-бота**, а отдельная UX-проблема (решается disable-кнопки после клика или серверным дедупом по `(cottageId, guestName, phone, dates)` в коротком окне).

### Изоляция тестов

`vitest` запускает unit-тесты, которые в `beforeEach` стирают `max_subscribers` и `bookings`. Если тесты работают против прод-БД — подписки и брони пропадают.

Защита: `vitest.setup.ts` создаёт отдельный файл `data/zvuki-lesa.test.db`, применяет миграции. `db/client.ts` под `VITEST=true` открывает именно его.

Если случайно убили прод-данные тестами — пересоздать подписку: пользователь должен снова отправить боту `/join 1501`.

## Безопасность

- Токен **только** в `backend/.env`, никогда в коде, логах или git.
- В логах выводится только `user_id` — не имя, не телефон гостя в момент ошибки MAX-отправки.
- `MAX_JOIN_CODE` держим в секрете от посторонних — иначе кто угодно подпишется на уведомления.

## Операции

### Посмотреть подписчиков

```bash
node -e "const db = require('better-sqlite3')('data/zvuki-lesa.db'); console.log(db.prepare('SELECT user_id, is_active, join_code, joined_at FROM max_subscribers').all());"
```

### Вручную отписать

```bash
node -e "const db = require('better-sqlite3')('data/zvuki-lesa.db'); db.prepare('UPDATE max_subscribers SET is_active = 0 WHERE user_id = ?').run(352966106);"
```

### Сбросить все подписки

```bash
node -e "const db = require('better-sqlite3')('data/zvuki-lesa.db'); db.prepare('DELETE FROM max_subscribers').run();"
```

После сброса все подписчики должны заново сделать `/join 1501`.