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
