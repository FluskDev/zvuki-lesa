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
