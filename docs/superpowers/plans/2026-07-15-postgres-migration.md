# Postgres Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the backend of «Звуки леса» from SQLite (better-sqlite3) to Postgres (postgres-js + Drizzle pg-core), and deliver a SQL dump (`zvuki-lesa-pg-dump.sql`) the user can apply on their own server.

**Architecture:**
- Driver swap: `better-sqlite3` → `postgres` (postgres.js). Async throughout.
- Schema: `sqliteTable` → `pgTable`, native PG types (`serial`, `timestamp`, `date`, `boolean`, `pgEnum`, `jsonb`, `doublePrecision`).
- Migrations: 8 old SQLite `.sql` files deleted, single fresh `0000_initial.sql` generated via `drizzle-kit`.
- Async conversion: ~50 sync db calls (`.run()`, `.all()`, `.get()`) across routes and tests become `await`.
- Tests: `vitest.setup.ts` rewritten against postgres-js; `resetDb()` helper added for `beforeEach`.

**Tech Stack:**
- Backend: Node.js + Express 4 + TypeScript 5.9
- ORM: Drizzle ORM (pg-core)
- DB driver: postgres (postgres.js)
- Test runner: Vitest + supertest
- Local DB: `postgres:16-alpine` via Docker

**Spec reference:** `docs/superpowers/specs/2026-07-15-postgres-migration-design.md`

---

## File Structure

**Files created:**
- `backend/src/db/test-utils.ts` — `resetDb()` utility for test isolation

**Files deleted:**
- `backend/drizzle/0000_white_klaw.sql`
- `backend/drizzle/0001_parallel_wallow.sql`
- `backend/drizzle/0002_bent_franklin_storm.sql`
- `backend/drizzle/0003_melodic_squirrel_girl.sql`
- `backend/drizzle/0004_seo_blog_images.sql`
- `backend/drizzle/0005_seo_blog_indexes.sql`
- `backend/drizzle/0006_reviews.sql`
- `backend/drizzle/0007_cottage_sections_and_description.sql`
- `backend/data/zvuki-lesa.db` (and `-wal`, `-shm` companions) — no longer used
- `backend/data/zvuki-lesa.test.db` (and `-wal`, `-shm` companions) — no longer used

**Files rewritten:**
- `backend/package.json` — dependency swap
- `backend/drizzle.config.ts` — `dialect: 'postgresql'`
- `backend/.env.example` — adds `DATABASE_URL`
- `backend/src/db/schema.ts` — all 16 tables to pg-core
- `backend/src/db/client.ts` — postgres-js driver
- `backend/src/db/migrate.ts` — postgres-js migrator
- `backend/src/db/seed.ts` — `TRUNCATE` + async
- `backend/src/scripts/seedDrafts.ts` — PG error code `23505`
- `backend/vitest.setup.ts` — postgres-js test setup
- `backend/drizzle/0000_*.sql` — generated fresh PG migration

**Files with mechanical async conversion (no logic change):**
- `backend/src/routes/admin.ts` (3 db calls)
- `backend/src/routes/analytics.ts` (2 db calls)
- `backend/src/routes/bookings.ts` (2 db calls)
- `backend/src/routes/blogPosts.ts` (0 db calls — only `updatedAt` Date fix)
- `backend/src/routes/seoPages.ts` (0 db calls — only `updatedAt` Date fix)
- All `*.test.ts` files (~30+ db calls across 9 files)

**Files unchanged:**
- `backend/src/routes/{availability,calendar,cottages,images,reviews,services,sitemap}.ts` (no `.run()/.all()/.get()` patterns found)
- `backend/src/services/{maxBot,notifications,maxPoller,pricing,availability}.ts`
- All frontend code

---

## Convention: Async Transformation Pattern

Documented once, applied everywhere in Tasks 13-17:

| Old (sync, SQLite) | New (async, PG) |
|---|---|
| `db.delete(t).run()` | `await db.delete(t)` |
| `db.insert(t).values(x).run()` | `await db.insert(t).values(x)` |
| `db.insert(t).values(x).returning().get()` | `const [row] = await db.insert(t).values(x).returning()` |
| `db.select().from(t).all()` | `await db.select().from(t)` (returns array directly) |
| `db.select().from(t).where(...).get()` | `(await db.select().from(t).where(...))[0]` |
| `tx.insert(...).values(x).run()` | `await tx.insert(...).values(x)` |

In test files, `beforeEach` becomes `async () => { ... }`.

In route handlers, handlers that already use `async (req, res) => { ... }` only need `await` added. Handlers using `express-async-errors` can stay sync — Drizzle errors throw via Promise rejection, and `express-async-errors` forwards them to `errorHandler`.

---

## Task 1: Update dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Remove better-sqlite3 packages**

Edit `backend/package.json`:
- In `dependencies`: remove `"better-sqlite3": "^11.5.0"`
- In `devDependencies`: remove `"@types/better-sqlite3": "^7.6.12"`

- [ ] **Step 2: Add postgres package**

Edit `backend/package.json`:
- In `dependencies`: add `"postgres": "^3.4.5"` (latest stable at time of writing)

- [ ] **Step 3: Install**

```bash
cd backend && npm install
```

Expected: `npm warn` for removed packages, successful install of `postgres`.

- [ ] **Step 4: Verify removal**

