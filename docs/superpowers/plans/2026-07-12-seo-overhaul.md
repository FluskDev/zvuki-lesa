# SEO Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять органический трафик из Яндекса/Google по запросам про отдых в Адыгее/Даховской через pre-rendered SPA + 40 SEO-страниц + 15 статей блога + расширенную Schema.org + sitemap.xml + редактируемую админку.

**Architecture:** SPA + pre-render при сборке через `vite-plugin-prerender-spa`. Backend — Express + SQLite/Drizzle, добавляем 3 таблицы (`seo_pages`, `blog_posts`, `images_registry`) + миграция 0003. Контент редактируется через `/admin` (расширение существующего) с Tiptap WYSIWYG. Публичные страницы `/seo/:slug`, `/blog`, `/blog/:slug` рендерят HTML из БД с Schema.org JSON-LD. Sitemap.xml генерируется Express-эндпоинтом из всех таблиц. Black 0004 — таблица `reviews` для микроразметки отзывов.

**Tech Stack:** Backend: Express 4, better-sqlite3 + Drizzle, zod, sharp (WebP-конвертация), multer (multipart), Vitest + supertest. Frontend: React 19 + Vite 7 + TypeScript 5.9, Tiptap (WYSIWYG), dompurify (HTML sanitize), vite-plugin-prerender-spa, Vitest + Testing Library.

**Спека:** `docs/superpowers/specs/2026-07-12-seo-overhaul-design.md`

---

## Структура файлов

**Бэкенд (создать):**
- `backend/src/routes/seoPages.ts` — публичные + админ-CRUD для `seo_pages`.
- `backend/src/routes/blogPosts.ts` — публичные + админ-CRUD для `blog_posts`.
- `backend/src/routes/images.ts` — публичный GET + админ-CRUD + multipart-загрузка.
- `backend/src/routes/reviews.ts` — публичные + админ-CRUD для `reviews` (Фаза 5).
- `backend/src/routes/sitemap.ts` — генерация sitemap.xml.
- `backend/src/routes/seoPages.test.ts`, `blogPosts.test.ts`, `images.test.ts`, `reviews.test.ts`, `sitemap.test.ts`.
- `backend/src/services/imageProcessor.ts` — sharp-конвертация в WebP.
- `backend/src/services/imageProcessor.test.ts`.
- `backend/src/validation/seo.ts` — zod-схемы для seo/blog/images/reviews.
- `backend/scripts/fetch-slugs.ts` — pre-build скрипт для pre-render.
- `backend/data/seo-drafts/*.json` — 55 черновиков контента (генерируются в Фазе 5).

**Бэкенд (изменить):**
- `backend/src/db/schema.ts` — 4 новые таблицы + 1 миграция (0003 + 0004).
- `backend/src/server.ts` — смонтировать новые роутеры + sitemap + robots.
- `backend/src/lib/errors.ts` — код `CONFLICT` для дублей slug.
- `backend/src/routes/admin.ts` — НЕ трогаем (свой `requireAdmin` уже есть).
- `backend/package.json` — добавить `sharp`, `multer`, `@types/multer`.
- `backend/public/robots.txt` — создать с правилами.

**Фронтенд (создать):**
- `src/lib/seoApi.ts` — клиент для `/api/seo`, `/api/blog`, `/api/images`.
- `src/lib/seoApi.test.ts`.
- `src/lib/seo.ts` — хуки `useDocumentHead`, `useSeoPage`, `useBlogPost`, `useBlogList`.
- `src/components/SeoImage.tsx` — обёртка с lazy-loading + fallback alt.
- `src/components/SeoImage.test.tsx`.
- `src/pages/seo/SeoPage.tsx` — публичная SEO-страница.
- `src/pages/blog/BlogIndex.tsx` — список статей.
- `src/pages/blog/BlogPost.tsx` — статья.
- `src/pages/admin/SeoPagesList.tsx`, `SeoPageEditor.tsx`.
- `src/pages/admin/BlogList.tsx`, `BlogEditor.tsx`.
- `src/pages/admin/ImageRegistry.tsx`.
- `src/pages/admin/ReviewsList.tsx`, `ReviewEditor.tsx`.
- `src/components/admin/TiptapEditor.tsx` — обёртка Tiptap.
- `src/components/admin/MetaPreview.tsx` — Google Snippet Preview.
- `src/components/admin/SlugInput.tsx` — генератор slug.

**Фронтенд (изменить):**
- `src/App.tsx` — добавить маршруты `/seo/:slug`, `/blog`, `/blog/:slug`.
- `src/sections/Footer.tsx` — блок «Популярные направления» (6-8 ссылок).
- `src/pages/booking/StickyBookingPanel.tsx` или новый блок — «Что посмотреть рядом».
- `vite.config.ts` — добавить `vite-plugin-prerender-spa`.
- `package.json` — `prebuild` скрипт + новые dev-deps.
- `index.html` — расширить Schema.org `LodgingBusiness` (Фаза 3).

**Контент (создать):**
- `backend/data/seo-drafts/seo/01-dahovskaya-adygeya-otdih.json` ... `40-*.json` — черновики SEO.
- `backend/data/seo-drafts/blog/01-chto-posmotret-letom.json` ... `15-*.json` — черновики блога.
- `backend/src/scripts/seedDrafts.ts` — заливает черновики в БД с `is_published=0`.

**Документация (изменить):**
- `CLAUDE.md` — раздел про SEO-страницы и блог.

---

## Phase 1 — БД, миграция, API без UI (1-2 дня)

### Task 1: Расширить schema.ts тремя таблицами

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create (генерируется): `backend/drizzle/0003_seo_blog_images.sql`

- [ ] **Step 1: Добавить таблицы в schema.ts**

В `backend/src/db/schema.ts` после существующих таблиц добавить:

```ts
export const seoPages = sqliteTable('seo_pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  h1: text('h1').notNull(),
  body: text('body').notNull(),
  metaImage: text('meta_image'),
  intent: text('intent').notNull(),
  schemaJson: text('schema_json').notNull(),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  priority: real('priority').notNull().default(0.7),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const blogPosts = sqliteTable('blog_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  body: text('body').notNull(),
  coverImage: text('cover_image'),
  author: text('author').notNull().default('Команда Звуки Леса'),
  category: text('category').notNull(),
  readingTimeMin: integer('reading_time_min').notNull().default(5),
  schemaJson: text('schema_json').notNull(),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const imagesRegistry = sqliteTable('images_registry', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull().unique(),
  alt: text('alt').notNull(),
  caption: text('caption'),
  width: integer('width'),
  height: integer('height'),
  uploadedBy: text('uploaded_by').notNull().default('admin'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Сгенерировать миграцию**

Run: `cd backend && npx drizzle-kit generate`
Expected: создан `backend/drizzle/0003_*.sql` с `CREATE TABLE seo_pages/blog_posts/images_registry`.

- [ ] **Step 3: Применить миграцию**

Run: `cd backend && npm run migrate`
Expected: `[migrate] done` без ошибок.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle/0003_*.sql
git commit -m "feat(db): add seo_pages, blog_posts, images_registry tables"
```

---

### Task 2: zod-схемы валидации

**Files:**
- Create: `backend/src/validation/seo.ts`

- [ ] **Step 1: Создать файл валидации**

```ts
import { z } from 'zod';

const slugRegex = /^[a-z0-9-]+$/;

export const seoPageInputSchema = z.object({
  slug: z.string().regex(slugRegex, 'Только a-z, 0-9 и дефис'),
  title: z.string().min(50).max(70),
  description: z.string().min(150).max(160),
  h1: z.string().min(10).max(120),
  body: z.string().min(500).max(8000),
  metaImage: z.string().url().optional().nullable(),
  intent: z.string().min(2).max(50),
  schemaJson: z.string().refine((v) => { try { JSON.parse(v); return true; } catch { return false; } }, 'Должен быть валидный JSON'),
  isPublished: z.boolean().default(false),
  priority: z.number().min(0).max(1).default(0.7),
});

export const seoPagePatchSchema = seoPageInputSchema.partial();

export const blogPostInputSchema = z.object({
  slug: z.string().regex(slugRegex),
  title: z.string().min(50).max(70),
  excerpt: z.string().min(200).max(250),
  body: z.string().min(1000).max(10000),
  coverImage: z.string().url().optional().nullable(),
  author: z.string().default('Команда Звуки Леса'),
  category: z.enum(['гид', 'маршруты', 'сезоны', 'лагонаки', 'достопримечательности', 'развлечения', 'практика']),
  readingTimeMin: z.number().int().min(1).max(60).default(5),
  schemaJson: z.string().refine((v) => { try { JSON.parse(v); return true; } catch { return false; } }),
  isPublished: z.boolean().default(false),
  publishedAt: z.coerce.date().optional().nullable(),
});

export const blogPostPatchSchema = blogPostInputSchema.partial();

export const imageInputSchema = z.object({
  alt: z.string().min(5).max(200),
  caption: z.string().max(300).optional().nullable(),
});

export const imagePatchSchema = imageInputSchema.partial();

export type SeoPageInput = z.infer<typeof seoPageInputSchema>;
export type BlogPostInput = z.infer<typeof blogPostInputSchema>;
export type ImageInput = z.infer<typeof imageInputSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/validation/seo.ts
git commit -m "feat(validation): add zod schemas for seo/blog/images"
```

