# SEO Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подготовить SEO-контур к production-сборке: получать prerender-маршруты из PostgreSQL, формировать корректные metadata и JSON-LD для главной и домиков и проверять итоговый статический HTML.

**Architecture:** Root prebuild напрямую и только на чтение запрашивает опубликованные slug из PostgreSQL и формирует manifest для Puppeteer-prerender. React-маршруты владеют своими metadata и Schema.org-разметкой через расширенный `useDocumentHead`; данные отзывов загружаются один раз на главной и используются одновременно UI и структурированными данными. Production-БД и reverse proxy не изменяются — для них формируется проверочный чек-лист.

**Tech Stack:** React 19, React Router 6, TypeScript 5.9, Vite 7, Vitest 4, Testing Library, PostgreSQL 18, `postgres` 3, Puppeteer 25, Schema.org JSON-LD.

---

## Scope Check

Работа образует один связанный SEO-поток: PostgreSQL определяет набор prerender-маршрутов, React формирует route-specific `<head>`, а Puppeteer сохраняет результат в HTML. Разбивать это на независимые планы не нужно, потому что критерий готовности проверяется только сквозной production-сборкой.

План не изменяет данные PostgreSQL, миграции, публикационный статус контента, reverse proxy и внешние панели вебмастеров. Запросы prebuild только читают `cottages`, `seo_pages` и `blog_posts`. Коммиты не входят в шаги: их можно создать только по отдельной явной команде пользователя.

## File Structure

### Создать

- `scripts/fetch-slugs-core.mjs` — тестируемая read-only логика PostgreSQL-запросов, нормализации маршрутов и закрытия клиента.
- `scripts/fetch-slugs.test.mjs` — unit-тесты формирования route manifest без подключения к реальной БД.
- `src/lib/structuredData.ts` — чистые builders главной и cottage JSON-LD; общие константы организации и абсолютных URL.
- `src/lib/structuredData.test.ts` — проверка Schema.org с отзывами, без отзывов и с неполными cottage-данными.
- `src/pages/HomePage.tsx` — домашний маршрут, единичная загрузка отзывов, metadata, Schema и композиция существующих секций.
- `src/pages/HomePage.test.tsx` — интеграция данных отзывов с UI и `<head>` без повторного запроса.
- `src/pages/booking/BookingPage.test.tsx` — metadata, JSON-LD и `noindex` для 404.
- `public/og-image.jpg` — статический social preview 1200×630.

### Изменить

- `package.json` — заменить root build-зависимости SQLite на `postgres`.
- `package-lock.json` — зафиксировать обновлённое дерево root-зависимостей.
- `scripts/fetch-slugs.mjs` — загрузка окружения, read-only PostgreSQL-запросы, строгая обработка ошибок и закрытие соединения.
- `scripts/prerender.mjs` — proxy `/api` и `/uploads` к отдельно запущенному backend, блокировка analytics POST и проверка data-driven HTML.
- `src/lib/seo.ts` — robots, Open Graph и Twitter metadata с предсказуемыми fallback-значениями.
- `src/lib/seo.test.ts` — TDD-покрытие расширенного `useDocumentHead`.
- `src/App.tsx` — заменить inline-разметку `/` на `HomePage`.
- `src/sections/Reviews.tsx` — принимать уже загруженные данные и больше не владеть Schema или `useReviews`.
- `src/pages/booking/BookingPage.tsx` — route-specific metadata, `Accommodation` graph и 404 robots.
- `src/pages/seo/SeoPage.tsx` — убрать эффект, удаляющий собственную JSON-LD после загрузки.
- `src/pages/blog/BlogPost.tsx` — убрать эффект, удаляющий собственную Article JSON-LD после загрузки.
- `index.html` — удалить JSON-LD главной, сохранив базовые fallback meta-теги.

### Генерируемые, не редактировать вручную

- `.prerender-routes.json` — stdout `fetch-slugs.mjs`.
- `dist/**/index.html` — результат Vite + Puppeteer prerender.

## Порядок задач

1. PostgreSQL route manifest.
2. Расширение `useDocumentHead`.
3. Чистые JSON-LD builders.
4. Главная страница и удаление глобальной Schema.
5. SEO страницы домика.
6. Open Graph asset.
7. API-aware prerender без аналитических записей.
8. Сквозная локальная проверка и production-чек-лист.

---

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

### Task 2: Расширить `useDocumentHead` для route-specific metadata

**Files:**
- Modify: `src/lib/seo.ts`
- Modify: `src/lib/seo.test.ts`

- [ ] **Step 1: Добавить failing-тесты хука**

В `src/lib/seo.test.ts` добавить импорты `afterEach` из `vitest` и `renderHook` из `@testing-library/react`, затем тесты:

```ts
describe('useDocumentHead', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('sets canonical, robots and social fallbacks', () => {
    const { unmount } = renderHook(() => useDocumentHead({
      title: 'Шале Уют',
      description: 'Домик в Даховской',
      canonical: 'https://zvuki-lesa.ru/booking/shale-uyut',
      ogImage: 'https://zvuki-lesa.ru/cabin.jpg',
    }));

    expect(document.title).toBe('Шале Уют');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://zvuki-lesa.ru/booking/shale-uyut',
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content', 'index, follow, max-snippet:-1, max-image-preview:large',
    );
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'Шале Уют');
    expect(document.querySelector('meta[property="og:description"]')).toHaveAttribute('content', 'Домик в Даховской');
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute('content', 'https://zvuki-lesa.ru/booking/shale-uyut');
    expect(document.querySelector('meta[name="twitter:image"]')).toHaveAttribute('content', 'https://zvuki-lesa.ru/cabin.jpg');
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    unmount();
  });

  it('supports explicit social values and noindex', () => {
    renderHook(() => useDocumentHead({
      title: 'Не найдено',
      robots: 'noindex, nofollow',
      ogTitle: 'OG title',
      ogDescription: 'OG description',
      ogUrl: 'https://zvuki-lesa.ru/missing',
      twitterTitle: 'Twitter title',
      twitterDescription: 'Twitter description',
      twitterUrl: 'https://zvuki-lesa.ru/missing',
      twitterImage: 'https://zvuki-lesa.ru/twitter.jpg',
    }));
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'OG title');
    expect(document.querySelector('meta[name="twitter:title"]')).toHaveAttribute('content', 'Twitter title');
  });

  it('removes managed schema on unmount', () => {
    const unmanaged = document.createElement('script');
    unmanaged.type = 'application/ld+json';
    document.head.appendChild(unmanaged);
    const { unmount } = renderHook(() => useDocumentHead({ schema: { '@type': 'Thing' } }));
    expect(document.querySelectorAll('script[data-seo-schema]')).toHaveLength(1);
    unmount();
    expect(document.querySelectorAll('script[data-seo-schema]')).toHaveLength(0);
    expect(document.head).toContainElement(unmanaged);
  });
});
```