```bash
cd backend && ls node_modules | grep -i sqlite
```
Expected: empty output (no sqlite modules).

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "feat(deps): swap better-sqlite3 → postgres-js for PG migration"
```

---

## Task 2: Update `.env.example` with DATABASE_URL

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add DATABASE_URL line**

Append to `backend/.env.example` (current file ends with `MAX_JOIN_CODE=1501`):
```
# Postgres connection string (PG migration)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs(env): add DATABASE_URL for Postgres"
```

---

## Task 3: Start local Postgres for development/tests

**Files:** none (system-level)

- [ ] **Step 1: Start postgres:16 in Docker**

```bash
docker run --rm -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  --name zvuki-pg \
  postgres:16-alpine
```

Expected: container ID printed, no errors.

- [ ] **Step 2: Create dev and test databases**

```bash
docker exec -it zvuki-pg createdb -U postgres zvuki-lesa
docker exec -it zvuki-pg createdb -U postgres zvuki-lesa-test
```

Expected: no output, both DBs created.

- [ ] **Step 3: Verify connection**

```bash
docker exec -it zvuki-pg psql -U postgres -d zvuki-lesa -c "SELECT 1;"
```
Expected: `?column?` / `1` (single row).

- [ ] **Step 4: Document in CLAUDE.md** (small addition)

In `CLAUDE.md`, after `npm run backend:seed` description, add:

```
Локальная Postgres для разработки и тестов:
- `docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name zvuki-pg postgres:16-alpine`
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa` — dev
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa-test` — тесты
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: local Postgres setup for dev and tests"
```

---

## Task 4: Rewrite `schema.ts` for pg-core

**Files:**
- Rewrite: `backend/src/db/schema.ts`

This is a large rewrite. The full file:

- [ ] **Step 1: Write the new schema file**

Replace entire contents of `backend/src/db/schema.ts` with:

```ts
import { pgTable, serial, integer, text, timestamp, date, boolean, doublePrecision, jsonb, primaryKey, index } from 'drizzle-orm/pg-core';
import { pgEnum } from 'drizzle-orm/pg-core';

// ============ ENUMS ============
export const cottageImageSectionEnum = pgEnum('cottage_image_section', ['main', 'interior', 'kitchen', 'bathroom', 'amenities']);
export const priceRuleModifierEnum = pgEnum('price_rule_modifier', ['percent', 'fixed']);
export const bookingStatusEnum = pgEnum('booking_status', ['new', 'confirmed', 'cancelled']);
export const bookingSourceEnum = pgEnum('booking_source', ['site', 'manual']);
export const reviewSourceEnum = pgEnum('review_source', ['2gis', 'yandex', 'google', 'manual']);

// ============ COTTAGES ============
export const cottages = pgTable('cottages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  mapId: text('map_id').notNull(),
  name: text('name').notNull(),
  shortDescription: text('short_description').notNull(),
  longDescription: text('long_description').notNull(),
  description: text('description'),
  houseRules: text('house_rules'),
  basePrice: integer('base_price').notNull(),
  area: integer('area').notNull(),
  guests: integer('guests').notNull(),
  bedrooms: integer('bedrooms').notNull(),
  bedsDouble: integer('beds_double').notNull().default(0),
  bedsSingle: integer('beds_single').notNull().default(0),
  checkInTime: text('check_in_time').notNull(),
  checkOutTime: text('check_out_time').notNull(),
  mainImage: text('main_image').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const cottageImages = pgTable('cottage_images', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  section: cottageImageSectionEnum('section').notNull().default('interior'),
  position: integer('position').notNull().default(0),
}, (t) => ({
  byCottageSection: index('idx_cottage_images_cottage_section').on(t.cottageId, t.section, t.position),
}));

export const amenities = pgTable('amenities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
});

export const cottageAmenities = pgTable('cottage_amenities', {
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  amenityId: integer('amenity_id').notNull().references(() => amenities.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.cottageId, t.amenityId] }),
}));

export const recreationItems = pgTable('recreation_items', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  photo: text('photo').notNull(),
  position: integer('position').notNull().default(0),
});

// ============ SERVICES & PRICING ============
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  basePrice: integer('base_price'),
  icon: text('icon').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  position: integer('position').notNull().default(0),
});

export const priceRules = pgTable('price_rules', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').references(() => cottages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  modifierType: priceRuleModifierEnum('modifier_type').notNull(),
  modifierValue: integer('modifier_value').notNull(),
  weekendModifier: integer('weekend_modifier'),
  priority: integer('priority').notNull().default(0),
}, (t) => ({
  byDate: index('idx_price_rules_dates').on(t.startDate, t.endDate),
}));

// ============ BOOKINGS ============
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id),
  guestName: text('guest_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  guests: integer('guests').notNull(),
  notes: text('notes'),
  nights: integer('nights').notNull(),
  subtotal: integer('subtotal').notNull(),
  servicesTotal: integer('services_total').notNull().default(0),
  totalPrice: integer('total_price').notNull(),
  status: bookingStatusEnum('status').notNull().default('new'),
  source: bookingSourceEnum('source').notNull().default('site'),
  managerComment: text('manager_comment'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byCottage: index('idx_bookings_cottage').on(t.cottageId, t.checkInDate, t.checkOutDate),
  byStatus: index('idx_bookings_status').on(t.status),
}));

export const bookingServices = pgTable('booking_services', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id),
  quantity: integer('quantity').notNull().default(1),
  priceAtBooking: integer('price_at_booking'),
}, (t) => ({
  byBooking: index('idx_booking_services_booking').on(t.bookingId),
}));

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
});