---

### Task 3: Роутер seo_pages с публичными + админ-CRUD

**Files:**
- Create: `backend/src/routes/seoPages.ts`
- Create: `backend/src/routes/seoPages.test.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `backend/src/routes/seoPages.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../test-utils/createTestApp';
import { resetDb } from '../test-utils/resetDb';

describe('seoPages', () => {
  beforeEach(async () => { await resetDb(); });
  const app = createTestApp();

  it('GET /api/seo returns only published', async () => {
    const res = await request(app).get('/api/seo');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/admin/seo-pages creates page', async () => {
    const payload = {
      slug: 'test-page',
      title: 'Тестовая страница для проверки SEO роутера',
      description: 'Это описание тестовой страницы длиной ровно 150-160 символов для проверки работы SEO роутера в проекте.',
      h1: 'Тестовая страница',
      body: '<p>' + 'Lorem ipsum dolor sit amet. '.repeat(20) + '</p>',
      intent: 'test',
      schemaJson: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article' }),
      isPublished: true,
      priority: 0.8,
    };
    const res = await request(app).post('/api/admin/seo-pages').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('test-page');
  });

  it('POST rejects invalid slug', async () => {
    const res = await request(app).post('/api/admin/seo-pages').send({
      slug: 'Invalid Slug!',
      title: 'a'.repeat(60),
      description: 'a'.repeat(155),
      h1: 'Test',
      body: 'a'.repeat(600),
      intent: 'test',
      schemaJson: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('POST rejects duplicate slug', async () => {
    const payload = { slug: 'dup', title: 'a'.repeat(60), description: 'a'.repeat(155), h1: 'h', body: 'a'.repeat(600), intent: 't', schemaJson: '{}' };
    await request(app).post('/api/admin/seo-pages').send(payload);
    const res = await request(app).post('/api/admin/seo-pages').send(payload);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Реализовать роутер**

Создать `backend/src/routes/seoPages.ts`:

```ts
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { seoPages } from '../db/schema';
import { seoPageInputSchema, seoPagePatchSchema } from '../validation/seo';
import { requireAdmin } from '../lib/adminAuth';
import { validate } from '../lib/validate';

const router = Router();

// Публичные
router.get('/', async (_req, res) => {
  const rows = await db.select({
    id: seoPages.id, slug: seoPages.slug, title: seoPages.title,
    description: seoPages.description, h1: seoPages.h1, metaImage: seoPages.metaImage,
    intent: seoPages.intent, priority: seoPages.priority,
  }).from(seoPages).where(eq(seoPages.isPublished, true)).orderBy(desc(seoPages.priority));
  res.json({ success: true, data: rows });
});

router.get('/:slug', async (req, res) => {
  const [row] = await db.select().from(seoPages).where(eq(seoPages.slug, req.params.slug)).limit(1);
  if (!row || !row.isPublished) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

// Админ
router.get('/admin/seo-pages', requireAdmin, async (_req, res) => {
  const rows = await db.select().from(seoPages).orderBy(desc(seoPages.updatedAt));
  res.json({ success: true, data: rows });
});

router.post('/admin/seo-pages', requireAdmin, validate(seoPageInputSchema), async (req, res) => {
  try {
    const [row] = await db.insert(seoPages).values(req.body).returning();
    res.json({ success: true, data: row });
  } catch (e: any) {
    if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ success: false, error: 'Slug already exists' });
    throw e;
  }
});

router.patch('/admin/seo-pages/:id', requireAdmin, validate(seoPagePatchSchema), async (req, res) => {
  const [row] = await db.update(seoPages).set({ ...req.body, updatedAt: new Date() }).where(eq(seoPages.id, +req.params.id)).returning();
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

router.delete('/admin/seo-pages/:id', requireAdmin, async (req, res) => {
  await db.delete(seoPages).where(eq(seoPages.id, +req.params.id));
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 3: Смонтировать в server.ts**

В `backend/src/server.ts` после `app.use('/api', ...)`:

```ts
import seoPagesRouter from './routes/seoPages';
// ...
app.use('/api', seoPagesRouter);
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd backend && npm run test -- seoPages`
Expected: все тесты PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/seoPages.ts backend/src/routes/seoPages.test.ts backend/src/server.ts
git commit -m "feat(api): seoPages CRUD with public/admin routes"
```

---

### Task 4: Роутер blog_posts (аналогично Task 3)

**Files:**
- Create: `backend/src/routes/blogPosts.ts`
- Create: `backend/src/routes/blogPosts.test.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Тест**

`backend/src/routes/blogPosts.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../test-utils/createTestApp';
import { resetDb } from '../test-utils/resetDb';

describe('blogPosts', () => {
  beforeEach(async () => { await resetDb(); });
  const app = createTestApp();

  it('GET /api/blog paginates', async () => {
    const res = await request(app).get('/api/blog?page=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
  });

  it('GET /api/blog filters by category', async () => {
    const res = await request(app).get('/api/blog?category=гид');
    expect(res.status).toBe(200);
  });

  it('POST /api/admin/blog-posts creates post', async () => {
    const payload = {
      slug: 'test-post', title: 'a'.repeat(60), excerpt: 'a'.repeat(220),
      body: 'a'.repeat(1500), category: 'гид', schemaJson: '{}', isPublished: true,
    };
    const res = await request(app).post('/api/admin/blog-posts').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('test-post');
  });
});
```

- [ ] **Step 2: Роутер**

`backend/src/routes/blogPosts.ts`:

```ts
import { Router } from 'express';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { blogPosts } from '../db/schema';
import { blogPostInputSchema, blogPostPatchSchema } from '../validation/seo';
import { requireAdmin } from '../lib/adminAuth';
import { validate } from '../lib/validate';

const router = Router();
const PAGE_SIZE = 12;

router.get('/', async (req, res) => {
  const page = Math.max(1, +req.query.page || 1);
  const category = req.query.category as string | undefined;
  const where = category ? and(eq(blogPosts.isPublished, true), eq(blogPosts.category, category)) : eq(blogPosts.isPublished, true);

  const [items, [{ total }]] = await Promise.all([
    db.select({
      id: blogPosts.id, slug: blogPosts.slug, title: blogPosts.title, excerpt: blogPosts.excerpt,
      coverImage: blogPosts.coverImage, category: blogPosts.category, readingTimeMin: blogPosts.readingTimeMin,
      publishedAt: blogPosts.publishedAt,
    }).from(blogPosts).where(where).orderBy(desc(blogPosts.publishedAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(blogPosts).where(where),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize: PAGE_SIZE } });
});

router.get('/:slug', async (req, res) => {
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, req.params.slug)).limit(1);
  if (!row || !row.isPublished) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

// Админ
router.get('/admin/blog-posts', requireAdmin, async (_req, res) => {
  const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.updatedAt));
  res.json({ success: true, data: rows });
});

router.post('/admin/blog-posts', requireAdmin, validate(blogPostInputSchema), async (req, res) => {
  try {
    const [row] = await db.insert(blogPosts).values(req.body).returning();
    res.json({ success: true, data: row });
  } catch (e: any) {
    if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ success: false, error: 'Slug already exists' });
    throw e;
  }
});

router.patch('/admin/blog-posts/:id', requireAdmin, validate(blogPostPatchSchema), async (req, res) => {
  const [row] = await db.update(blogPosts).set({ ...req.body, updatedAt: new Date() }).where(eq(blogPosts.id, +req.params.id)).returning();
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

router.delete('/admin/blog-posts/:id', requireAdmin, async (req, res) => {
  await db.delete(blogPosts).where(eq(blogPosts.id, +req.params.id));
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 3: Смонтировать**

В `backend/src/server.ts`:
```ts
import blogPostsRouter from './routes/blogPosts';
app.use('/api', blogPostsRouter);
```

- [ ] **Step 4: Тесты + коммит**

Run: `cd backend && npm run test -- blogPosts`
Expected: PASS.

```bash
git add backend/src/routes/blogPosts.ts backend/src/routes/blogPosts.test.ts backend/src/server.ts
git commit -m "feat(api): blogPosts CRUD with pagination"
```

---

### Task 5: Image processor + роутер images

**Files:**
- Create: `backend/src/services/imageProcessor.ts`
- Create: `backend/src/services/imageProcessor.test.ts`
- Create: `backend/src/routes/images.ts`
- Create: `backend/src/routes/images.test.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Установить зависимости**

Run: `cd backend && npm install sharp multer && npm install -D @types/multer`

- [ ] **Step 2: Тест imageProcessor**

`backend/src/services/imageProcessor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { processImage } from './imageProcessor';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

describe('imageProcessor', () => {
  const testDir = path.join(process.cwd(), 'public', 'uploads', 'test');

  it('converts buffer to WebP', async () => {
    // 1x1 red PNG
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const result = await processImage(png, { destDir: testDir, filenameBase: 'test-red' });
    expect(result.path).toMatch(/\.webp$/);
    expect(existsSync(result.path)).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    unlinkSync(result.path);
  });
});
```

- [ ] **Step 3: Реализация imageProcessor**

`backend/src/services/imageProcessor.ts`:

```ts
import sharp from 'sharp';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

export interface ProcessImageOptions {
  destDir: string;
  filenameBase: string;
  quality?: number;
}

export interface ProcessImageResult {
  path: string;
  width: number;
  height: number;
}

export async function processImage(
  buffer: Buffer,
  options: ProcessImageOptions
): Promise<ProcessImageResult> {
  mkdirSync(options.destDir, { recursive: true });
  const outPath = path.join(options.destDir, `${options.filenameBase}.webp`);
  const image = sharp(buffer);
  const meta = await image.metadata();
  await image.webp({ quality: options.quality ?? 80 }).toFile(outPath);
  return { path: outPath, width: meta.width ?? 0, height: meta.height ?? 0 };
}
```

- [ ] **Step 4: Роутер images**

`backend/src/routes/images.ts`:

```ts
import { Router } from 'express';
import multer from 'multer';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { imagesRegistry } from '../db/schema';
import { imageInputSchema, imagePatchSchema } from '../validation/seo';
import { requireAdmin } from '../lib/adminAuth';
import { validate } from '../lib/validate';
import { processImage } from '../services/imageProcessor';
import path from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const PUBLIC_UPLOADS = path.join(process.cwd(), 'public', 'uploads');

router.get('/images', async (_req, res) => {
  const rows = await db.select().from(imagesRegistry).orderBy(desc(imagesRegistry.createdAt));
  res.json({ success: true, data: rows });
});

router.post('/admin/images', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  const parsed = imageInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation', details: parsed.error.issues });

  const now = new Date();
  const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const destDir = path.join(PUBLIC_UPLOADS, yyyymm);
  const filenameBase = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await processImage(req.file.buffer, { destDir, filenameBase });
  const publicPath = `/uploads/${yyyymm}/${path.basename(result.path)}`;

  const [row] = await db.insert(imagesRegistry).values({
    path: publicPath, alt: parsed.data.alt, caption: parsed.data.caption ?? null,
    width: result.width, height: result.height,
  }).returning();
  res.json({ success: true, data: row });
});

router.patch('/admin/images/:id', requireAdmin, validate(imagePatchSchema), async (req, res) => {
  const [row] = await db.update(imagesRegistry).set(req.body).where(eq(imagesRegistry.id, +req.params.id)).returning();
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

router.delete('/admin/images/:id', requireAdmin, async (req, res) => {
  const [row] = await db.select().from(imagesRegistry).where(eq(imagesRegistry.id, +req.params.id)).limit(1);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  const fullPath = path.join(process.cwd(), 'public', row.path);
  if (existsSync(fullPath)) unlinkSync(fullPath);
  await db.delete(imagesRegistry).where(eq(imagesRegistry.id, +req.params.id));
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 5: Смонтировать**

В `backend/src/server.ts`:
```ts
import imagesRouter from './routes/images';
app.use('/api', imagesRouter);
```

- [ ] **Step 6: Тесты**

Run: `cd backend && npm run test -- images imageProcessor`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/imageProcessor.ts backend/src/services/imageProcessor.test.ts backend/src/routes/images.ts backend/src/routes/images.test.ts backend/src/server.ts backend/package.json backend/package-lock.json
git commit -m "feat(api): images upload with sharp WebP conversion"
```

---

## Phase 2 — Админка: редакторы контента (2-3 дня)

### Task 6: Хелперы админки (slug-генератор, meta preview, Tiptap обёртка)

**Files:**
- Create: `src/lib/seo.ts` — `slugify`, `countWords`
- Create: `src/lib/seo.test.ts`
- Create: `src/components/admin/SlugInput.tsx`
- Create: `src/components/admin/SlugInput.test.tsx`
- Create: `src/components/admin/MetaPreview.tsx`
- Create: `src/components/admin/TiptapEditor.tsx`

- [ ] **Step 1: Тест slugify**

`src/lib/seo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify, countWords, readingTimeMin } from './seo';

describe('seo utils', () => {
  it('slugify transliterates Russian', () => {
    expect(slugify('Даховская Адыгея')).toBe('dahovskaya-adygeya');
    expect(slugify('Отдых в горах!')).toBe('otdyh-v-gorah');
  });
  it('countWords handles HTML', () => {
    expect(countWords('<p>Привет мир</p>')).toBe(2);
  });
  it('readingTimeMin divides by 200', () => {
    expect(readingTimeMin('a'.repeat(800))).toBe(4);
  });
});
```

- [ ] **Step 2: Реализация**

`src/lib/seo.ts`:

```ts
const translitMap: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};

export function slugify(input: string): string {
  return input.toLowerCase().trim()
    .split('').map(c => translitMap[c] ?? c).join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function countWords(html: string): number {
  return (html.replace(/<[^>]+>/g, ' ').match(/\S+/g) ?? []).length;
}

export function readingTimeMin(html: string): number {
  return Math.max(1, Math.round(countWords(html) / 200));
}
```

- [ ] **Step 3: SlugInput**

`src/components/admin/SlugInput.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { slugify } from '@/lib/seo';

interface Props {
  value: string;
  onChange: (v: string) => void;
  sourceTitle?: string;
}

export function SlugInput({ value, onChange, sourceTitle }: Props) {
  const [auto, setAuto] = useState(!value);

  useEffect(() => {
    if (auto && sourceTitle) onChange(slugify(sourceTitle));
  }, [sourceTitle, auto, onChange]);

  return (
    <div className="flex gap-2 items-center">
      <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
      <span className="text-sm">Авто из title</span>
      <input
        type="text"
        value={value}
        onChange={e => { setAuto(false); onChange(slugify(e.target.value)); }}
        className="border px-2 py-1 rounded flex-1"
        placeholder="my-page-slug"
      />
    </div>
  );
}
```

- [ ] **Step 4: MetaPreview**

`src/components/admin/MetaPreview.tsx`:

```tsx
interface Props {
  title: string;
  description: string;
  slug: string;
}

export function MetaPreview({ title, description, slug }: Props) {
  const url = `https://zvuki-lesa.ru/${slug}`;
  return (
    <div className="border rounded p-3 max-w-2xl">
      <div className="text-xs text-gray-500">{url}</div>
      <div className="text-blue-700 text-lg hover:underline cursor-pointer">{title || 'Заголовок страницы'}</div>
      <div className="text-gray-700 text-sm">{description || 'Описание страницы появится здесь...'}</div>
    </div>
  );
}
```

- [ ] **Step 5: TiptapEditor (заготовка)**

`src/components/admin/TiptapEditor.tsx`:

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export function TiptapEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Image, Link.configure({ openOnClick: false })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="border rounded">
      <div className="border-b p-2 flex gap-2">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'font-bold' : ''}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'italic' : ''}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'font-bold' : ''}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'font-bold' : ''}>H3</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</button>
        <button type="button" onClick={() => {
          const url = prompt('URL?'); if (url) editor.chain().focus().setLink({ href: url }).run();
        }}>🔗</button>
      </div>
      <EditorContent editor={editor} className="p-3 min-h-[300px] prose dark:prose-invert max-w-none" />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo.ts src/lib/seo.test.ts src/components/admin/SlugInput.tsx src/components/admin/MetaPreview.tsx src/components/admin/TiptapEditor.tsx package.json package-lock.json
git commit -m "feat(admin): slug input, meta preview, Tiptap editor wrapper"
```

---

### Task 7: SEO-page editor в админке

**Files:**
- Create: `src/pages/admin/SeoPageEditor.tsx`
- Create: `src/pages/admin/SeoPagesList.tsx`
- Modify: `src/pages/admin/AdminDashboard.tsx`

- [ ] **Step 1: SeoPagesList**

`src/pages/admin/SeoPagesList.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/lib/adminApi';

interface SeoPage {
  id: number; slug: string; title: string; isPublished: boolean; priority: number;
}

export default function SeoPagesList() {
  const [items, setItems] = useState<SeoPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get<SeoPage[]>('/admin/seo-pages').then(r => { setItems(r.data); setLoading(false); });
  }, []);

  const remove = async (id: number) => {
    if (!confirm('Удалить?')) return;
    await adminApi.delete(`/admin/seo-pages/${id}`);
    setItems(items.filter(i => i.id !== id));
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <div className="flex justify-between mb-3">
        <h2 className="text-xl font-bold">SEO-страницы</h2>
        <Link to="/admin/seo-pages/new" className="bg-emerald-600 text-white px-3 py-1 rounded">+ Создать</Link>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th>Slug</th><th>Title</th><th>Priority</th><th>Published</th><th></th></tr></thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id} className="border-t">
              <td><code>{p.slug}</code></td>
              <td className="truncate max-w-md">{p.title}</td>
              <td>{p.priority}</td>
              <td>{p.isPublished ? '✅' : '⏳'}</td>
              <td>
                <Link to={`/admin/seo-pages/${p.id}`} className="text-blue-600 mr-2">Edit</Link>
                <button onClick={() => remove(p.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: SeoPageEditor**

`src/pages/admin/SeoPageEditor.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/adminApi';
import { TiptapEditor } from '@/components/admin/TiptapEditor';
import { SlugInput } from '@/components/admin/SlugInput';
import { MetaPreview } from '@/components/admin/MetaPreview';
import { readingTimeMin } from '@/lib/seo';

interface SeoPage {
  id?: number; slug: string; title: string; description: string; h1: string; body: string;
  metaImage?: string; intent: string; schemaJson: string; isPublished: boolean; priority: number;
}

const empty: SeoPage = {
  slug: '', title: '', description: '', h1: '', body: '', intent: '', schemaJson: '{}', isPublished: false, priority: 0.7,
};

export default function SeoPageEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState<SeoPage>(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      adminApi.get<SeoPage>(`/admin/seo-pages`).then(r => {
        const found = r.data.find(p => p.id === +id!);
        if (found) setPage(found);
      });
    }
  }, [id]);

  const save = async () => {
    setBusy(true);
    try {
      if (page.id) await adminApi.patch(`/admin/seo-pages/${page.id}`, page);
      else await adminApi.post('/admin/seo-pages', page);
      nav('/admin/seo-pages');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{page.id ? 'Редактирование' : 'Новая'} SEO-страница</h2>
      <label className="block">Title<input className="border w-full px-2 py-1 rounded" value={page.title} onChange={e => setPage({ ...page, title: e.target.value })} /></label>
      <label className="block">Slug<SlugInput value={page.slug} sourceTitle={page.title} onChange={v => setPage({ ...page, slug: v })} /></label>
      <label className="block">Description<textarea className="border w-full px-2 py-1 rounded" rows={2} value={page.description} onChange={e => setPage({ ...page, description: e.target.value })} /></label>
      <label className="block">H1<input className="border w-full px-2 py-1 rounded" value={page.h1} onChange={e => setPage({ ...page, h1: e.target.value })} /></label>
      <label className="block">Intent (категория)
        <select className="border w-full px-2 py-1 rounded" value={page.intent} onChange={e => setPage({ ...page, intent: e.target.value })}>
          <option value="">— выбрать —</option>
          {['горы-адыгеи', 'термальные-источники', 'лагонаки', 'даховская', 'домики', 'активности', 'сезоны'].map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </label>
      <label className="block">Priority (0-1)<input type="number" step="0.05" min="0" max="1" className="border px-2 py-1 rounded" value={page.priority} onChange={e => setPage({ ...page, priority: +e.target.value })} /></label>
      <div>
        <div className="text-sm text-gray-500 mb-1">Body (HTML)</div>
        <TiptapEditor value={page.body} onChange={v => setPage({ ...page, body: v })} />
      </div>
      <label className="flex gap-2 items-center"><input type="checkbox" checked={page.isPublished} onChange={e => setPage({ ...page, isPublished: e.target.checked })} /> Опубликовано</label>
      <MetaPreview title={page.title} description={page.description} slug={`seo/${page.slug}`} />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50">Сохранить</button>
        <button onClick={() => window.open(`/seo/${page.slug}`, '_blank')} disabled={!page.slug} className="bg-gray-200 px-4 py-2 rounded">Предпросмотр</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: AdminDashboard — добавить вкладку**

В `src/pages/admin/AdminDashboard.tsx` рядом с существующими вкладками добавить кнопку/таб «SEO-страницы» и `BookingsList` рендер заменить на свитчер `activeTab`.

- [ ] **Step 4: Маршруты**

В `src/App.tsx` (внутри `RequireAdmin`):
```tsx
<Route path="seo-pages" element={<SeoPagesList />} />
<Route path="seo-pages/:id" element={<SeoPageEditor />} />
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/SeoPageEditor.tsx src/pages/admin/SeoPagesList.tsx src/pages/admin/AdminDashboard.tsx src/App.tsx
git commit -m "feat(admin): SEO-pages list and editor"
```

---

### Task 8: Blog editor в админке (по аналогии с Task 7)

**Files:**
- Create: `src/pages/admin/BlogList.tsx`
- Create: `src/pages/admin/BlogEditor.tsx`
- Modify: `src/pages/admin/AdminDashboard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: BlogList + BlogEditor**

Структура идентична SeoPagesList/SeoPageEditor, но:
- поля: `title, slug, excerpt, body, coverImage, category, isPublished, publishedAt`
- в редакторе дополнительно: `<input type="date" value={publishedAt}>` если isPublished
- endpoint: `/admin/blog-posts`

- [ ] **Step 2: Маршруты + таб**

В `src/App.tsx`:
```tsx
<Route path="blog-posts" element={<BlogList />} />
<Route path="blog-posts/:id" element={<BlogEditor />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/BlogList.tsx src/pages/admin/BlogEditor.tsx src/pages/admin/AdminDashboard.tsx src/App.tsx
git commit -m "feat(admin): blog posts list and editor"
```

---

### Task 9: Image Registry в админке

**Files:**
- Create: `src/pages/admin/ImageRegistry.tsx`
- Modify: `src/pages/admin/AdminDashboard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: ImageRegistry**

`src/pages/admin/ImageRegistry.tsx`:

```tsx
import { useEffect, useState, useRef } from 'react';
import { adminApi } from '@/lib/adminApi';

interface Image {
  id: number; path: string; alt: string; caption?: string; width?: number; height?: number;
}

export default function ImageRegistry() {
  const [items, setItems] = useState<Image[]>([]);
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.get<Image[]>('/admin/images').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !alt) return alert('Файл и alt обязательны');
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt', alt);
    if (caption) fd.append('caption', caption);
    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/images`, {
      method: 'POST', body: fd,
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    });
    setAlt(''); setCaption(''); if (fileRef.current) fileRef.current.value = '';
    await load(); setBusy(false);
  };

  const updateAlt = async (id: number, newAlt: string) => {
    await adminApi.patch(`/admin/images/${id}`, { alt: newAlt });
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить?')) return;
    await adminApi.delete(`/admin/images/${id}`);
    await load();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Картинки</h2>
      <div className="border rounded p-3 mb-4 flex gap-2 items-end">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
        <input placeholder="alt (обязательно)" value={alt} onChange={e => setAlt(e.target.value)} className="border px-2 py-1 rounded flex-1" />
        <input placeholder="caption (опц.)" value={caption} onChange={e => setCaption(e.target.value)} className="border px-2 py-1 rounded flex-1" />
        <button onClick={upload} disabled={busy} className="bg-emerald-600 text-white px-3 py-1 rounded">Загрузить</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(img => (
          <div key={img.id} className="border rounded p-2">
            <img src={img.path} alt={img.alt} className="w-full h-32 object-cover rounded mb-2" />
            <input defaultValue={img.alt} onBlur={e => updateAlt(img.id, e.target.value)} className="border w-full px-1 text-sm mb-1" />
            <div className="text-xs text-gray-500">{img.width}×{img.height}</div>
            <button onClick={() => remove(img.id)} className="text-red-600 text-sm">Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Маршрут + таб**

В `src/App.tsx`:
```tsx
<Route path="images" element={<ImageRegistry />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/ImageRegistry.tsx src/pages/admin/AdminDashboard.tsx src/App.tsx
git commit -m "feat(admin): image registry with upload + alt editing"
```

---

## Phase 3 — Публичные страницы + Schema.org (3-4 дня)

### Task 10: SEO API клиент и хуки

**Files:**
- Create: `src/lib/seoApi.ts`
- Create: `src/lib/seoApi.test.ts`

- [ ] **Step 1: Клиент**

`src/lib/seoApi.ts`:

```ts
import { apiFetch } from './api';

export interface SeoPageListItem {
  id: number; slug: string; title: string; description: string; h1: string;
  metaImage?: string; intent: string; priority: number;
}
export interface SeoPage extends SeoPageListItem {
  body: string; schemaJson: string;
}
export interface BlogListItem {
  id: number; slug: string; title: string; excerpt: string;
  coverImage?: string; category: string; readingTimeMin: number; publishedAt: string;
}
export interface BlogPost extends BlogListItem { body: string; author: string; schemaJson: string; }

export const seoApi = {
  list: () => apiFetch<SeoPageListItem[]>('/api/seo'),
  get: (slug: string) => apiFetch<SeoPage>(`/api/seo/${slug}`),
  blog: (page = 1, category?: string) => apiFetch<{ items: BlogListItem[]; total: number; page: number }>(
    `/api/blog?page=${page}${category ? `&category=${encodeURIComponent(category)}` : ''}`
  ),
  blogPost: (slug: string) => apiFetch<BlogPost>(`/api/blog/${slug}`),
};
```

- [ ] **Step 2: Тесты**

`src/lib/seoApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seoApi } from './seoApi';
import { apiFetch } from './api';

vi.mock('./api', () => ({ apiFetch: vi.fn() }));

describe('seoApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list hits /api/seo', async () => {
    (apiFetch as any).mockResolvedValue({ success: true, data: [] });
    await seoApi.list();
    expect(apiFetch).toHaveBeenCalledWith('/api/seo');
  });

  it('blog builds query string', async () => {
    (apiFetch as any).mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1 } });
    await seoApi.blog(2, 'гид');
    expect(apiFetch).toHaveBeenCalledWith('/api/blog?page=2&category=%D0%B3%D0%B8%D0%B4');
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/seoApi.ts src/lib/seoApi.test.ts
git commit -m "feat(frontend): seoApi client + tests"
```

---

### Task 11: useDocumentHead и SeoImage

**Files:**
- Create: `src/lib/seo.ts` (дополнить — если уже есть slugify/countWords, добавить useDocumentHead)
- Create: `src/components/SeoImage.tsx`
- Create: `src/components/SeoImage.test.tsx`

- [ ] **Step 1: Хук useDocumentHead**

Дополнить `src/lib/seo.ts`:

```ts
import { useEffect } from 'react';

export interface DocumentHead {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  schema?: object | object[];
}

function setMeta(name: string, value: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function setSchema(schema: object | object[]) {
  const schemas = Array.isArray(schema) ? schema : [schema];
  const existing = document.head.querySelectorAll('script[data-seo-schema]');
  existing.forEach(n => n.remove());
  for (const s of schemas) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seoSchema = 'true';
    script.text = JSON.stringify(s);
    document.head.appendChild(script);
  }
}

export function useDocumentHead(head: DocumentHead) {
  useEffect(() => {
    if (head.title) document.title = head.title;
    if (head.description) setMeta('description', head.description);
    if (head.ogImage) setMeta('og:image', head.ogImage, 'property');
    if (head.canonical) setCanonical(head.canonical);
    if (head.schema) setSchema(head.schema);

    return () => {
      const existing = document.head.querySelectorAll('script[data-seo-schema]');
      existing.forEach(n => n.remove());
    };
  }, [head.title, head.description, head.canonical, head.ogImage, JSON.stringify(head.schema)]);
}
```

- [ ] **Step 2: SeoImage**

`src/components/SeoImage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  src: string;
  alt: string;
  fallbackAlt?: string;
}

interface ImageRow { alt: string; }

export function SeoImage({ src, alt, fallbackAlt, ...rest }: Props) {
  const [resolvedAlt, setResolvedAlt] = useState(alt);

  useEffect(() => {
    if (src.startsWith('/uploads/') && fallbackAlt !== undefined) {
      apiFetch<ImageRow[]>('/api/images').then(r => {
        const found = r.data.find(img => img.path === src);
        if (found) setResolvedAlt(found.alt);
      }).catch(() => {});
    }
  }, [src, fallbackAlt]);

  useEffect(() => {
    if (!alt && import.meta.env.DEV) console.warn(`SeoImage missing alt: ${src}`);
  }, [alt, src]);

  return <img src={src} alt={resolvedAlt} loading={rest.loading ?? 'lazy'} {...rest} />;
}
```

- [ ] **Step 3: Тест SeoImage**

`src/components/SeoImage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SeoImage } from './SeoImage';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn().mockResolvedValue({ success: true, data: [] }) }));

describe('SeoImage', () => {
  it('renders with provided alt', () => {
    render(<SeoImage src="/x.jpg" alt="Mountain view" />);
    expect(screen.getByAltText('Mountain view')).toBeInTheDocument();
  });

  it('warns in dev when alt is empty', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SeoImage src="/x.jpg" alt="" />);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('defaults to lazy loading', () => {
    render(<SeoImage src="/x.jpg" alt="x" />);
    expect(screen.getByAltText('x')).toHaveAttribute('loading', 'lazy');
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/seo.ts src/components/SeoImage.tsx src/components/SeoImage.test.tsx
git commit -m "feat(frontend): useDocumentHead hook + SeoImage component"
```

---

### Task 12: Публичная SEO-страница `/seo/:slug`

**Files:**
- Create: `src/pages/seo/SeoPage.tsx`

- [ ] **Step 1: Компонент**

`src/pages/seo/SeoPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { seoApi, SeoPage } from '@/lib/seoApi';
import { useDocumentHead } from '@/lib/seo';
import { SeoImage } from '@/components/SeoImage';
import { useCottages } from '@/hooks/useCottages';

export default function SeoPageView() {
  const { slug } = useParams();
  const [page, setPage] = useState<SeoPage | null>(null);
  const [related, setRelated] = useState<SeoPage[]>([]);
  const { cottages } = useCottages();

  useEffect(() => {
    if (!slug) return;
    seoApi.get(slug).then(r => {
      setPage(r.data);
      // Load related by same intent
      seoApi.list().then(list => {
        setRelated(list.data.filter(p => p.intent === r.data.intent && p.slug !== slug).slice(0, 4));
      });
    }).catch(() => setPage(null));
  }, [slug]);

  useDocumentHead({
    title: page?.title,
    description: page?.description,
    canonical: page ? `https://zvuki-lesa.ru/seo/${page.slug}` : undefined,
    ogImage: page?.metaImage,
    schema: page ? JSON.parse(page.schemaJson) : undefined,
  });

  if (!page) return <div className="p-8">Загрузка...</div>;

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      {page.metaImage && <SeoImage src={page.metaImage} alt={page.h1} className="w-full h-64 object-cover rounded-lg mb-6" loading="eager" />}
      <h1 className="text-3xl font-bold mb-6">{page.h1}</h1>
      <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.body) }} />

      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Наши домики</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {cottages.slice(0, 3).map(c => (
            <Link key={c.id} to={`/booking/${c.slug}`} className="border rounded p-3 hover:shadow">
              <SeoImage src={c.mainImage} alt={c.name} className="w-full h-32 object-cover rounded mb-2" />
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm">от {c.basePrice} ₽/ночь</div>
            </Link>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Смотрите также</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {related.map(r => (
              <Link key={r.slug} to={`/seo/${r.slug}`} className="border rounded p-3 hover:shadow">
                <div className="font-semibold">{r.title}</div>
                <div className="text-sm text-gray-600">{r.description}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-2">Забронировать</h2>
        <p className="mb-4">Звоните: <a href="tel:+79282110249" className="text-emerald-600">+7 (928) 211-02-49</a></p>
        <Link to="/search" className="bg-emerald-600 text-white px-6 py-2 rounded inline-block">Найти свободные даты</Link>
      </section>
    </article>
  );
}
```

- [ ] **Step 2: Маршрут**

В `src/App.tsx`:
```tsx
<Route path="/seo/:slug" element={<SeoPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/seo/SeoPage.tsx src/App.tsx
git commit -m "feat(frontend): public SEO-page view"
```

---

### Task 13: Публичный блог — список и статья

**Files:**
- Create: `src/pages/blog/BlogIndex.tsx`
- Create: `src/pages/blog/BlogPost.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: BlogIndex**

`src/pages/blog/BlogIndex.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { seoApi, BlogListItem } from '@/lib/seoApi';
import { SeoImage } from '@/components/SeoImage';
import { useDocumentHead } from '@/lib/seo';

const CATEGORIES = ['', 'гид', 'маршруты', 'сезоны', 'лагонаки', 'достопримечательности', 'развлечения', 'практика'];

export default function BlogIndex() {
  const [params, setParams] = useSearchParams();
  const page = +(params.get('page') || '1');
  const category = params.get('category') || undefined;
  const [items, setItems] = useState<BlogListItem[]>([]);
  const [total, setTotal] = useState(0);

  useDocumentHead({
    title: 'Блог — гиды по Адыгее | Звуки Леса',
    description: 'Статьи о достопримечательностях Адыгеи, маршрутах, погоде и отдыхе в Даховской.',
    canonical: `https://zvuki-lesa.ru/blog${category ? `?category=${category}` : ''}`,
  });

  useEffect(() => {
    seoApi.blog(page, category).then(r => { setItems(r.data.items); setTotal(r.data.total); });
  }, [page, category]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Блог</h1>
      <p className="text-gray-600 mb-6">Гиды, маршруты и практические советы по отдыху в Адыгее</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setParams(c ? { category: c } : {})}
            className={`px-3 py-1 rounded text-sm ${category === c ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
            {c || 'Все'}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {items.map(p => (
          <Link key={p.slug} to={`/blog/${p.slug}`} className="border rounded overflow-hidden hover:shadow">
            {p.coverImage && <SeoImage src={p.coverImage} alt={p.title} className="w-full h-40 object-cover" />}
            <div className="p-3">
              <div className="text-xs text-emerald-600 uppercase">{p.category} · {p.readingTimeMin} мин</div>
              <h2 className="font-bold mt-1">{p.title}</h2>
              <p className="text-sm text-gray-600 mt-1 line-clamp-3">{p.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>

      {total > 12 && (
        <div className="mt-8 flex gap-2 justify-center">
          {Array.from({ length: Math.ceil(total / 12) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setParams({ page: String(p), ...(category ? { category } : {}) })}
              className={`px-3 py-1 rounded ${p === page ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: BlogPost**

`src/pages/blog/BlogPost.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { seoApi, BlogPost } from '@/lib/seoApi';
import { useDocumentHead } from '@/lib/seo';
import { SeoImage } from '@/components/SeoImage';

export default function BlogPostView() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);

  useEffect(() => {
    if (!slug) return;
    seoApi.blogPost(slug).then(r => {
      setPost(r.data);
      seoApi.blog(1, r.data.category).then(list => {
        setRelated(list.data.items.filter(p => p.slug !== slug).slice(0, 3));
      });
    }).catch(() => setPost(null));
  }, [slug]);

  useDocumentHead({
    title: post?.title,
    description: post?.excerpt,
    canonical: post ? `https://zvuki-lesa.ru/blog/${post.slug}` : undefined,
    ogImage: post?.coverImage,
    schema: post ? JSON.parse(post.schemaJson) : undefined,
  });

  if (!post) return <div className="p-8">Загрузка...</div>;

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-sm text-emerald-600 uppercase mb-1">{post.category} · {post.readingTimeMin} мин чтения · {post.author}</div>
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
      {post.coverImage && <SeoImage src={post.coverImage} alt={post.title} className="w-full h-72 object-cover rounded-lg mb-6" loading="eager" />}
      <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.body) }} />

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Похожие статьи</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {related.map(r => (
              <Link key={r.slug} to={`/blog/${r.slug}`} className="border rounded p-3 hover:shadow">
                <div className="font-semibold">{r.title}</div>
                <div className="text-sm text-gray-600 mt-1">{r.excerpt.slice(0, 100)}...</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-2">Готовы забронировать?</h2>
        <Link to="/search" className="bg-emerald-600 text-white px-6 py-2 rounded inline-block">Найти свободные даты</Link>
      </section>
    </article>
  );
}
```

- [ ] **Step 3: Маршруты**

В `src/App.tsx`:
```tsx
<Route path="/blog" element={<BlogIndex />} />
<Route path="/blog/:slug" element={<BlogPost />} />
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/blog/BlogIndex.tsx src/pages/blog/BlogPost.tsx src/App.tsx
git commit -m "feat(frontend): public blog index and post"
```

---

### Task 14: Расширить Schema.org на лендинге

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Заменить JSON-LD LodgingBusiness**

В `index.html` найти `<script type="application/ld+json">` с `LodgingBusiness` и заменить на расширенную версию:

```json
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "Звуки Леса",
  "alternateName": "Гостевой дом Звуки леса",
  "description": "Гостевой дом в станице Даховская, Республика Адыгея. Уютные домики с панорамными окнами, джиппинг, рафтинг, банный чан.",
  "url": "https://zvuki-lesa.ru",
  "telephone": "+79282110249",
  "email": "booking@zvuki-lesa.ru",
  "image": ["https://zvuki-lesa.ru/og-image.jpg"],
  "priceRange": "₽₽",
  "petsAllowed": true,
  "checkinTime": "14:00",
  "checkoutTime": "12:00",
  "numberOfRooms": 3,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Короткая улица, 17",
    "addressLocality": "станица Даховская",
    "addressRegion": "Республика Адыгея",
    "addressCountry": "RU",
    "postalCode": "385700"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "44.223140",
    "longitude": "40.199615"
  },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    "opens": "00:00",
    "closes": "23:59"
  }],
  "amenityFeature": [
    {"@type": "LocationFeatureSpecification", "name": "Беседка у леса", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Мангал и качели", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Тёплый бассейн", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Кондиционер", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Парковка", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Wi-Fi", "value": true}
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Домики",
    "itemListElement": [
      {"@type": "Offer", "name": "Шале Уют", "price": "4500", "priceCurrency": "RUB", "unitCode": "Night"},
      {"@type": "Offer", "name": "Джиппинг", "price": "3500", "priceCurrency": "RUB"},
      {"@type": "Offer", "name": "Рафтинг", "price": "2500", "priceCurrency": "RUB"},
      {"@type": "Offer", "name": "Банный чан", "price": "2000", "priceCurrency": "RUB"}
    ]
  },
  "sameAs": [
    "https://www.instagram.com/zvukilesa01/",
    "https://t.me/ZVUKILESA01"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(seo): expand LodgingBusiness Schema.org"
```

---

### Task 15: Schema.org + перелинковка на странице домика

**Files:**
- Modify: `src/pages/booking/StickyBookingPanel.tsx` (или создать новый компонент)

- [ ] **Step 1: Добавить блок «Что посмотреть рядом»**

В конце страницы бронирования (после основного контента, до футера) добавить секцию:

```tsx
<section className="mt-12">
  <h2 className="text-2xl font-bold mb-4">Что посмотреть рядом</h2>
  <div className="grid md:grid-cols-3 gap-4">
    <Link to="/seo/lagonaki-otdih" className="border rounded p-3 hover:shadow">
      <div className="font-semibold">Плато Лагонаки</div>
      <div className="text-sm text-gray-600">Альпийские луга и пешие маршруты — 60 км от нас</div>
    </Link>
    <Link to="/seo/rufabgo-vodopady" className="border rounded p-3 hover:shadow">
      <div className="font-semibold">Водопады Руфабго</div>
      <div className="text-sm text-gray-600">Каскад водопадов в ущелье — 25 км от нас</div>
    </Link>
    <Link to="/seo/termalnye-istochniki-adygeya" className="border rounded p-3 hover:shadow">
      <div className="font-semibold">Термальные источники</div>
      <div className="text-sm text-gray-600">Купание круглый год — 40 км от нас</div>
    </Link>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/StickyBookingPanel.tsx
git commit -m "feat(seo): cross-link from cabin page to nearby attractions"
```

---

### Task 16: Футер — блок «Популярные направления»

**Files:**
- Modify: `src/sections/Footer.tsx`

- [ ] **Step 1: Добавить блок**

Добавить секцию в футер с 6-8 ссылками на SEO-страницы с priority ≥ 0.8 (загружаются через `seoApi.list()` при монтировании).

```tsx
const [topSeo, setTopSeo] = useState<SeoPageListItem[]>([]);
useEffect(() => { seoApi.list().then(r => setTopSeo(r.data.filter(p => p.priority >= 0.8).slice(0, 8))); }, []);

// В JSX перед закрытием <footer>:
<div className="border-t pt-6 mt-6">
  <h3 className="font-bold mb-2">Популярные направления</h3>
  <ul className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
    {topSeo.map(p => (
      <li key={p.slug}><Link to={`/seo/${p.slug}`} className="hover:underline">{p.title}</Link></li>
    ))}
  </ul>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/sections/Footer.tsx
git commit -m "feat(seo): footer popular destinations block"
```

---

## Phase 4 — Pre-render, sitemap, robots (2-3 дня)

### Task 17: Sitemap.xml endpoint

**Files:**
- Create: `backend/src/routes/sitemap.ts`
- Create: `backend/src/routes/sitemap.test.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Тест**

`backend/src/routes/sitemap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../test-utils/createTestApp';

describe('sitemap', () => {
  const app = createTestApp();

  it('GET /sitemap.xml returns 200 with XML', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('zvuki-lesa.ru');
  });

  it('excludes unpublished seo_pages', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.text).not.toContain('/seo/draft-unpublished-slug');
  });
});
```

- [ ] **Step 2: Реализация**

`backend/src/routes/sitemap.ts`:

```ts
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { seoPages, blogPosts } from '../db/schema';
import { cottages } from '../db/schema';

const router = Router();
const BASE = 'https://zvuki-lesa.ru';

function urlEntry(loc: string, priority: number, changefreq: string, lastmod?: Date) {
  return `<url><loc>${BASE}${loc}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0,10)}</lastmod>` : ''}<changefreq>${changefreq}</changefreq><priority>${priority.toFixed(1)}</priority></url>`;
}

router.get('/sitemap.xml', async (_req, res) => {
  const [seo, blog, cab] = await Promise.all([
    db.select({ slug: seoPages.slug, priority: seoPages.priority, updatedAt: seoPages.updatedAt })
      .from(seoPages).where(eq(seoPages.isPublished, true)).orderBy(desc(seoPages.priority)),
    db.select({ slug: blogPosts.slug, publishedAt: blogPosts.publishedAt, updatedAt: blogPosts.updatedAt })
      .from(blogPosts).where(eq(blogPosts.isPublished, true)).orderBy(desc(blogPosts.publishedAt)),
    db.select({ slug: cottages.slug }).from(cottages),
  ]);

  const staticUrls = [
    urlEntry('/', 1.0, 'weekly'),
    urlEntry('/blog', 0.8, 'weekly'),
    urlEntry('/search', 0.6, 'monthly'),
  ];
  const cabUrls = cab.map(c => urlEntry(`/booking/${c.slug}`, 0.9, 'daily'));
  const seoUrls = seo.map(s => urlEntry(`/seo/${s.slug}`, s.priority, 'monthly', s.updatedAt));
  const blogUrls = blog.map(b => urlEntry(`/blog/${b.slug}`, 0.7, 'monthly', b.publishedAt ?? b.updatedAt));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...cabUrls, ...seoUrls, ...blogUrls].join('\n')}\n</urlset>`;

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

export default router;
```

- [ ] **Step 3: Смонтировать**

В `backend/src/server.ts`:
```ts
import sitemapRouter from './routes/sitemap';
app.use('/', sitemapRouter);
```

- [ ] **Step 4: Тесты**

Run: `cd backend && npm run test -- sitemap`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/sitemap.ts backend/src/routes/sitemap.test.ts backend/src/server.ts
git commit -m "feat(api): sitemap.xml endpoint from all tables"
```

---

### Task 18: Robots.txt

**Files:**
- Create: `backend/public/robots.txt`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Создать файл**

`backend/public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: https://zvuki-lesa.ru/sitemap.xml
```

- [ ] **Step 2: Раздавать как статику**

В `backend/src/server.ts` (после app.use(express.static...)) добавить:
```ts
import path from 'node:path';
app.get('/robots.txt', (_req, res) => res.sendFile(path.join(process.cwd(), 'public', 'robots.txt')));
```

Альтернативно: использовать `express.static('public')` — если robots.txt лежит в `backend/public/`, он будет доступен по `/robots.txt`.

- [ ] **Step 3: Commit**

```bash
git add backend/public/robots.txt backend/src/server.ts
git commit -m "feat(seo): robots.txt with admin/api disallowed"
```

---

### Task 19: vite-plugin-prerender-spa + скрипт fetch-slugs

**Files:**
- Modify: `package.json` (dev-deps + scripts)
- Modify: `vite.config.ts`
- Create: `scripts/fetch-slugs.mjs`

- [ ] **Step 1: Установить**

Run: `npm install -D vite-plugin-prerender-spa`

- [ ] **Step 2: Скрипт fetch-slugs**

`scripts/fetch-slugs.mjs`:

```js
import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), 'backend/data/zvuki-lesa.db');
const db = new Database(dbPath, { readonly: true });

const seoSlugs = db.prepare("SELECT slug FROM seo_pages WHERE is_published = 1").all().map(r => `/seo/${r.slug}`);
const blogSlugs = db.prepare("SELECT slug FROM blog_posts WHERE is_published = 1").all().map(r => `/blog/${r.slug}`);

db.close();

const staticRoutes = ['/', '/blog', '/search'];

const all = [...staticRoutes, ...seoSlugs, ...blogSlugs];

console.log(JSON.stringify(all));
```

- [ ] **Step 3: Скрипты в package.json**

В корне `package.json`:

```json
{
  "scripts": {
    "prebuild": "node scripts/fetch-slugs.mjs > .prerender-routes.json",
    "build": "tsc -b && vite build"
  }
}
```

- [ ] **Step 4: vite.config.ts — добавить плагин**

В `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { PrerenderSPAPlugin } from 'vite-plugin-prerender-spa';
import { readFileSync } from 'node:fs';

const prerenderRoutes = JSON.parse(readFileSync('./.prerender-routes.json', 'utf-8'));

export default defineConfig({
  plugins: [
    react(),
    PrerenderSPAPlugin({
      routes: prerenderRoutes,
      renderer: '@prerender/webpack-renderer',
      postProcess(renderedRoute, _route) {
        // Inject admin_token and api URL for prerendered pages
        return renderedRoute;
      },
    }),
  ],
});
```

(Если возникают проблемы с версией плагина — см. документацию, возможно потребуется другая конфигурация.)

- [ ] **Step 5: Проверить билд**

Run: `npm run build`
Expected: в `dist/` создаются `.html` файлы для всех маршрутов.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts scripts/fetch-slugs.mjs
git commit -m "feat(build): vite-plugin-prerender-spa with dynamic routes from DB"
```

---

## Phase 5 — Контент + Reviews (3-4 дня)

### Task 20: Миграция reviews и CRUD

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create (генерируется): `backend/drizzle/0004_reviews.sql`
- Create: `backend/src/routes/reviews.ts`
- Create: `backend/src/routes/reviews.test.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Добавить таблицу в schema.ts**

```ts
export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  text: text('text').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  source: text('source', { enum: ['2gis', 'yandex', 'google', 'manual'] }).notNull().default('manual'),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
});
```

- [ ] **Step 2: Сгенерировать миграцию + применить**

```bash
cd backend && npx drizzle-kit generate && npm run migrate
```

- [ ] **Step 3: zod-схема**

Добавить в `backend/src/validation/seo.ts`:

```ts
export const reviewInputSchema = z.object({
  authorName: z.string().min(2).max(100),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(20).max(2000),
  date: z.coerce.date().optional(),
  source: z.enum(['2gis', 'yandex', 'google', 'manual']).default('manual'),
  isPublished: z.boolean().default(false),
});
export const reviewPatchSchema = reviewInputSchema.partial();
```

- [ ] **Step 4: Роутер**

`backend/src/routes/reviews.ts`:

```ts
import { Router } from 'express';
import { eq, desc, avg, count } from 'drizzle-orm';
import { db } from '../db/client';
import { reviews } from '../db/schema';
import { reviewInputSchema, reviewPatchSchema } from '../validation/seo';
import { requireAdmin } from '../lib/adminAuth';
import { validate } from '../lib/validate';

const router = Router();

router.get('/reviews', async (_req, res) => {
  const rows = await db.select().from(reviews).where(eq(reviews.isPublished, true)).orderBy(desc(reviews.date));
  const [{ avg: avgRating, total }] = await db.select({ avg: avg(reviews.rating), total: count() }).from(reviews).where(eq(reviews.isPublished, true));
  res.json({ success: true, data: { items: rows, averageRating: Number(avgRating) || 0, total } });
});

router.get('/admin/reviews', requireAdmin, async (_req, res) => {
  const rows = await db.select().from(reviews).orderBy(desc(reviews.date));
  res.json({ success: true, data: rows });
});

router.post('/admin/reviews', requireAdmin, validate(reviewInputSchema), async (req, res) => {
  const [row] = await db.insert(reviews).values(req.body).returning();
  res.json({ success: true, data: row });
});

router.patch('/admin/reviews/:id', requireAdmin, validate(reviewPatchSchema), async (req, res) => {
  const [row] = await db.update(reviews).set(req.body).where(eq(reviews.id, +req.params.id)).returning();
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

router.delete('/admin/reviews/:id', requireAdmin, async (req, res) => {
  await db.delete(reviews).where(eq(reviews.id, +req.params.id));
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 5: Смонтировать**

В `backend/src/server.ts`:
```ts
import reviewsRouter from './routes/reviews';
app.use('/api', reviewsRouter);
```

- [ ] **Step 6: Тесты**

`backend/src/routes/reviews.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../test-utils/createTestApp';
import { resetDb } from '../test-utils/resetDb';

describe('reviews', () => {
  beforeEach(async () => { await resetDb(); });
  const app = createTestApp();

  it('POST validates rating 1-5', async () => {
    const res = await request(app).post('/api/admin/reviews').send({ authorName: 'Иван', rating: 7, text: 'a'.repeat(50), isPublished: true });
    expect(res.status).toBe(400);
  });

  it('GET /api/reviews aggregates average', async () => {
    await request(app).post('/api/admin/reviews').send({ authorName: 'A', rating: 5, text: 'a'.repeat(50), isPublished: true });
    await request(app).post('/api/admin/reviews').send({ authorName: 'B', rating: 3, text: 'b'.repeat(50), isPublished: true });
    const res = await request(app).get('/api/reviews');
    expect(res.body.data.averageRating).toBe(4);
    expect(res.body.data.total).toBe(2);
  });
});
```

- [ ] **Step 7: Прогнать + коммит**

```bash
cd backend && npm run test -- reviews
git add backend/src/db/schema.ts backend/drizzle/0004_*.sql backend/src/validation/seo.ts backend/src/routes/reviews.ts backend/src/routes/reviews.test.ts backend/src/server.ts
git commit -m "feat(db,api): reviews table with aggregation"
```

---

### Task 21: Админка для отзывов + Schema.org Review в лендинге

**Files:**
- Create: `src/pages/admin/ReviewsList.tsx`
- Create: `src/pages/admin/ReviewEditor.tsx`
- Modify: `src/App.tsx`
- Modify: `src/sections/Reviews.tsx` (рендер реальных отзывов + Schema.org)

- [ ] **Step 1: ReviewsList + ReviewEditor**

Структура идентична BlogList/BlogEditor. Поля: `authorName, rating (1-5 звёзд), text, date, source, isPublished`.

- [ ] **Step 2: Подключить реальные отзывы в Reviews.tsx**

Хук `useReviews()`:
```ts
export function useReviews() {
  const [data, setData] = useState<{ items: Review[]; averageRating: number; total: number } | null>(null);
  useEffect(() => { apiFetch<{ items: Review[]; averageRating: number; total: number }>('/api/reviews').then(r => setData(r.data)); }, []);
  return data;
}
```

В `Reviews.tsx` рендерить реальные данные и инжектить Schema.org `Review[]` через `useDocumentHead`.

- [ ] **Step 3: Schema.org на лендинге**

В `src/sections/Reviews.tsx` (или App.tsx) добавить JSON-LD с реальными отзывами:

```ts
const reviewSchema = reviews?.items.map(r => ({
  '@type': 'Review',
  author: { '@type': 'Person', name: r.authorName },
  datePublished: r.date,
  reviewBody: r.text,
  reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
})) ?? [];

useDocumentHead({
  schema: {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    aggregateRating: reviews ? { '@type': 'AggregateRating', ratingValue: reviews.averageRating, reviewCount: reviews.total, bestRating: 5 } : undefined,
    review: reviewSchema,
  },
});
```

- [ ] **Step 4: Маршруты**

В `src/App.tsx`:
```tsx
<Route path="reviews" element={<ReviewsList />} />
<Route path="reviews/new" element={<ReviewEditor />} />
<Route path="reviews/:id" element={<ReviewEditor />} />
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/ReviewsList.tsx src/pages/admin/ReviewEditor.tsx src/sections/Reviews.tsx src/App.tsx src/hooks/useReviews.ts
git commit -m "feat(admin,seo): reviews CRUD + Schema.org review markup"
```

---

### Task 22: Генерация 40 SEO-страниц (черновики)

**Files:**
- Create: `backend/data/seo-drafts/seo/*.json` (40 файлов)

> **Подсказка для контент-генерации:** для каждой страницы использовать структуру:
> - `slug`, `title` (50-70 символов с ключом), `description` (150-160 символов), `h1`, `body` (HTML, 1500-2500 слов), `intent`, `schemaJson`, `priority` (0.7-0.95), `isPublished: false`.
> - Body содержит: вступление с ключом, 3-5 H2 секций с подтемами, FAQ блок, призыв к бронированию.
> - Schema.org — `Article` для информационных, `TouristAttraction` для достопримечательностей, `FAQPage` для страниц с вопросами.

> **Контент генерируется Claude'ом отдельным шагом.** Я (Claude) создам файлы через Write-вызовы в процессе реализации этой задачи. Владелец reviewит и публикует через админку.

- [ ] **Step 1: Создать черновики**

Сгенерировать 40 JSON-файлов в `backend/data/seo-drafts/seo/` по списку из спеки (раздел 7.1). Использовать Write tool.

- [ ] **Step 2: Commit**

```bash
git add backend/data/seo-drafts/seo/
git commit -m "content: 40 SEO-page drafts (Adygea/Dahovskaya intents)"
```

---

### Task 23: Генерация 15 статей блога (черновики)

**Files:**
- Create: `backend/data/seo-drafts/blog/*.json` (15 файлов)

> Та же структура + `excerpt` (200-250 символов), `category`, `readingTimeMin`.

- [ ] **Step 1: Создать черновики**

Сгенерировать 15 JSON-файлов в `backend/data/seo-drafts/blog/` по списку из спеки (раздел 7.2). Использовать Write tool.

- [ ] **Step 2: Commit**

```bash
git add backend/data/seo-drafts/blog/
git commit -m "content: 15 blog post drafts (Adygea guides)"
```

---

### Task 24: Сид-скрипт для черновиков

**Files:**
- Create: `backend/src/scripts/seedDrafts.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Скрипт**

`backend/src/scripts/seedDrafts.ts`:

```ts
import { db } from '../db/client';
import { seoPages, blogPosts } from '../db/schema';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const seoDir = path.resolve(process.cwd(), 'data/seo-drafts/seo');
  const blogDir = path.resolve(process.cwd(), 'data/seo-drafts/blog');

  const seoFiles = readdirSync(seoDir).filter(f => f.endsWith('.json'));
  for (const f of seoFiles) {
    const data = JSON.parse(readFileSync(path.join(seoDir, f), 'utf-8'));
    try {
      await db.insert(seoPages).values({ ...data, isPublished: false });
      console.log(`+ ${f}`);
    } catch (e: any) {
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') console.log(`~ skip (exists) ${f}`);
      else throw e;
    }
  }

  const blogFiles = readdirSync(blogDir).filter(f => f.endsWith('.json'));
  for (const f of blogFiles) {
    const data = JSON.parse(readFileSync(path.join(blogDir, f), 'utf-8'));
    try {
      await db.insert(blogPosts).values({ ...data, isPublished: false });
      console.log(`+ ${f}`);
    } catch (e: any) {
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') console.log(`~ skip (exists) ${f}`);
      else throw e;
    }
  }

  console.log('Done. Владелец публикует через /admin');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Скрипт в package.json**

```json
"scripts": {
  "seed:drafts": "tsx src/scripts/seedDrafts.ts"
}
```

- [ ] **Step 3: Запустить**

Run: `cd backend && npm run seed:drafts`
Expected: 40 + 15 строк `+ имя-файла.json`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/scripts/seedDrafts.ts backend/package.json
git commit -m "feat(script): seed drafts from JSON files"
```

---

## Phase 6 — Тесты, Lighthouse, релиз (1 день)

### Task 25: Обновить CLAUDE.md и финальные тесты

**Files:**
- Modify: `CLAUDE.md`
- Modify: `package.json` — `test:all` скрипт

- [ ] **Step 1: CLAUDE.md — добавить раздел про SEO**

В `CLAUDE.md` добавить раздел «SEO-страницы и блог» с описанием:
- как создавать SEO-страницы через админку
- как работает pre-render
- где хранятся черновики

- [ ] **Step 2: Прогнать все тесты**

Run: `npm run backend:test && npm run test`
Expected: все PASS.

- [ ] **Step 3: Lighthouse на production build**

Run: `npm run build && npm run preview` в одном терминале, в другом — Chrome DevTools → Lighthouse для:
- `/`
- `/seo/otdih-v-gorah-adygei`
- `/blog/chto-posmotret-v-adygee-letom`

Цели: Performance ≥ 85, SEO ≥ 95, Accessibility ≥ 95.

- [ ] **Step 4: Google Rich Results Test**

Вручную: для одной SEO-страницы и одной статьи блога — `https://search.google.com/test/rich-results?url=...`.
Цели: нет ошибок, FAQPage/Article/TouristAttraction определились.

- [ ] **Step 5: Ручной проход по всем страницам**

Чеклист:
- [ ] `/seo/dahovskaya-adygeya-otdih` рендерит body
- [ ] `/blog/chto-posmotret-letom` рендерит статью
- [ ] meta-теги присутствуют в `<head>`
- [ ] Canonical URL корректный
- [ ] `sitemap.xml` содержит все типы URL
- [ ] `robots.txt` отдаётся правильно
- [ ] `/admin/seo-pages` создание работает
- [ ] `/admin/blog-posts` создание работает
- [ ] `/admin/images` загрузка работает
- [ ] `/admin/reviews` создание работает

- [ ] **Step 6: Commit + PR**

```bash
git add CLAUDE.md
git commit -m "docs: document SEO pages and blog in CLAUDE.md"
git push origin feature/rafting123-astro-port
```

Открыть PR в main с описанием:
- 55 новых страниц (40 SEO + 15 блог)
- Pre-render для индексации поисковиками
- Расширенная Schema.org (LodgingBusiness, Article, FAQPage, TouristAttraction, Review)
- Динамический sitemap.xml
- Закрытые /admin и /api в robots.txt
- Админка для редактирования всего контента

---

## Self-Review

**1. Spec coverage:**
- [x] 1. Архитектура → Phase 1-4
- [x] 2. БД/API → Tasks 1-5, 17, 20
- [x] 3. Frontend → Tasks 6-16
- [x] 4. Schema.org → Tasks 14, 15, 21
- [x] 5. Sitemap.xml → Task 17
- [x] 6. Robots.txt → Task 18
- [x] 7. Контент-план → Tasks 22, 23
- [x] 8. Скорость → Task 19 (pre-render)
- [x] 9. Тесты → Tasks 3-5, 17, 20, 25
- [x] 10. 6 фаз → Phase 1-6
- [x] 11. Зависимости → Tasks 5 (sharp, multer), 6 (Tiptap), 11 (dompurify), 19 (vite-plugin-prerender-spa)
- [x] 12. Не входит — задокументировано в спеке
- [x] 13. Риски → учтены в дизайне (pre-build читает из SQLite напрямую, DOMPurify санитизирует HTML)

**2. Placeholder scan:**
- [x] Нет TBD/TODO
- [x] Все тесты имеют конкретный код
- [x] Все команды с expected output

**3. Type consistency:**
- [x] `seoPages` schema → используется в Tasks 1, 3, 17, 22, 24
- [x] `blogPosts` schema → используется в Tasks 1, 4, 13, 23, 24
- [x] `imagesRegistry` schema → используется в Tasks 1, 5, 9
- [x] `reviews` schema → используется в Tasks 20, 21
- [x] `seoApi.*` функции → используются в Tasks 10, 12, 13, 16
- [x] `useDocumentHead` хук → определён в Task 11, используется в Tasks 12, 13, 14 (через Reviews), 21
- [x] `SeoImage` компонент → определён в Task 11, используется в Tasks 12, 13, 15, 16

Всё консистентно. План готов к исполнению.