Импортировать `useDocumentHead` вместе с существующими функциями из `./seo`.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/lib/seo.test.ts`

Expected: FAIL — social/robots поля отсутствуют в `DocumentHead` и DOM.

- [ ] **Step 3: Реализовать минимальное расширение**

В `DocumentHead` добавить:

```ts
robots?: string;
ogTitle?: string;
ogDescription?: string;
ogUrl?: string;
twitterTitle?: string;
twitterDescription?: string;
twitterUrl?: string;
twitterImage?: string;
```

В effect вычислить fallback-значения и установить metadata:

```ts
const robots = head.robots ?? 'index, follow, max-snippet:-1, max-image-preview:large';
const ogTitle = head.ogTitle ?? head.title;
const ogDescription = head.ogDescription ?? head.description;
const ogUrl = head.ogUrl ?? head.canonical;
const twitterTitle = head.twitterTitle ?? ogTitle;
const twitterDescription = head.twitterDescription ?? ogDescription;
const twitterUrl = head.twitterUrl ?? ogUrl;
const twitterImage = head.twitterImage ?? head.ogImage;

setMeta('robots', robots);
if (ogTitle) setMeta('og:title', ogTitle, 'property');
if (ogDescription) setMeta('og:description', ogDescription, 'property');
if (ogUrl) setMeta('og:url', ogUrl, 'property');
if (head.ogImage) setMeta('og:image', head.ogImage, 'property');
if (twitterTitle) setMeta('twitter:title', twitterTitle);
if (twitterDescription) setMeta('twitter:description', twitterDescription);
if (twitterUrl) setMeta('twitter:url', twitterUrl);
if (twitterImage) {
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:image', twitterImage);
}
```

Заменить dependency array effect на точный список:

```ts
}, [
  head.title,
  head.description,
  head.canonical,
  head.ogImage,
  head.robots,
  head.ogTitle,
  head.ogDescription,
  head.ogUrl,
  head.twitterTitle,
  head.twitterDescription,
  head.twitterUrl,
  head.twitterImage,
  schemaKey,
]);
```

- [ ] **Step 4: Подтвердить GREEN**

Run: `npx vitest run src/lib/seo.test.ts`

Expected: все старые pure-function тесты и новые тесты `useDocumentHead` PASS.

---

### Task 3A: Зафиксировать контракт JSON-LD builders тестами

**Files:**
- Create: `src/lib/structuredData.ts`
- Create: `src/lib/structuredData.test.ts`

- [ ] **Step 1: Создать полные fixtures и failing-тесты**

Создать `src/lib/structuredData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Cottage, ReviewsResponse } from './api';
import { buildCottageStructuredData, buildHomeStructuredData } from './structuredData';

const reviews: ReviewsResponse = {
  averageRating: 4.8,
  total: 1,
  yandexReviewsUrl: 'https://yandex.ru/maps/example',
  items: [{
    id: 1,
    authorName: 'Анна',
    rating: 5,
    text: 'Очень уютно',
    date: '2026-07-01',
    source: 'yandex',
    isPublished: true,
    avatarUrl: null,
    authorUrl: null,
  }],
};

const cottage: Cottage = {
  id: 7,
  slug: 'shale-uyut',
  mapId: 'Домик1',
  name: 'Шале Уют',
  shortDescription: 'Уютный домик у леса',
  longDescription: 'Домик для семейного отдыха в Даховской',
  description: '',
  houseRules: '',
  basePrice: 6500,
  area: 42,
  guests: 4,
  bedrooms: 1,
  beds: { double: 1, single: 2 },
  checkInTime: '14:00',
  checkOutTime: '12:00',
  mainImage: '/Домик 1/Главная.jpg',
  amenities: ['Wi-Fi', 'Парковка'],
  gallery: ['/Домик 1/Главная.jpg', '/Домик 1/Кухня.jpg'],
  images: [],
  recreation: [],
};

describe('buildHomeStructuredData', () => {
  it('publishes one complete LodgingBusiness with real reviews', () => {
    const schema = buildHomeStructuredData(reviews);
    const businesses = schema['@graph'].filter((node) => node['@type'] === 'LodgingBusiness');
    expect(businesses).toHaveLength(1);
    expect(businesses[0]).toMatchObject({
      name: 'Звуки Леса',
      aggregateRating: { ratingValue: 4.8, reviewCount: 1 },
      review: [{ author: { name: 'Анна' }, reviewBody: 'Очень уютно' }],
    });
    expect(schema['@graph'].map((node) => node['@type'])).toEqual(
      expect.arrayContaining(['BreadcrumbList', 'FAQPage', 'ImageObject']),
    );
  });

  it('omits fictitious ratings when reviews are unavailable', () => {
    const schema = buildHomeStructuredData(null);
    const business = schema['@graph'].find((node) => node['@type'] === 'LodgingBusiness');
    expect(business).not.toHaveProperty('aggregateRating');
    expect(business).not.toHaveProperty('review');
    expect(JSON.stringify(schema)).not.toContain('"reviewCount":50');
  });
});