// ============ SEO / BLOG ============
export const seoPages = pgTable('seo_pages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  h1: text('h1').notNull(),
  body: text('body').notNull(),
  metaImage: text('meta_image'),
  intent: text('intent').notNull(),
  schemaJson: text('schema_json').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  priority: doublePrecision('priority').notNull().default(0.7),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byPublishedPriority: index('idx_seo_pages_published_priority').on(t.isPublished, t.priority),
}));

export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  body: text('body').notNull(),
  coverImage: text('cover_image'),
  author: text('author').notNull().default('Команда Звуки Леса'),
  category: text('category').notNull(),
  readingTimeMin: integer('reading_time_min').notNull().default(5),
  schemaJson: text('schema_json').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byPublishedPublishedAt: index('idx_blog_posts_published_published_at').on(t.isPublished, t.publishedAt),
}));

export const imagesRegistry = pgTable('images_registry', {
  id: serial('id').primaryKey(),
  path: text('path').notNull().unique(),
  alt: text('alt').notNull(),
  caption: text('caption'),
  width: integer('width'),
  height: integer('height'),
  uploadedBy: text('uploaded_by').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  text: text('text').notNull(),
  date: timestamp('date', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  source: reviewSourceEnum('source').notNull().default('manual'),
  isPublished: boolean('is_published').notNull().default(false),
});

export const maxSubscribers = pgTable('max_subscribers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique(),
  chatId: text('chat_id'),
  joinCode: text('join_code').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull(),
  lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true, mode: 'date' }),
  isActive: boolean('is_active').notNull().default(true),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  eventType: text('event_type').notNull(),
  page: text('page'),
  label: text('label'),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  byCreatedAt: index('idx_analytics_events_created_at').on(t.createdAt),
  bySession: index('idx_analytics_events_session').on(t.sessionId),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: errors ONLY about `db/client.ts` (still importing sqlite types). Other files clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat(schema): migrate to pg-core with native PG types"
