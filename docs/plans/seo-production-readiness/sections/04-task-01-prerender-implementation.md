### Task 1B: Реализовать read-only PostgreSQL manifest

**Files:**
- Create: `scripts/fetch-slugs-core.mjs`
- Modify: `scripts/fetch-slugs.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `scripts/fetch-slugs.test.mjs`

- [ ] **Step 1: Реализовать тестируемое ядро**

Создать `scripts/fetch-slugs-core.mjs`:

```js
export const STATIC_ROUTES = ['/', '/blog', '/search'];

export function buildRoutes({ cottages, seoPages, blogPosts }) {
  return [...new Set([
    ...STATIC_ROUTES,
    ...cottages.map(({ slug }) => `/booking/${slug}`),
    ...seoPages.map(({ slug }) => `/seo/${slug}`),
    ...blogPosts.map(({ slug }) => `/blog/${slug}`),
  ])];
}

export async function fetchPublishedRoutes(sql) {
  const [cottages, seoPages, blogPosts] = await Promise.all([
    sql`SELECT slug FROM cottages WHERE is_active = true ORDER BY slug`,
    sql`SELECT slug FROM seo_pages WHERE is_published = true ORDER BY slug`,
    sql`SELECT slug FROM blog_posts WHERE is_published = true ORDER BY slug`,
  ]);
  return buildRoutes({ cottages, seoPages, blogPosts });
}

export async function generateRoutes(databaseUrl, createClient) {
  if (!databaseUrl) return [...STATIC_ROUTES];
  const sql = createClient(databaseUrl);
  try {
    return await fetchPublishedRoutes(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
```

- [ ] **Step 2: Заменить CLI-wrapper `scripts/fetch-slugs.mjs`**

```js
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { generateRoutes } from './fetch-slugs-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', 'backend', '.env');

if (!process.env.DATABASE_URL && existsSync(envPath)) {
  loadEnvFile(envPath);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[fetch-slugs] DATABASE_URL is not set; using static routes only');
}

try {
  const routes = await generateRoutes(
    databaseUrl,
    (url) => postgres(url, { max: 1, onnotice: () => {} }),
  );
  console.log(JSON.stringify(routes));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fetch-slugs] PostgreSQL query failed: ${message}`);
  process.exitCode = 1;
}
```

Не выводить `DATABASE_URL` целиком: он содержит пароль.

- [ ] **Step 3: Запустить unit-тесты и подтвердить GREEN**

Run:

```bash
npx vitest run scripts/fetch-slugs.test.mjs
```

Expected: 5 tests PASS; подключение к реальной PostgreSQL не выполняется.

- [ ] **Step 4: Проверить дерево зависимостей**

Run:

```bash
npm ls postgres better-sqlite3 @types/better-sqlite3 --depth=0
```

Expected: root `postgres@3.x`; `better-sqlite3` и `@types/better-sqlite3` отсутствуют как direct dependencies. Ненулевой код `npm ls` допустим только для запрошенных отсутствующих пакетов.

- [ ] **Step 5: Проверить CLI без записи в БД**

Run:

```bash
npm run prebuild
```

Expected: `.prerender-routes.json` содержит валидный JSON; при доступной БД — активные `/booking/*` и все опубликованные `/seo/*`, `/blog/:slug`. При ошибке настроенного подключения команда завершается ненулевым кодом, а не выпускает урезанный manifest.

---