describe('buildCottageStructuredData', () => {
  it('links LodgingBusiness, Accommodation, Offer and breadcrumbs', () => {
    const schema = buildCottageStructuredData(cottage);
    const types = schema['@graph'].map((node) => node['@type']);
    expect(types).toEqual(expect.arrayContaining([
      'LodgingBusiness', 'Accommodation', 'Offer', 'BreadcrumbList',
    ]));
    const accommodation = schema['@graph'].find((node) => node['@type'] === 'Accommodation');
    expect(accommodation).toMatchObject({
      name: 'Шале Уют',
      url: 'https://zvuki-lesa.ru/booking/shale-uyut',
      occupancy: { maxValue: 4 },
      floorSize: { value: 42, unitCode: 'MTK' },
    });
    expect(accommodation?.image?.[0]).toContain('%D0%94%D0%BE%D0%BC%D0%B8%D0%BA');
    expect(accommodation?.amenityFeature).toHaveLength(2);
  });

  it('omits empty image and amenity collections', () => {
    const schema = buildCottageStructuredData({
      ...cottage,
      mainImage: '',
      gallery: [],
      images: [],
      amenities: [],
    });
    const accommodation = schema['@graph'].find((node) => node['@type'] === 'Accommodation');
    expect(accommodation).not.toHaveProperty('image');
    expect(accommodation).not.toHaveProperty('amenityFeature');
  });
});
```

Тип возврата builders определить как `Record<string, any>` только временно нельзя. В реализации экспортировать явные локальные JSON-LD-типы, чтобы обращения `schema['@graph']` и `node['@type']` проверялись TypeScript.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/lib/structuredData.test.ts`

Expected: FAIL с `Cannot find module './structuredData'`.

---

### Task 3B: Реализовать общую и домашнюю JSON-LD-разметку

**Files:**
- Create: `src/lib/structuredData.ts`
- Test: `src/lib/structuredData.test.ts`

- [ ] **Step 1: Добавить типы, константы и общий LodgingBusiness**

Начать `src/lib/structuredData.ts` следующим кодом:

```ts
import type { Cottage, ReviewsResponse } from './api';

export interface JsonLdNode {
  '@type': string;
  '@id'?: string;
  image?: string[];
  amenityFeature?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface JsonLdGraph {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
}

const BASE_URL = 'https://zvuki-lesa.ru';
const LODGING_ID = `${BASE_URL}/#lodging`;

export function absoluteSiteUrl(path: string): string {
  return new URL(path, `${BASE_URL}/`).href;
}

function lodgingBusiness(extra: Partial<JsonLdNode> = {}): JsonLdNode {
  return {
    '@type': 'LodgingBusiness',
    '@id': LODGING_ID,
    name: 'Звуки Леса',
    alternateName: 'Гостевой дом Звуки леса',
    description: 'Гостевой дом с уютными домиками в станице Даховская, Республика Адыгея.',
    url: BASE_URL,
    telephone: '+79282110249',
    email: 'booking@zvuki-lesa.ru',
    image: [`${BASE_URL}/og-image.jpg`],
    priceRange: '₽₽',
    petsAllowed: true,
    checkinTime: '14:00',
    checkoutTime: '12:00',
    numberOfRooms: 3,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Короткая улица, 17',
      addressLocality: 'станица Даховская',
      addressRegion: 'Республика Адыгея',
      postalCode: '385700',
      addressCountry: 'RU',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 44.22314,
      longitude: 40.199615,
    },
    sameAs: [
      'https://www.instagram.com/zvukilesa01/',
      'https://t.me/ZVUKILESA01',
    ],
    ...extra,
  };
}
```

- [ ] **Step 2: Добавить builder главной без фиктивных отзывов**

Продолжить тот же файл:

```ts
export function buildHomeStructuredData(reviews: ReviewsResponse | null): JsonLdGraph {
  const rating = reviews && reviews.total > 0 && reviews.items.length > 0
    ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: reviews.averageRating,
          reviewCount: reviews.total,
          bestRating: 5,
          worstRating: 1,
        },
        review: reviews.items.map((review) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: review.authorName },
          datePublished: review.date,
          reviewBody: review.text,
          reviewRating: {
            '@type': 'Rating',
            ratingValue: review.rating,
            bestRating: 5,
            worstRating: 1,
          },
        })),
      }
    : {};

  return {
    '@context': 'https://schema.org',
    '@graph': [
      lodgingBusiness(rating),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Домики', item: `${BASE_URL}/#cabins` },
          { '@type': 'ListItem', position: 3, name: 'Услуги', item: `${BASE_URL}/#services` },
          { '@type': 'ListItem', position: 4, name: 'Контакты', item: `${BASE_URL}/#contacts` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          ['В какое время заезд и выезд?', 'Заезд в 14:00, выезд в 12:00.'],
          ['Можно ли отменить бронирование?', 'Отмена возможна за 3 дня до заезда. Подробности по телефону.'],
          ['Есть ли Wi-Fi?', 'Да, Wi-Fi есть во всех домиках.'],
          ['Можно ли с животными?', 'По предварительной договорённости. Свяжитесь с нами.'],
          ['Как добраться?', 'Станица Даховская, Короткая улица, 17. Координаты: 44.223140, 40.199615.'],
          ['Какие услуги включены?', 'Джиппинг, рафтинг и банный чан оплачиваются отдельно.'],
        ].map(([name, text]) => ({
          '@type': 'Question',
          name,
          acceptedAnswer: { '@type': 'Answer', text },
        })),
      },
      {
        '@type': 'ImageObject',
        name: 'Гостевой дом Звуки Леса',
        description: 'Домики в горах Адыгеи',
        url: `${BASE_URL}/og-image.jpg`,
        contentUrl: `${BASE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
      },
    ],
  };
}
```

Не добавлять `starRating` и статический `aggregateRating`: рейтинг существует только при реальном ответе API.

---

### Task 3C: Реализовать cottage JSON-LD и завершить GREEN

**Files:**
- Modify: `src/lib/structuredData.ts`
- Test: `src/lib/structuredData.test.ts`

- [ ] **Step 1: Добавить builder конкретного домика**

В конец `src/lib/structuredData.ts` добавить:

```ts
export function buildCottageStructuredData(cottage: Cottage): JsonLdGraph {
  const canonical = `${BASE_URL}/booking/${cottage.slug}`;
  const accommodationId = `${canonical}#accommodation`;
  const offerId = `${canonical}#offer`;
  const images = [...new Set([
    cottage.mainImage,
    ...cottage.gallery,
    ...cottage.images.map((image) => image.url),
  ].filter(Boolean))].map(absoluteSiteUrl);

  const accommodation: JsonLdNode = {
    '@type': 'Accommodation',
    '@id': accommodationId,
    name: cottage.name,
    description: cottage.longDescription || cottage.shortDescription,
    url: canonical,
    containedInPlace: { '@id': LODGING_ID },
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: cottage.guests,
    },
    floorSize: {
      '@type': 'QuantitativeValue',
      value: cottage.area,
      unitCode: 'MTK',
    },
    numberOfBedrooms: cottage.bedrooms,
    petsAllowed: true,
    checkinTime: cottage.checkInTime,
    checkoutTime: cottage.checkOutTime,
    offers: { '@id': offerId },
  };

  if (images.length > 0) accommodation.image = images;
  if (cottage.amenities.length > 0) {
    accommodation.amenityFeature = cottage.amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    }));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      lodgingBusiness(),
      accommodation,
      {
        '@type': 'Offer',
        '@id': offerId,
        url: canonical,
        price: cottage.basePrice,
        priceCurrency: 'RUB',
        unitText: 'ночь',
        availability: 'https://schema.org/InStock',
        itemOffered: { '@id': accommodationId },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Домики', item: `${BASE_URL}/#cabins` },
          { '@type': 'ListItem', position: 3, name: cottage.name, item: canonical },
        ],
      },
    ],
  };
}
```

- [ ] **Step 2: Запустить focused tests**

Run:

```bash
npx vitest run src/lib/structuredData.test.ts
```

Expected: 4 tests PASS. В JSON нет пустых `image`/`amenityFeature`, а URL с кириллицей корректно percent-encoded через `new URL()`.

- [ ] **Step 3: Проверить TypeScript типов Schema**

Run:

```bash
npx tsc -b --pretty false
```

Expected: PASS. Если TypeScript укажет на optional `image` в тесте, использовать уже предусмотренный optional access `accommodation?.image?.[0]`, а не ослаблять тип до `any`.

---

### Task 4A: Зафиксировать интеграцию главной страницы тестом

**Files:**
- Create: `src/pages/HomePage.test.tsx`
- Create later: `src/pages/HomePage.tsx`
- Modify later: `src/sections/Reviews.tsx`
- Modify later: `src/App.tsx`
- Modify later: `index.html`

- [ ] **Step 1: Написать isolated route test**

Создать `src/pages/HomePage.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import type { ReviewsResponse } from '@/lib/api';
import { HomePage } from './HomePage';

