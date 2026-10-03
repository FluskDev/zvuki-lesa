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