```

---

## Task 5: Update `drizzle.config.ts` for Postgres

**Files:**
- Modify: `backend/drizzle.config.ts`

- [ ] **Step 1: Replace file contents**

```ts
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/zvuki-lesa',
  },
} satisfies Config;
```

Note: `import 'dotenv/config'` requires `dotenv` to be installed. Check if it is:
```bash
cd backend && cat package.json | grep -E '"dotenv"|"postgres"'
```
If `dotenv` is not in dependencies, the existing `tsx --env-file=.env` in scripts handles loading. Either install dotenv OR remove the `import 'dotenv/config'` line and use `process.env.DATABASE_URL` from the parent shell.

Recommended path: keep the line. If `dotenv` is missing, add it to `backend/package.json` deps: `"dotenv": "^16.4.5"`. drizzle-kit needs env to know which DB to introspect (if it ever does).

- [ ] **Step 2: Commit**

```bash
git add backend/drizzle.config.ts backend/package.json backend/package-lock.json
git commit -m "feat(drizzle): switch config to postgresql dialect"
```

---

## Task 6: Delete old SQLite migrations

**Files:**
- Delete: 8 `.sql` files in `backend/drizzle/`

- [ ] **Step 1: Remove old migrations**

```bash
cd backend && rm -f drizzle/0000_*.sql drizzle/0001_*.sql drizzle/0002_*.sql drizzle/0003_*.sql drizzle/0004_*.sql drizzle/0005_*.sql drizzle/0006_*.sql drizzle/0007_*.sql
```

- [ ] **Step 2: Verify directory is empty of migrations (except meta)**

```bash
ls drizzle/
```
Expected: only `meta/` subdirectory remains.

- [ ] **Step 3: Commit**

```bash
git add -A backend/drizzle/
git commit -m "chore(drizzle): remove old SQLite migrations"
```

---

## Task 7: Generate fresh PG migration

**Files:**
- Create: `backend/drizzle/0000_*.sql` (generated by drizzle-kit)

- [ ] **Step 1: Run drizzle-kit generate**

```bash
cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa npx drizzle-kit generate
```
Expected: writes `drizzle/0000_*.sql` and updates `drizzle/meta/`.

- [ ] **Step 2: Inspect generated SQL**

```bash
ls drizzle/*.sql
head -100 drizzle/0000_*.sql
```
Expected: contains `CREATE TYPE` for 5 enums, `CREATE TABLE` for 16 tables, `CREATE INDEX` for indexes.

- [ ] **Step 3: Apply migration to verify it works**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa npx tsx --env-file=.env src/db/migrate.ts
```
NOTE: `migrate.ts` is still on SQLite at this point and will fail. Skip this step — it's verified after Task 9.

- [ ] **Step 4: Commit**

```bash
git add backend/drizzle/
git commit -m "feat(drizzle): generate initial PG migration"
```

---

## Task 8: Rewrite `client.ts` for postgres-js

**Files:**
- Rewrite: `backend/src/db/client.ts`

- [ ] **Step 1: Replace file contents**

```ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/zvuki-lesa';

// Disable noisy notice logs in dev (PG logs INFO/NOTICE by default)
const client = postgres(url, { onnotice: () => {} });

export { client };
export const db = drizzle(client, { schema });
export { schema };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/db/client.ts
git commit -m "feat(db): swap better-sqlite3 client for postgres-js"
```

---

## Task 9: Rewrite `migrate.ts` for postgres-js

**Files:**
- Rewrite: `backend/src/db/migrate.ts`

- [ ] **Step 1: Replace file contents**

```ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client';

console.log('[migrate] applying migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('[migrate] done');
process.exit(0);
```

- [ ] **Step 2: Apply migration locally to verify**

```bash
cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa npx tsx --env-file=.env src/db/migrate.ts
```
Expected: `[migrate] applying migrations...` then `[migrate] done`. No errors.

- [ ] **Step 3: Verify tables exist in PG**

```bash
docker exec -it zvuki-pg psql -U postgres -d zvuki-lesa -c "\dt"
```
Expected: list of 16 tables (`cottages`, `cottage_images`, `amenities`, `cottage_amenities`, `recreation_items`, `services`, `price_rules`, `bookings`, `booking_services`, `notifications`, `seo_pages`, `blog_posts`, `images_registry`, `reviews`, `max_subscribers`, `analytics_events`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrate.ts
git commit -m "feat(db): migrate runner for postgres-js"
```

---

## Task 10: Rewrite `seed.ts` for async + TRUNCATE

**Files:**
- Rewrite: `backend/src/db/seed.ts`

- [ ] **Step 1: Replace file contents**

```ts
import { sql } from 'drizzle-orm';
import { db } from './client';
import { eq } from 'drizzle-orm';
import {
  cottages, cottageImages, amenities, cottageAmenities, recreationItems,
  services, priceRules,
} from './schema';

async function clear() {
  await db.execute(sql`TRUNCATE TABLE
    booking_services, bookings, notifications, price_rules, services,
    recreation_items, cottage_amenities, amenities, cottage_images, cottages,
    seo_pages, blog_posts, images_registry, reviews, max_subscribers, analytics_events
    RESTART IDENTITY CASCADE`);
}

const CABIN_DATA = [
  {
    slug: 'shale-uyut', mapId: 'Домик1', name: 'Шале Уют',
    shortDescription: 'Комфортабельный двухэтажный дом с панорамными окнами и видом на горы',
    longDescription: 'Шале Уют — это уголок спокойствия в самом сердце Адыгеи. Двухэтажный дом с панорамными окнами, просторной террасой и собственным выходом к лесу.',
    description: 'Шале Уют создан для тех, кто ценит уединение и природу. Натуральное дерево в отделке, тёплые пледы, панорамные окна от пола до потолка и просторная терраса с видом на лес. Идеально для семейного отдыха или уединённой поездки вдвоём в любое время года.',
    houseRules: 'Громкая музыка запрещена. Курение в доме запрещено. Можно с животными по согласованию. Залог сохранности имущества — по договору.',
    basePrice: 4500, area: 49, guests: 5, bedrooms: 2,
    bedsDouble: 2, bedsSingle: 1,
    checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
    gallery: ['/Galary/1.jpg', '/Galary/2.jpg', '/Galary/3.jpg', '/Galary/4.jpg', '/Galary/5.jpg', '/Galary/6.jpg'],
    amenities: ['Площадь: 49 м²', 'Кондиционирование', 'Халаты', 'Тапочки', 'Wi-Fi', 'Бассейн'],
    recreation: [
      { title: 'Банный чан на террасе', description: 'Горячий чан под открытым небом.', photo: '/images/chan.jpg' },
      { title: 'Рафтинг по реке Белой', description: 'Сплав с инструктором.', photo: '/services/rafting/photo_43_2026-04-26_11-45-32.jpg' },
    ],
  },
  {
    slug: 'lesnaya-rezidenciya', mapId: 'Домик2', name: 'Лесная Резиденция',
    shortDescription: 'Уютный дом в окружении соснового леса с террасой',
    longDescription: 'Лесная Резиденция — место, где время замедляется.',
    description: 'Дом в окружении соснового леса с собственной террасой и мангальной зоной. Подходит для семейного отдыха и компаний друзей. Тишина, свежий воздух и близость к главным достопримечательностям Адыгеи.',
    houseRules: 'Громкая музыка запрещена. Курение в доме запрещено. Можно с животными по согласованию.',
    basePrice: 3800, area: 42, guests: 4, bedrooms: 2,
    bedsDouble: 1, bedsSingle: 2,
    checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
    gallery: ['/Galary/7.jpg', '/Galary/8.jpg', '/Galary/9.jpg', '/Galary/10.jpg', '/Galary/11.jpg'],
    amenities: ['Площадь: 42 м²', 'Кондиционирование', 'Терраса', 'Мангальная зона', 'Wi-Fi'],
    recreation: [
      { title: 'Банный чан', description: 'Под открытым небом.', photo: '/images/chan.jpg' },
      { title: 'Рафтинг', description: 'Сплав по реке.', photo: '/services/rafting/photo_42_2026-04-26_11-45-32.jpg' },
    ],
  },
  {
    slug: 'gorny-dom', mapId: 'Домик3', name: 'Горный Дом',
    shortDescription: 'Каждый день начинается с вида на Кавказские горы',
    longDescription: 'Горный Дом — для тех, кто ценит панорамные виды.',
    description: 'Самый просторный дом с панорамным видом на Кавказские горы. Три спальни, камин, просторная гостиная и большая терраса. Для семей и компаний до 6 человек, ценящих комфорт и виды.',
    houseRules: 'Громкая музыка запрещена. Курение в доме запрещено. Можно с животными по согласованию.',
    basePrice: 5200, area: 65, guests: 6, bedrooms: 3,
    bedsDouble: 2, bedsSingle: 2,
    checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
    gallery: ['/Galary/12.jpg', '/Galary/13.jpg', '/Galary/14.jpg', '/Galary/15.jpg', '/Galary/16.jpg', '/Galary/17.jpg'],
    amenities: ['Площадь: 65 м²', 'Кондиционирование', 'Камин', 'Wi-Fi', 'Бассейн'],
    recreation: [
      { title: 'Банный чан', description: 'С панорамным видом.', photo: '/images/chan.jpg' },
      { title: 'Джип-тур', description: 'В горы.', photo: '/services/jeeping/photo_39_2026-04-26_11-45-32.jpg' },
    ],
  },
];

function classifyImage(url: string): 'main' | 'interior' | 'kitchen' | 'bathroom' | 'amenities' {
  const lower = url.toLowerCase();
  if (/kuhn|kitch|kitchen/.test(lower)) return 'kitchen';
  if (/vann|bath|shower|sanuz/.test(lower)) return 'bathroom';
  if (/pool|terrace|terras|banya|chan|barbecue|grill|amen/.test(lower)) return 'amenities';
  return 'interior';
}

const DEFAULT_AMENITIES = [
  'Телевизор', 'Сплит система', 'Душ', 'Туалет', 'Холодильник', 'Микроволновка',
  'Индукционная плита', 'Сушка', 'Фен', 'Полотенца', 'Столовые приборы', 'Постельное бельё',
];

const SERVICES_DATA = [
  { slug: 'rafting', name: 'Рафтинг', description: 'Сплав по горной реке', basePrice: 2500, icon: 'Waves' },
  { slug: 'jeeping', name: 'Джиппинг', description: 'Тур по горным дорогам', basePrice: 3500, icon: 'Mountain' },
  { slug: 'bath-cham', name: 'Банный чан', description: 'Чан на террасе', basePrice: 2000, icon: 'Flame' },
  { slug: 'horse-ride', name: 'Конные прогулки', description: 'Верховая прогулка', basePrice: 1500, icon: 'Users' },
  { slug: 'atv', name: 'Квадроциклы', description: 'Катание по маршрутам', basePrice: 3000, icon: 'Bike' },
];

async function run() {
  await clear();

  for (const c of CABIN_DATA) {
    const mainImageUrl = c.gallery[0]!;
    const [cottage] = await db.insert(cottages).values({
      slug: c.slug, mapId: c.mapId, name: c.name,
      shortDescription: c.shortDescription, longDescription: c.longDescription,
      description: c.description, houseRules: c.houseRules,
      basePrice: c.basePrice, area: c.area, guests: c.guests, bedrooms: c.bedrooms,
      bedsDouble: c.bedsDouble, bedsSingle: c.bedsSingle,
      checkInTime: c.checkInTime, checkOutTime: c.checkOutTime,
      mainImage: mainImageUrl,
    }).returning();

    let position = 0;
    for (const [idx, url] of c.gallery.entries()) {
      const section = idx === 0 ? 'main' : classifyImage(url);
      await db.insert(cottageImages).values({
        cottageId: cottage!.id, url, section, position: position++,
      });
    }

    for (const name of [...c.amenities, ...DEFAULT_AMENITIES]) {
      const existing = await db.select().from(amenities).where(eq(amenities.name, name));
      let amenityId: number;
      if (existing.length > 0) {
        amenityId = existing[0]!.id;
      } else {
        const [inserted] = await db.insert(amenities).values({ name }).returning();
        amenityId = inserted!.id;
      }
      await db.insert(cottageAmenities).values({ cottageId: cottage!.id, amenityId });
    }

    for (const [pos, r] of c.recreation.entries()) {
      await db.insert(recreationItems).values({
        cottageId: cottage!.id, title: r.title, description: r.description,
        photo: r.photo, position: pos,
      });
    }
  }

  for (const [pos, s] of SERVICES_DATA.entries()) {
    await db.insert(services).values({
      slug: s.slug, name: s.name, description: s.description,
      basePrice: s.basePrice, icon: s.icon, position: pos,
    });
  }

  await db.insert(priceRules).values({
    cottageId: null, name: 'Высокий сезон (июль-август)',
    startDate: '2026-07-01', endDate: '2026-08-31',
    modifierType: 'percent', modifierValue: 30, weekendModifier: 10, priority: 0,
  });

  await db.insert(priceRules).values({
    cottageId: null, name: 'Новый год',
    startDate: '2026-12-25', endDate: '2027-01-08',
    modifierType: 'percent', modifierValue: 100, weekendModifier: null, priority: 10,
  });

  console.log('[seed] done');
  process.exit(0);
}

run().catch((e) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Run seed against local PG**

```bash
cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa npx tsx --env-file=.env src/db/seed.ts
```
Expected: `[seed] done`. No errors.

- [ ] **Step 3: Verify seed worked**

```bash
docker exec -it zvuki-pg psql -U postgres -d zvuki-lesa -c "SELECT name FROM cottages;"
```
Expected: 3 rows (Шале Уют, Лесная Резиденция, Горный Дом).

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/seed.ts
git commit -m "feat(seed): async TRUNCATE + insert demo data for PG"
```

---

## Task 11: Update `seedDrafts.ts` for PG error code

**Files:**
- Modify: `backend/src/scripts/seedDrafts.ts` (2 lines)

- [ ] **Step 1: Replace SQLITE_CONSTRAINT_UNIQUE with PG code**

In `backend/src/scripts/seedDrafts.ts`:
- Line 56: `if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {` → `if (e?.code === '23505') { // PG unique_violation`
- Line 105: same replacement

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: 0 errors related to seedDrafts (other errors OK at this point).

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seedDrafts.ts
git commit -m "fix(seed-drafts): use PG unique_violation code 23505"
```

---

## Task 12: Rewrite `vitest.setup.ts` for postgres-js

**Files:**
- Rewrite: `backend/vitest.setup.ts`

- [ ] **Step 1: Replace file contents**

```ts
// Vitest setup: applies all PG migrations to zvuki-lesa-test DB.
// Run order: vitest config loads this BEFORE any tests, so test DB is ready
// when beforeEach hooks fire. Each test file's beforeEach calls resetDb().
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from './db/schema';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/zvuki-lesa-test';
const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });

await migrate(db, { migrationsFolder: './drizzle' });
console.log('[vitest.setup] pg test db ready');

await client.end();
```

- [ ] **Step 2: Verify the file runs**

```bash
cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa-test npx tsx --env-file=.env vitest.setup.ts
```
Expected: `[vitest.setup] pg test db ready`. No errors.

- [ ] **Step 3: Verify tables in test DB**

```bash
docker exec -it zvuki-pg psql -U postgres -d zvuki-lesa-test -c "\dt"
```
Expected: same 16 tables as dev DB.

- [ ] **Step 4: Commit**

```bash
git add backend/vitest.setup.ts
git commit -m "feat(test): rewrite vitest.setup for postgres-js"
```

---

## Task 13: Create `db/test-utils.ts` with `resetDb()`

**Files:**
- Create: `backend/src/db/test-utils.ts`

- [ ] **Step 1: Create file**

```ts
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type DB = PostgresJsDatabase<typeof schema>;

export async function resetDb(db: DB): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE
    booking_services, bookings, notifications, price_rules, services,
    recreation_items, cottage_amenities, amenities, cottage_images, cottages,
    seo_pages, blog_posts, images_registry, reviews, max_subscribers, analytics_events
    RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/db/test-utils.ts
git commit -m "feat(test): add resetDb utility for test isolation"
```

---

## Task 14: Convert route files to async db calls

**Files:**
- Modify: `backend/src/routes/admin.ts`
- Modify: `backend/src/routes/analytics.ts`
- Modify: `backend/src/routes/bookings.ts`

Apply the Convention pattern from plan header to these files.

- [ ] **Step 1: Convert `admin.ts`**

In `backend/src/routes/admin.ts`, apply these specific edits:

Line 147-149 (in POST /bookings handler):
```ts
// Before:
const inserted = db.insert(bookings).values({...}).returning().get();
for (const row of rows) {
  tx.insert(bookingServices).values({ ...row, bookingId: inserted.id }).run();
}
// After:
const [inserted] = await db.insert(bookings).values({...}).returning();
for (const row of rows) {
  await tx.insert(bookingServices).values({ ...row, bookingId: inserted.id });
}
```

- [ ] **Step 2: Convert `analytics.ts`**

Line 31:
```ts
// Before:
db.insert(analyticsEvents).values({...}).run();
// After:
await db.insert(analyticsEvents).values({...});
```

Line 69:
```ts
// Before:
.all();
// After:
;
```
And wrap the call:
```ts
// Before:
const rows = db.select(...).from(...).where(...).all();
// After:
const rows = await db.select(...).from(...).where(...);
```

- [ ] **Step 3: Convert `bookings.ts`**

Line 86, 89 — same pattern as `admin.ts:147-149`.

- [ ] **Step 4: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -50
```
Expected: errors only in test files (next task).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/admin.ts backend/src/routes/analytics.ts backend/src/routes/bookings.ts
git commit -m "refactor(routes): convert sync db calls to async for PG"
```

---

## Task 15: Convert test files to async db calls

**Files:** (9 test files)
- `backend/src/routes/admin.test.ts`
- `backend/src/routes/analytics.test.ts`
- `backend/src/routes/bookings.test.ts`
- `backend/src/routes/blogPosts.test.ts`
- `backend/src/routes/reviews.test.ts`
- `backend/src/routes/seoPages.test.ts`
- `backend/src/routes/sitemap.test.ts`
- `backend/src/services/maxBot.test.ts`
- `backend/src/services/notifications.test.ts`

For each test file:
1. Add `import { resetDb } from '../db/test-utils';`
2. Replace per-table `db.delete(...).run()` chains in `beforeEach` with `await resetDb(db);`
3. Apply the Convention pattern to all `.run()`/`.all()`/`.get()` calls (add `await`, destructure `.returning()`)

- [ ] **Step 1: Convert `admin.test.ts`**

Top of file:
```ts
// Add import
import { resetDb } from '../db/test-utils';

// Replace beforeEach (currently deletes from individual tables):
beforeEach(async () => {
  await resetDb(db);
});
```

Apply async pattern to all `db.insert(...).values(...).returning().get()`:
```ts
// Before:
const fixtureCottage = db.insert(cottages).values({...}).returning().get();
// After:
const fixtureCottage = (await db.insert(cottages).values({...}).returning())[0];
```

Or with destructuring:
```ts
const [fixtureCottage] = await db.insert(cottages).values({...}).returning();
```

- [ ] **Step 2: Convert `analytics.test.ts`**

Same pattern. Note: `beforeAll` already uses `.get()` which becomes `(await ...)[0]`.

- [ ] **Step 3: Convert `bookings.test.ts`**

Same pattern. Multiple `.run()` in beforeEach → `await resetDb(db)`.

- [ ] **Step 4: Convert `blogPosts.test.ts`**

Same pattern.

- [ ] **Step 5: Convert `reviews.test.ts`**

Same pattern.

- [ ] **Step 6: Convert `seoPages.test.ts`**

Same pattern.

- [ ] **Step 7: Convert `sitemap.test.ts`**

Same pattern.

- [ ] **Step 8: Convert `maxBot.test.ts`**

In `backend/src/services/maxBot.test.ts`. Same pattern.

- [ ] **Step 9: Convert `notifications.test.ts`**

In `backend/src/services/notifications.test.ts`. Same pattern.

- [ ] **Step 10: Verify all tests compile**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 11: Commit**

```bash
git add backend/src/routes/*.test.ts backend/src/services/*.test.ts
git commit -m "refactor(tests): convert sync db calls to async for PG"
```

---

## Task 16: Fix Date-related code in routes

**Files:**
- Modify: `backend/src/routes/admin.ts:236`
- Modify: `backend/src/routes/analytics.ts:82`
- Modify: `backend/src/routes/seoPages.ts:88`
- Modify: `backend/src/routes/blogPosts.ts:113`

- [ ] **Step 1: Fix `admin.ts:236`**

```ts
// Before:
const month = r.checkInDate.slice(0, 7);
// After:
const month = r.checkInDate.toISOString().slice(0, 7);
```

- [ ] **Step 2: Fix `analytics.ts:82`**

```ts
// Before:
const date = r.createdAt.slice(0, 10);
// After:
const date = r.createdAt.toISOString().slice(0, 10);
```

- [ ] **Step 3: Fix `seoPages.ts:88`**

```ts
// Before:
const patch: Partial<typeof seoPages.$inferInsert> = { ...data, updatedAt: new Date().toISOString() };
// After:
const patch: Partial<typeof seoPages.$inferInsert> = { ...data, updatedAt: new Date() };
```

- [ ] **Step 4: Fix `blogPosts.ts:113`**

```ts
// Before:
updatedAt: new Date().toISOString(),
// After:
updatedAt: new Date(),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/admin.ts backend/src/routes/analytics.ts backend/src/routes/seoPages.ts backend/src/routes/blogPosts.ts
git commit -m "fix(routes): use Date object instead of ISO string for date columns"
```

---

## Task 17: Cleanup test workarounds

**Files:**
- Modify: `backend/src/routes/blogPosts.test.ts:131, 158`

- [ ] **Step 1: Remove `as unknown as typeof payload.publishedAt` casts**

Lines 131 and 158 in `blogPosts.test.ts`:
```ts
// Before:
payload.publishedAt = new Date(payload.publishedAt).toISOString() as unknown as typeof payload.publishedAt;
// After:
payload.publishedAt = new Date(payload.publishedAt);
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/blogPosts.test.ts
git commit -m "test: remove Date-string workaround now that column is timestamp"
```

---

## Task 18: Remove old SQLite database files

**Files:**
- Delete: `backend/data/zvuki-lesa.db`, `backend/data/zvuki-lesa.db-wal`, `backend/data/zvuki-lesa.db-shm`, `backend/data/zvuki-lesa.test.db`, `backend/data/zvuki-lesa.test.db-wal`, `backend/data/zvuki-lesa.test.db-shm`

- [ ] **Step 1: Remove SQLite files**

```bash
cd backend && rm -f data/zvuki-lesa.db data/zvuki-lesa.db-wal data/zvuki-lesa.db-shm data/zvuki-lesa.test.db data/zvuki-lesa.test.db-wal data/zvuki-lesa.test.db-shm
```

- [ ] **Step 2: Commit**

```bash
git add -A backend/data/
git commit -m "chore: remove obsolete SQLite database files"
```

---

## Task 19: Run full type check and test suite

**Files:** none (validation)

- [ ] **Step 1: Run TypeScript check on backend**

```bash
cd backend && npx tsc --noEmit
```
Expected: exit code 0, no output.

If errors: fix and re-run. Most likely culprits:
- Tests still using `.run()`/`.all()`/`.get()` (look for TypeScript errors mentioning those methods)
- Routes passing ISO strings to `timestamp` columns (TS will catch type mismatch)

- [ ] **Step 2: Run TypeScript check on full repo**

```bash
cd /c/Users/VallfIK/Desktop/Project/Site_Brother/app && npx tsc -b
```
Expected: exit code 0.

- [ ] **Step 3: Run backend tests**

```bash
cd backend && npm run test
```
Expected: all tests pass.

If failures: most likely culprits are:
- `beforeEach` not yet converted to `async`
- Missing `await` on db call
- Type mismatch in test fixtures (e.g., passing string to `date` column where Date expected)

- [ ] **Step 4: Run full test suite**

```bash
cd /c/Users/VallfIK/Desktop/Project/Site_Brother/app && npm run test
```
Expected: all frontend + backend tests pass.

- [ ] **Step 5: If all green, commit any pending fixes**

```bash
git status
# If any uncommitted fixes:
git add -A
git commit -m "fix: post-migration type and test fixes"
```

---

## Task 20: Generate `zvuki-lesa-pg-dump.sql`

**Files:** none (artifact generation)

- [ ] **Step 1: Reset dev DB to clean state**

```bash
docker exec -it zvuki-pg psql -U postgres -d zvuki-lesa -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

- [ ] **Step 2: Apply migration**

```bash
cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa npx tsx --env-file=.env src/db/migrate.ts
```
Expected: `[migrate] done`.

- [ ] **Step 3: Run seed**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa npx tsx --env-file=.env src/db/seed.ts
```
Expected: `[seed] done`.

- [ ] **Step 4: Run seed:drafts**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa npx tsx --env-file=.env src/scripts/seedDrafts.ts
```
Expected: `[seed-drafts] Итог: +55 вставлено, ~0 пропущено, !0 ошибок` (40 SEO + 15 blog).

- [ ] **Step 5: pg_dump**

```bash
docker exec -it zvuki-pg pg_dump -U postgres --no-owner --clean --if-exists --inserts zvuki-lesa > /c/Users/VallfIK/Desktop/Project/Site_Brother/app/zvuki-lesa-pg-dump.sql
```
Expected: file written, size ~100-200KB.

- [ ] **Step 6: Verify dump structure**

```bash
head -30 zvuki-lesa-pg-dump.sql
```
Expected: starts with `--` comment lines, then `CREATE TYPE` for enums, `CREATE TABLE` for tables.

- [ ] **Step 7: Verify dump is valid by importing into a fresh DB**

```bash
docker exec -it zvuki-pg createdb -U postgres zvuki-lesa-verify
docker exec -i zvuki-pg psql -U postgres -d zvuki-lesa-verify < zvuki-lesa-pg-dump.sql
docker exec -it zvuki-pg psql -U postgres -d zvuki-lesa-verify -c "SELECT COUNT(*) FROM seo_pages;"
```
Expected: count = 40 (or however many SEO drafts).

- [ ] **Step 8: Cleanup verify DB**

```bash
docker exec -it zvuki-pg dropdb -U postgres zvuki-lesa-verify
```

- [ ] **Step 9: Commit dump to repo (or deliver separately)**

If the user wants the dump in the repo:
```bash
cp zvuki-lesa-pg-dump.sql backend/data/
git add backend/data/zvuki-lesa-pg-dump.sql
git commit -m "chore: initial PG dump for delivery to user's server"
```

If delivering as separate file: leave it at repo root for the user to grab.

---

## Task 21: Deliver to user and write usage instructions

**Files:**
- Create: `docs/PG_DUMP_USAGE.md`

- [ ] **Step 1: Write usage doc**

Create `docs/PG_DUMP_USAGE.md`:

```markdown
# Применение PG-дампа на сервере

## Требования

- PostgreSQL 13 или новее (рекомендую 16)
- Утилита `psql` (входит в стандартную установку Postgres)
- Права на создание БД (`CREATEDB`) или готовая БД, созданная администратором

## Шаги

1. Скопируйте `zvuki-lesa-pg-dump.sql` на сервер (например, в `/tmp/`).

2. Создайте БД:
   ```bash
   createdb zvuki-lesa
   ```
   Или через psql от суперпользователя:
   ```sql
   CREATE DATABASE zvuki-lesa;
   ```

3. Примените дамп:
   ```bash
   psql -d zvuki-lesa -f zvuki-lesa-pg-dump.sql
   ```

4. Проверьте:
   ```bash
   psql -d zvuki-lesa -c "\dt"
   ```
   Должно быть 16 таблиц.

   ```bash
   psql -d zvuki-lesa -c "SELECT name FROM cottages;"
   ```
   Должно вернуть 3 строки (Шале Уют, Лесная Резиденция, Горный Дом).

## Что внутри дампа

- Схема: 5 enum-типов + 16 таблиц + индексы
- Демо-данные: 3 домика, 5 услуг, 2 правила цен
- Черновики: 40 SEO-страниц (isPublished=false) + 15 blog-постов (isPublished=false)

Все тексты на русском, реальных броней и MAX-подписчиков нет (это dev-данные).

## Настройка backend'а

После применения дампа настройте `backend/.env`:
```
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/zvuki-lesa
```
Остальные переменные (`ADMIN_PASSWORD`, `MAX_BOT_TOKEN` и т.д.) — как раньше.

## Обновление дампа

Если схема поменяется:
1. Запустите `cd backend && npm run backend:migrate` локально (против локальной PG)
2. `npm run backend:seed` (опционально, если нужно пересоздать демо)
3. `pg_dump --no-owner --clean --if-exists --inserts zvuki-lesa > zvuki-lesa-pg-dump.sql`
```

- [ ] **Step 2: Commit**

```bash
git add docs/PG_DUMP_USAGE.md
git commit -m "docs: PG dump usage instructions for user's server"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Driver swap (Task 1)
- ✅ Schema rewrite to pg-core (Task 4)
- ✅ Migration generation (Task 7)
- ✅ Client/migrate/seed/seedDrafts rewrites (Tasks 8-11)
- ✅ Test infra (Tasks 12-13)
- ✅ Async transformation (Tasks 14-15)
- ✅ Date-type fixes (Task 16)
- ✅ Test cleanup (Task 17)
- ✅ Old SQLite cleanup (Task 18)
- ✅ Verification (Task 19)
- ✅ Dump generation (Task 20)
- ✅ User instructions (Task 21)

**Risk mitigations covered:**
- ✅ Async transformation explicitly addressed (Tasks 14-15, with Convention section)
- ✅ Test compilation verified after each phase (multiple `npx tsc --noEmit` steps)
- ✅ pg_dump verification step (Task 20 Step 7)
- ✅ Old SQLite files removed (Task 18)

**Known gotchas:**
- `dotenv` may need to be added if `import 'dotenv/config'` is used in drizzle.config.ts and dotenv isn't already a dep.
- `vitest.setup.ts` closes the postgres client after migrations; individual test files open their own via `client.ts`. Both use the same `DATABASE_URL`. Need to verify this doesn't cause "too many connections" issues — postgres-js default `max: 10` is fine for tests.
- `beforeEach` in each test file needs to import `resetDb` from `../db/test-utils`.