const mocks = vi.hoisted(() => ({
  useReviews: vi.fn(),
  reviewsSection: vi.fn(),
}));

vi.mock('@/hooks/useReviews', () => ({ useReviews: mocks.useReviews }));
vi.mock('@/sections/Navigation', () => ({ Navigation: () => <div /> }));
vi.mock('@/sections/Hero', () => ({ Hero: () => <div /> }));
vi.mock('@/sections/Cabins', () => ({ Cabins: () => <div /> }));
vi.mock('@/sections/Services', () => ({ Services: () => <div /> }));
vi.mock('@/sections/About', () => ({ About: () => <div /> }));
vi.mock('@/sections/Amenities', () => ({ Amenities: () => <div /> }));
vi.mock('@/sections/ContactUsLanding', () => ({ ContactUsLanding: () => <div /> }));
vi.mock('@/sections/Reviews', () => ({
  Reviews: (props: unknown) => {
    mocks.reviewsSection(props);
    return <div data-testid="reviews" />;
  },
}));
vi.mock('@/components/SnapScroll/SnapScroll', () => ({
  SnapScroll: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/SectionNav/SectionNav', () => ({ SectionNav: () => <div /> }));
vi.mock('@/components/StickyFooter/StickyFooter', () => ({ StickyFooter: () => <div /> }));

const reviews: ReviewsResponse = {
  averageRating: 4.9,
  total: 1,
  yandexReviewsUrl: null,
  items: [{
    id: 1,
    authorName: 'Анна',
    rating: 5,
    text: 'Прекрасный отдых',
    date: '2026-07-01',
    source: 'yandex',
    isPublished: true,
    avatarUrl: null,
    authorUrl: null,
  }],
};

afterEach(() => {
  document.head.innerHTML = '';
  mocks.useReviews.mockReset();
  mocks.reviewsSection.mockReset();
});

describe('HomePage SEO', () => {
  it('loads reviews once and shares them with UI and one LodgingBusiness schema', () => {
    mocks.useReviews.mockReturnValue({ data: reviews, loading: false, error: null });
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(mocks.useReviews).toHaveBeenCalledTimes(1);
    expect(mocks.reviewsSection).toHaveBeenCalledWith(
      expect.objectContaining({ data: reviews, loading: false }),
    );
    const scripts = [...document.querySelectorAll('script[data-seo-schema]')];
    const schemas = scripts.map((script) => JSON.parse(script.textContent ?? '{}'));
    const businesses = schemas.flatMap((schema) => schema['@graph'] ?? [])
      .filter((node) => node['@type'] === 'LodgingBusiness');
    expect(businesses).toHaveLength(1);
    expect(businesses[0].aggregateRating.reviewCount).toBe(1);
    expect(document.title).toContain('Звуки Леса');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://zvuki-lesa.ru/',
    );
  });

  it('keeps route-specific JSON-LD out of the SPA shell', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).not.toContain('type="application/ld+json"');
  });
});
```

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/pages/HomePage.test.tsx`

Expected: FAIL с `Cannot find module './HomePage'`.

---

### Task 4B: Реализовать владельца SEO главного маршрута

**Files:**
- Create: `src/pages/HomePage.tsx`
- Modify: `src/sections/Reviews.tsx`
- Modify: `src/App.tsx`
- Modify: `index.html`
- Test: `src/pages/HomePage.test.tsx`

- [ ] **Step 1: Создать `HomePage` и загрузить отзывы один раз**

Создать `src/pages/HomePage.tsx`:

