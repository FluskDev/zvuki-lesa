### Task 1A: Зафиксировать контракт PostgreSQL route manifest тестами

**Files:**
- Create: `scripts/fetch-slugs-core.mjs`
- Create: `scripts/fetch-slugs.test.mjs`
- Modify later: `scripts/fetch-slugs.mjs`

- [ ] **Step 1: Написать failing unit-тесты без реальной БД**

Создать `scripts/fetch-slugs.test.mjs`:

```js
import { describe, expect, it, vi } from 'vitest';
import {
  STATIC_ROUTES,
  buildRoutes,
  fetchPublishedRoutes,
  generateRoutes,
} from './fetch-slugs-core.mjs';

function fakeSql(rows = {}) {
  const queries = [];
  const sql = vi.fn((strings) => {
    const query = strings.join('');
    queries.push(query);
    if (query.includes('FROM cottages')) return Promise.resolve(rows.cottages ?? []);
    if (query.includes('FROM seo_pages')) return Promise.resolve(rows.seoPages ?? []);
    if (query.includes('FROM blog_posts')) return Promise.resolve(rows.blogPosts ?? []);
    throw new Error(`Unexpected query: ${query}`);
  });
  sql.end = vi.fn().mockResolvedValue(undefined);
  return { sql, queries };
}

describe('fetch-slugs postgres manifest', () => {
  it('maps slugs, preserves static routes, and removes duplicates', () => {
    expect(buildRoutes({
      cottages: [{ slug: 'shale-uyut' }, { slug: 'shale-uyut' }],
      seoPages: [{ slug: 'otdyh-v-dahovskoy' }],
      blogPosts: [{ slug: 'marshrut-na-rufabgo' }],
    })).toEqual([
      '/', '/blog', '/search',
      '/booking/shale-uyut',
      '/seo/otdyh-v-dahovskoy',
      '/blog/marshrut-na-rufabgo',
    ]);
  });

  it('uses PostgreSQL boolean filters for active and published rows', async () => {
    const { sql, queries } = fakeSql();
    await fetchPublishedRoutes(sql);
    expect(queries).toEqual(expect.arrayContaining([
      expect.stringContaining('WHERE is_active = true'),
      expect.stringContaining('WHERE is_published = true'),
    ]));
    expect(queries.filter((q) => q.includes('WHERE is_published = true'))).toHaveLength(2);
  });

  it('returns static routes without creating a client when DATABASE_URL is absent', async () => {
    const createClient = vi.fn();
    await expect(generateRoutes(undefined, createClient)).resolves.toEqual(STATIC_ROUTES);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('always closes the PostgreSQL client after successful queries', async () => {
    const { sql } = fakeSql({ cottages: [{ slug: 'gorny-dom' }] });
    await expect(generateRoutes('postgres://example', () => sql))
      .resolves.toContain('/booking/gorny-dom');
    expect(sql.end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it('propagates query errors and still closes the PostgreSQL client', async () => {
    const sql = vi.fn().mockRejectedValue(new Error('connection lost'));
    sql.end = vi.fn().mockResolvedValue(undefined);
    await expect(generateRoutes('postgres://example', () => sql))
      .rejects.toThrow('connection lost');
    expect(sql.end).toHaveBeenCalledWith({ timeout: 5 });
  });
});
```

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run:

```bash
npx vitest run scripts/fetch-slugs.test.mjs
```

Expected: FAIL с `Cannot find module './fetch-slugs-core.mjs'`.

- [ ] **Step 3: Установить build-зависимость PostgreSQL и удалить SQLite**

Run:

```bash
npm uninstall better-sqlite3 @types/better-sqlite3 && npm install --save-dev postgres@^3.4.5
```

Expected: `package.json` и `package-lock.json` больше не содержат root direct dependencies `better-sqlite3`/`@types/better-sqlite3`; `postgres` присутствует в `devDependencies`.

---
