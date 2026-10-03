### Task 8: Сделать prerender API-aware и read-only

**Files:**
- Modify: `scripts/prerender.mjs`

- [ ] **Step 1: Зафиксировать текущий RED на data-driven маршруте**

В отдельном терминале запустить backend без выполнения миграций или seed:

```bash
npm run backend:dev
```

В основном терминале выполнить текущую сборку и открыть один сгенерированный `dist/booking/<slug>/index.html`. До добавления proxy ожидается один из дефектов: `Домик не найден`, `Загрузка...` либо отсутствие уникального cottage title/Schema, потому что временный prerender-сервер не обслуживает `/api`.

- [ ] **Step 2: Добавить API target и health check**

В `scripts/prerender.mjs` рядом с `repoRoot` добавить:

```js
const apiTarget = process.env.PRERENDER_API_URL ?? 'http://localhost:3001';

async function assertApiAvailable() {
  const url = new URL('/api/reviews', apiTarget);
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `[prerender] backend API is unavailable at ${url.origin}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(`[prerender] backend API health probe returned HTTP ${response.status}`);
  }
}
```

Сразу перед `let renderedRoutes;` и до вызова `prerenderer.initialize()` выполнить:

```js
await assertApiAvailable();
```

Health check остаётся вне блока, чей `finally` вызывает `prerenderer.destroy()`: при недоступном API временный server ещё не запущен и уничтожать его не нужно.

Сборка должна падать с понятной ошибкой, если backend не запущен, а не сохранять 404/loading HTML.

- [ ] **Step 3: Проксировать API и uploads временным сервером**

Изменить создание `Prerenderer`:

```js
const prerenderer = new Prerenderer({
  staticDir: tempDistDir,
  renderer,
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
    },
  },
});
```

Не добавлять production proxy-конфигурацию: этот server существует только во время Puppeteer capture.

- [ ] **Step 4: Заблокировать запись аналитики во время capture**

В `PuppeteerRenderer.renderRoutes`, сразу после `const page = await this._puppeteer.newPage()`, добавить:

```js
await page.setRequestInterception(true);
page.on('request', (request) => {
  const requestUrl = new URL(request.url());
  if (request.method() === 'POST' && requestUrl.pathname === '/api/analytics/event') {
    void request.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    });
    return;
  }
  void request.continue();
});
```

GET-запросы контента продолжают проксироваться; `POST /api/analytics/event` не достигает backend и не создаёт строки в БД.

- [ ] **Step 5: Отбраковывать loading/not-found HTML**

После получения `bodyText`, но до формирования `result`, добавить:

```js
const bodyText = await page.evaluate(() => document.body.innerText);
const invalidMarkers = route.startsWith('/booking/')
  ? ['Загрузка...', 'Домик не найден']
  : route.startsWith('/seo/')
    ? ['Загружаем…', 'Страница не найдена']
    : route.startsWith('/blog/')
      ? ['Загружаем страницу…', 'Статья не найдена']
      : [];
const marker = invalidMarkers.find((text) => bodyText.includes(text));
if (marker) {
  throw new Error(`[prerender] route ${route} captured invalid state: ${marker}`);
}
```

Получение `html` и `route` оставить после этой проверки.

- [ ] **Step 6: Подтвердить GREEN полной сборкой**

При работающем backend выполнить:

```bash
npm run build
```

Expected: API probe PASS, analytics POST остаётся локально перехваченным, каждый data-driven маршрут сохраняется с реальным содержимым; ни один HTML не содержит loading/not-found markers.

---
