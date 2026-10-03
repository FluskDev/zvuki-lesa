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
