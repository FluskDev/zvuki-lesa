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