```tsx
import { Navigation } from '@/sections/Navigation';
import { Hero } from '@/sections/Hero';
import { Cabins } from '@/sections/Cabins';
import { Services } from '@/sections/Services';
import { About } from '@/sections/About';
import { Amenities } from '@/sections/Amenities';
import { Reviews } from '@/sections/Reviews';
import { ContactUsLanding } from '@/sections/ContactUsLanding';
import { SnapScroll } from '@/components/SnapScroll/SnapScroll';
import { SectionNav } from '@/components/SectionNav/SectionNav';
import { StickyFooter } from '@/components/StickyFooter/StickyFooter';
import { useReviews } from '@/hooks/useReviews';
import { useDocumentHead } from '@/lib/seo';
import { buildHomeStructuredData } from '@/lib/structuredData';

const title = 'Звуки Леса — Аренда домиков в станице Даховская | Адыгея';
const description = 'Уютные домики в станице Даховская: горный отдых, рафтинг, джиппинг и банный чан. Бронирование гостевого дома «Звуки Леса».';
const canonical = 'https://zvuki-lesa.ru/';
const ogImage = 'https://zvuki-lesa.ru/og-image.jpg';

export function HomePage() {
  const { data, loading } = useReviews();

  useDocumentHead({
    title,
    description,
    canonical,
    ogImage,
    robots: 'index, follow, max-snippet:-1, max-image-preview:large',
    schema: buildHomeStructuredData(data),
  });

  return (
    <>
      <div className="snap-scroll-wrapper">
        <SnapScroll>
          <Navigation />
          <main>
            <Hero />
            <Cabins />
            <Services />
            <About />
            <Amenities />
            <Reviews data={data} loading={loading} />
            <ContactUsLanding />
          </main>
        </SnapScroll>
      </div>
      <SectionNav />
      <StickyFooter />
    </>
  );
}
```

- [ ] **Step 2: Сделать `Reviews` презентационной секцией**

В `src/sections/Reviews.tsx` удалить импорты `useReviews` и `useDocumentHead`, а также блок построения Schema строк 22–55. Добавить:

```ts
import type { ReviewsResponse } from '@/lib/api';

interface ReviewsProps {
  data: ReviewsResponse | null;
  loading: boolean;
}

export function Reviews({ data, loading }: ReviewsProps) {
```

Существующие вычисления `reviews`, `totalPages`, пагинация и JSX оставить без изменений.

- [ ] **Step 3: Подключить `HomePage` в маршрутизатор**

В `src/App.tsx` удалить импорты секций главной, `SnapScroll`, `SectionNav` и `StickyFooter`; добавить:

```ts
import { HomePage } from '@/pages/HomePage';
```

Заменить весь inline `<Route path="/" ... />` на:

```tsx
<Route path="/" element={<HomePage />} />
```

Остальные маршруты не менять.

- [ ] **Step 4: Удалить route-specific Schema из SPA shell**

Из `index.html` удалить целиком четыре блока от комментария `<!-- Structured Data: Organization -->` до закрывающего `</script>` блока `ImageObject` включительно. Не удалять title, description, canonical, Open Graph, Twitter, geo tags, шрифты и Yandex Maps script.

После изменения в `index.html` не должно остаться ни одного `script[type="application/ld+json"]`.

- [ ] **Step 5: Запустить focused test и TypeScript**

Run:

```bash
npx vitest run src/pages/HomePage.test.tsx && npx tsc -b --pretty false
```

Expected: 2 tests PASS; TypeScript PASS; `Reviews` больше не выполняет второй запрос и не создаёт отдельную Schema.

---

### Task 5A: Зафиксировать SEO страницы домика тестами

**Files:**
- Create: `src/pages/booking/BookingPage.test.tsx`
- Modify later: `src/pages/booking/BookingPage.tsx`

- [ ] **Step 1: Создать isolated tests успешной загрузки и 404**

Создать `src/pages/booking/BookingPage.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Cottage } from '@/lib/api';
import { getCottage } from '@/lib/api';
import { BookingPage } from './BookingPage';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, getCottage: vi.fn() };
});
vi.mock('./TopBar', () => ({ TopBar: () => <div /> }));
vi.mock('./BookingHero', () => ({ BookingHero: () => <div /> }));
vi.mock('./BookingInfo', () => ({ BookingInfo: () => <div /> }));
vi.mock('./BookingAmenities', () => ({ BookingAmenities: () => <div /> }));
vi.mock('./BookingRecreation', () => ({ BookingRecreation: () => <div /> }));
vi.mock('./BookingAbout', () => ({ BookingAbout: () => <div /> }));
vi.mock('./BookingMap', () => ({ BookingMap: () => <div /> }));
vi.mock('./NearbyAttractions', () => ({ NearbyAttractions: () => <div /> }));

const mockGetCottage = vi.mocked(getCottage);
const cottage: Cottage = {
  id: 7,
  slug: 'shale-uyut',
  mapId: 'Домик1',
  name: 'Шале Уют',
  shortDescription: 'Уютный домик у леса',
  longDescription: 'Семейный отдых в станице Даховская',
  description: '',
  houseRules: '',
  basePrice: 6500,
  area: 42,
  guests: 4,
  bedrooms: 1,
  beds: { double: 1, single: 2 },
  checkInTime: '14:00',
  checkOutTime: '12:00',
  mainImage: '/cabin-1-enhanced.jpg',
  amenities: ['Wi-Fi'],
  gallery: [],
  images: [],
  recreation: [],
};

function renderPage(slug = 'shale-uyut') {
  return render(
    <MemoryRouter initialEntries={[`/booking/${slug}`]}>
      <Routes><Route path="/booking/:cabinId" element={<BookingPage />} /></Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  mockGetCottage.mockReset();
  document.head.innerHTML = '';
  document.title = '';
});

describe('BookingPage SEO', () => {
  it('sets unique metadata and linked cottage JSON-LD', async () => {
    mockGetCottage.mockResolvedValue({ success: true, data: { cottage } });
    renderPage();

    await waitFor(() => expect(document.title).toContain('Шале Уют'));
    expect(document.title).toContain('Даховская');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://zvuki-lesa.ru/booking/shale-uyut',
    );
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content', 'https://zvuki-lesa.ru/cabin-1-enhanced.jpg',
    );
    const schema = JSON.parse(
      document.querySelector('script[data-seo-schema]')?.textContent ?? '{}',
    );
    expect(schema['@graph'].map((node: { '@type': string }) => node['@type']))
      .toEqual(expect.arrayContaining([
        'LodgingBusiness', 'Accommodation', 'Offer', 'BreadcrumbList',
      ]));
  });

  it('marks a missing cottage noindex and publishes no schema', async () => {
    mockGetCottage.mockResolvedValue({ success: false, error: 'Not found' });
    renderPage('missing');

    await screen.findByRole('heading', { name: 'Домик не найден' });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content', 'noindex, nofollow',
    );
    expect(document.querySelector('script[data-seo-schema]')).not.toBeInTheDocument();
  });
});
```

Реальные Yandex Map и календарные компоненты здесь намеренно замоканы: тест проверяет только контракт SEO маршрута.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/pages/booking/BookingPage.test.tsx`

Expected: FAIL — `BookingPage` пока не устанавливает route-specific metadata и JSON-LD.

---

### Task 5B: Реализовать metadata и Schema страницы домика

**Files:**
- Modify: `src/pages/booking/BookingPage.tsx`
- Test: `src/pages/booking/BookingPage.test.tsx`

- [ ] **Step 1: Подключить SEO-зависимости**

В `src/pages/booking/BookingPage.tsx` добавить:

```ts
import { useDocumentHead, type DocumentHead } from '@/lib/seo';
import {
  absoluteSiteUrl,
  buildCottageStructuredData,
} from '@/lib/structuredData';
```

- [ ] **Step 2: Вычислять head до всех ранних return**

Сразу после effect загрузки и до `if (loading)` добавить:

```ts
  const requestedCanonical = `https://zvuki-lesa.ru/booking/${cabinId ?? ''}`;
  let head: DocumentHead;

  if (cottage) {
    const canonical = `https://zvuki-lesa.ru/booking/${cottage.slug}`;
    const description = [
      cottage.shortDescription,
      `${cottage.area} м², до ${cottage.guests} гостей`,
      `от ${cottage.basePrice.toLocaleString('ru-RU')} ₽ за ночь`,
    ].join('. ');

    head = {
      title: `${cottage.name} — аренда домика в Даховской | Звуки Леса`,
      description,
      canonical,
      ogImage: absoluteSiteUrl(cottage.mainImage || '/og-image.jpg'),
      robots: 'index, follow, max-snippet:-1, max-image-preview:large',
      schema: buildCottageStructuredData(cottage),
    };
  } else if (notFound) {
    head = {
      title: 'Домик не найден | Звуки Леса',
      description: 'Запрошенный домик не найден.',
      canonical: requestedCanonical,
      robots: 'noindex, nofollow',
    };
  } else {
    head = {
      title: 'Загрузка домика | Звуки Леса',
      canonical: requestedCanonical,
      robots: 'noindex, follow',
    };
  }

  useDocumentHead(head);
```

Хук вызывается ровно один раз на каждый render независимо от `loading/notFound`, поэтому Rules of Hooks не нарушаются. Social metadata автоматически берутся из title/description/canonical/ogImage через Task 2.

- [ ] **Step 3: Запустить focused tests**

Run:

```bash
npx vitest run src/pages/booking/BookingPage.test.tsx
```

Expected: 2 tests PASS; successful cottage получает `LodgingBusiness`, `Accommodation`, `Offer`, `BreadcrumbList`; 404 получает `noindex, nofollow` без Schema.

- [ ] **Step 4: Запустить связанные SEO-тесты вместе**

Run:

```bash
npx vitest run src/lib/seo.test.ts src/lib/structuredData.test.ts src/pages/HomePage.test.tsx src/pages/booking/BookingPage.test.tsx
```

Expected: все четыре файла PASS, DOM cleanup между тестами не оставляет старых `data-seo-schema` scripts.

---

### Task 6: Создать корректный Open Graph asset

**Files:**
- Create: `public/og-image.jpg`
- Source asset: `public/cabin-1-enhanced.jpg`

- [ ] **Step 1: Проверить исходный и целевой каталоги**

Run:

```bash
ls "public" && test -f "public/cabin-1-enhanced.jpg"
```

Expected: каталог существует, исходный JPEG найден; `public/og-image.jpg` пока отсутствует либо будет заменён согласованным вариантом.

- [ ] **Step 2: Сгенерировать 1200×630 через уже установленный backend `sharp`**

Run из корня репозитория:

```bash
node --input-type=module -e "import sharp from './backend/node_modules/sharp/dist/index.cjs'; await sharp('public/cabin-1-enhanced.jpg').resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85, mozjpeg: true }).toFile('public/og-image.jpg');"
```

Expected: создан `public/og-image.jpg`. В корневой package не добавляется вторая зависимость `sharp`, а одноразовый helper-файл не создаётся.

- [ ] **Step 3: Проверить формат и размеры программно**

Run:

```bash
node --input-type=module -e "import sharp from './backend/node_modules/sharp/dist/index.cjs'; const m = await sharp('public/og-image.jpg').metadata(); console.log(JSON.stringify({ format: m.format, width: m.width, height: m.height })); if (m.format !== 'jpeg' || m.width !== 1200 || m.height !== 630) process.exit(1);"
```

Expected:

```json
{"format":"jpeg","width":1200,"height":630}
```

- [ ] **Step 4: Проверить ссылки на asset**

Убедиться, что `index.html`, `HomePage.tsx` и `structuredData.ts` используют один абсолютный URL:

```text
https://zvuki-lesa.ru/og-image.jpg
```

Для домиков использовать собственный `mainImage`; `/og-image.jpg` остаётся fallback при пустой строке.

---

### Task 7: Исправить жизненный цикл Schema SEO-страниц и статей

**Files:**
- Create: `src/pages/contentSchema.test.tsx`
- Modify: `src/pages/seo/SeoPage.tsx`
- Modify: `src/pages/blog/BlogPost.tsx`

- [ ] **Step 1: Написать regression tests для существующих content routes**

Создать `src/pages/contentSchema.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SeoPage from './seo/SeoPage';
import BlogPost from './blog/BlogPost';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  blog: vi.fn(),
  blogPost: vi.fn(),
}));

vi.mock('@/lib/seoApi', () => ({ seoApi: mocks }));
vi.mock('@/hooks/useCottages', () => ({
  useCottages: () => ({ data: [], loading: false, error: null }),
}));
vi.mock('@/components/SeoImage', () => ({ SeoImage: () => <div /> }));

afterEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  document.head.innerHTML = '';
  document.title = '';
});

it('keeps SEO page JSON-LD after async content loads', async () => {
  mocks.get.mockResolvedValue({
    success: true,
    data: {
      page: {
        id: 1,
        slug: 'dahovskaya',
        title: 'Отдых в Даховской',
        description: 'Гид по Даховской',
        h1: 'Даховская',
        body: '<p>Текст страницы</p>',
        metaImage: null,
        intent: 'даховская',
        priority: 0.9,
        schemaJson: JSON.stringify({ '@context': 'https://schema.org', '@type': 'TouristAttraction' }),
      },
    },
  });
  mocks.list.mockResolvedValue({ success: true, data: { pages: [] } });

  render(
    <MemoryRouter initialEntries={['/seo/dahovskaya']}>
      <Routes><Route path="/seo/:slug" element={<SeoPage />} /></Routes>
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Даховская' });
  expect(document.querySelector('script[data-seo-schema]')?.textContent)
    .toContain('TouristAttraction');
});

it('keeps Article JSON-LD after async blog post loads', async () => {
  mocks.blogPost.mockResolvedValue({
    success: true,
    data: {
      post: {
        id: 2,
        slug: 'rufabgo',
        title: 'Маршрут на Руфабго',
        excerpt: 'Практический маршрут',
        body: '<p>Текст статьи</p>',
        coverImage: null,
        category: 'маршруты',
        readingTimeMin: 5,
        publishedAt: '2026-07-01T00:00:00.000Z',
        author: 'Команда Звуки Леса',
        schemaJson: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article' }),
      },
    },
  });
  mocks.blog.mockResolvedValue({ success: true, data: { data: { items: [], total: 0 } } });

  render(
    <MemoryRouter initialEntries={['/blog/rufabgo']}>
      <Routes><Route path="/blog/:slug" element={<BlogPost />} /></Routes>
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Маршрут на Руфабго' });
  expect(document.querySelector('script[data-seo-schema]')?.textContent).toContain('Article');
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npx vitest run src/pages/contentSchema.test.tsx`

Expected: оба теста FAIL, потому что отдельные effects удаляют `script[data-seo-schema]` сразу после `useDocumentHead`.

- [ ] **Step 3: Удалить конфликтующие effects**

Из `src/pages/seo/SeoPage.tsx` удалить effect, который вручную выставляет `document.title` и удаляет `[data-seo-schema]` (текущие строки 80–87). Из `src/pages/blog/BlogPost.tsx` удалить аналогичный effect (текущие строки 159–166). Импорт `useEffect` оставить: оба компонента используют его для загрузки и UI-поведения.

Владельцем title, metadata и Schema остаётся только `useDocumentHead`.

- [ ] **Step 4: Подтвердить GREEN**

Run: `npx vitest run src/pages/contentSchema.test.tsx`

Expected: 2 tests PASS, `TouristAttraction` и `Article` остаются в document head после загрузки.

---

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

### Task 9: Выполнить сквозную локальную проверку

**Files:**
- Verify: `.prerender-routes.json`
- Verify: `dist/**/index.html`
- Verify: `docs/superpowers/specs/2026-07-20-seo-production-readiness-design.md`

- [ ] **Step 1: Запустить весь frontend test suite**

Run:

```bash
npm run test
```

Expected: PASS, включая `fetch-slugs`, `useDocumentHead`, structured data, HomePage, BookingPage и content Schema regression tests.

- [ ] **Step 2: Запустить статические проверки**

Run:

```bash
npm run lint && npx tsc -b --pretty false
```

Expected: PASS без новых lint/type ошибок. Если уже существующая несвязанная ошибка блокирует команду, зафиксировать её точный файл и сообщение; не расширять SEO-задачу несвязанным рефакторингом.

- [ ] **Step 3: Безопасно проверить backend sitemap test**

Сначала убедиться, что `TEST_DATABASE_URL` указывает на отдельную тестовую БД, а не на production/dev. Не печатать пароль. Если отдельная БД не подтверждена, не запускать тест: `sitemap.test.ts` вызывает `resetDb` и очищает таблицы.

При подтверждённой test DB выполнить:

```bash
npm --prefix backend exec -- vitest run src/routes/sitemap.test.ts
```

Expected: 3 tests PASS — static URLs присутствуют, опубликованный контент включён, неопубликованный исключён.

- [ ] **Step 4: Собрать production HTML с отдельно запущенным backend**

Terminal A:

```bash
npm run backend:dev
```

Terminal B:

```bash
npm run build
```

Expected: `prebuild` читает PostgreSQL, Vite собирает frontend, Puppeteer API probe проходит и `dist/` содержит HTML всех маршрутов. Миграции, seed и публикационные операции не запускать.

- [ ] **Step 5: Проверить route manifest программно**

Run:

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; const routes = JSON.parse(readFileSync('.prerender-routes.json', 'utf8')); if (!Array.isArray(routes) || !routes.includes('/') || !routes.includes('/blog') || !routes.includes('/search')) process.exit(1); const counts = { booking: routes.filter(r => r.startsWith('/booking/')).length, seo: routes.filter(r => r.startsWith('/seo/')).length, posts: routes.filter(r => r.startsWith('/blog/')).length }; console.log(JSON.stringify(counts));"
```

Expected: валидный JSON и ненулевой `booking`. `seo/posts` могут быть нулевыми только если в подключённой БД действительно нет опубликованных записей; это не заменяет ручную публикацию.

- [ ] **Step 6: Проверить каждый сгенерированный data route**

Run:

```bash
node --input-type=module -e "import { readFileSync, existsSync } from 'node:fs'; const routes = JSON.parse(readFileSync('.prerender-routes.json', 'utf8')); const dynamic = routes.filter(r => r.startsWith('/booking/') || r.startsWith('/seo/') || (r.startsWith('/blog/') && r !== '/blog')); const bad = []; for (const route of dynamic) { const file = 'dist' + route + '/index.html'; if (!existsSync(file)) { bad.push(route + ': missing HTML'); continue; } const html = readFileSync(file, 'utf8'); if (!html.includes('<link rel=\"canonical\"') || !html.includes('type=\"application/ld+json\"')) bad.push(route + ': missing canonical/schema'); if (/Домик не найден|Страница не найдена|Статья не найдена|Загружаем страницу|Загружаем…|>Загрузка\.\.\.</.test(html)) bad.push(route + ': invalid state'); if (route.startsWith('/booking/') && !html.includes('Accommodation')) bad.push(route + ': missing Accommodation'); } if (bad.length) { console.error(bad.join('\n')); process.exit(1); } console.log('validated', dynamic.length, 'dynamic routes');"
```

Expected: `validated N dynamic routes`, exit code 0.

- [ ] **Step 7: Проверить главную и отсутствие утечки её Schema**

Run:

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; const home = readFileSync('dist/index.html', 'utf8'); const businessCount = (home.match(/LodgingBusiness/g) ?? []).length; if (businessCount !== 1 || home.includes('\"reviewCount\":\"50\"')) process.exit(1); const article = JSON.parse(readFileSync('.prerender-routes.json', 'utf8')).find(r => r.startsWith('/blog/')); if (article) { const html = readFileSync('dist' + article + '/index.html', 'utf8'); if (html.includes('FAQPage') || html.includes('\"@id\":\"https://zvuki-lesa.ru/#lodging\"')) process.exit(1); } console.log('home schema is isolated');"
```

Expected: `home schema is isolated`.

- [ ] **Step 8: Проверить sitemap через работающий backend**

Run:

```bash
curl -fsS "http://localhost:3001/sitemap.xml" -o /tmp/zvuki-lesa-sitemap.xml && node --input-type=module -e "import { readFileSync } from 'node:fs'; const xml = readFileSync('/tmp/zvuki-lesa-sitemap.xml', 'utf8'); if (!xml.includes('<urlset') || !xml.includes('https://zvuki-lesa.ru/')) process.exit(1); console.log('sitemap XML is reachable');"
```

Expected: HTTP 200 и `sitemap XML is reachable`. Production reverse proxy `/sitemap.xml` остаётся ручным пунктом из Section 7 спецификации.

- [ ] **Step 9: Проверить рабочее дерево без изменения shared state**

Run:

```bash
git status --short
```

Expected: только согласованные source/test/docs/package/asset изменения плюс ранее существовавшие пользовательские правки. Не добавлять `.env`, `dist/`, временные файлы и секреты; не создавать commit без отдельной команды.

---

## Self-Review

### 1. Покрытие спецификации

- [x] PostgreSQL route manifest: Tasks 1A–1B заменяют SQLite, проверяют boolean-фильтры, fallback без URL, ошибку настроенного подключения и закрытие клиента.
- [x] Доступ Puppeteer к backend: Task 8 добавляет health probe, `/api`/`/uploads` proxy, блокировку analytics POST и отбраковку loading/404 HTML.
- [x] SEO домиков: Tasks 3A–3C формируют связанный `LodgingBusiness`/`Accommodation`/`Offer`/`BreadcrumbList`; Tasks 5A–5B подключают metadata и 404 `noindex`.
- [x] Единая Schema главной: Tasks 3B и 4A–4B переносят JSON-LD из `index.html`, используют реальные отзывы одним запросом и исключают фиктивный рейтинг.
- [x] Общие metadata: Task 2 добавляет robots, Open Graph, Twitter и fallback-контракт.
- [x] Существующие SEO/blog Schema: Task 7 удаляет эффекты, которые сразу уничтожали JSON-LD после загрузки.
- [x] Open Graph asset: Task 6 создаёт и программно проверяет JPEG 1200×630.
- [x] Локальная и production-oriented проверка: Task 9 покрывает tests, lint, TypeScript, manifest, итоговый HTML и sitemap.
- [x] Границы shared state: миграции, seed, публикация и reverse proxy не выполняются; backend test запускается только на подтверждённой отдельной test DB.

### 2. Проверка placeholders

Поиск по всем section-файлам не обнаружил запрещённых маркеров незавершённого или расплывчатого плана. Все code-changing steps содержат точные сигнатуры, snippets, команды и ожидаемые результаты.

### 3. Согласованность типов и имён

- [x] `DocumentHead` во всех задачах использует одинаковые поля: `robots`, `ogTitle`, `ogDescription`, `ogUrl`, `twitterTitle`, `twitterDescription`, `twitterUrl`, `twitterImage`.
- [x] Builders имеют единые сигнатуры `buildHomeStructuredData(ReviewsResponse | null): JsonLdGraph` и `buildCottageStructuredData(Cottage): JsonLdGraph`.
- [x] `Reviews` получает `data: ReviewsResponse | null` и `loading: boolean`; `HomePage` передаёт ровно эти props.
- [x] PostgreSQL использует реальные snake_case колонки `is_active` и `is_published` с boolean `true`.
- [x] Маршруты согласованы: `/booking/:slug`, `/seo/:slug`, `/blog/:slug`.
- [x] `sharp` импортируется из подтверждённого `backend/node_modules/sharp/dist/index.cjs`; команды работают из корня.

### Исправления, внесённые во время review

1. Добавлен отсутствовавший API proxy для data-driven prerender; без него Puppeteer сохранял бы loading/404 страницы.
2. Добавлено подавление `POST /api/analytics/event`, чтобы локальная сборка оставалась read-only относительно БД.
3. Добавлены regression tests для `SeoPage` и `BlogPost`: найденные эффекты удаляли собственную Schema.
4. Уточнено безопасное размещение API health check до инициализации временного сервера.
5. Уточнены точные dependency arrays, явные Vitest mocks и команды проверки binary asset.

Неразрешённых противоречий или пропущенных требований нет.

---
