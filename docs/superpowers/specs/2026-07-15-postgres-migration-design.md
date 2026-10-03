# Миграция бэкенда с SQLite на Postgres

**Дата:** 2026-07-15
**Статус:** Design approved, ready for plan
**Scope:** бэкенд (`backend/`), схема БД, миграции, сид, тесты, артефакт-дамп для сервера пользователя

## Цель

Перевести бэкенд «Звуки леса» с SQLite (better-sqlite3) на Postgres с нативными типами, и подготовить файл `zvuki-lesa-pg-dump.sql`, который пользователь применит на своём сервере командой `psql -f`.

**В скоупе:**
- Замена драйвера БД (better-sqlite3 → postgres-js).
- Переписывание `schema.ts` под `drizzle-orm/pg-core`.
- Регенерация миграций под PG-диалект.
- Обновление `client.ts`, `migrate.ts`, `seed.ts`, `seedDrafts.ts`, `vitest.setup.ts`, `drizzle.config.ts`, `.env.example`.
- Точечные правки в 5 местах роутов/сервисов (где тип дат меняется со `string` на `Date`) + косметика в 2 тест-файлах.
- Замена `better-sqlite3` на `postgres` в `package.json`.
- Генерация `zvuki-lesa-pg-dump.sql` (схема + демо-сид + черновики SEO/blog).

**Вне скоупа:**
- Миграция существующих SQLite-данных (в `data/zvuki-lesa.db` только демо из сида, реальных броней/MAX-подписчиков нет — пользователь подтвердил).
- Деплой самого Express-бэкенда на сервер пользователя (его пользователь сделает сам позже).
- Правки фронта (API-ответы PG-сериализуют `date`/`timestamp` в ISO-строки — фронт не заметит).

## Архитектура

### Драйвер БД

**Выбор:** `postgres` (postgres.js, npm-пакет). Причины:
- Активная поддержка, легковесный, рекомендован Drizzle для PG.
- Совместим с PG 13+.
- Поддержка пула соединений, prepared statements, LISTEN/NOTIFY (если понадобится).

**Подключение:** через `DATABASE_URL` (стандартный PG connection string). В dev — `postgres://postgres:postgres@localhost:5432/zvuki-lesa` по умолчанию.

### Файлы, переписываемые целиком

| Файл | Что меняется |
|---|---|
| `backend/src/db/client.ts` | `Database from 'better-sqlite3'` → `postgres from 'postgres'`; `drizzle-orm/better-sqlite3` → `drizzle-orm/postgres-js`; убираем `journal_mode = WAL` и `foreign_keys = ON` (в PG не нужны). |
| `backend/src/db/migrate.ts` | импорт из `drizzle-orm/postgres-js/migrator`. |
| `backend/src/db/seed.ts` | `sqlite.exec('DELETE FROM ...')` → `db.execute(sql\`TRUNCATE ... RESTART IDENTITY CASCADE\`)`. |
| `backend/src/scripts/seedDrafts.ts` | `e?.code === 'SQLITE_CONSTRAINT_UNIQUE'` → `'23505'`. |
| `backend/vitest.setup.ts` | better-sqlite3 → postgres; миграции через `migrate()` из drizzle-orm/postgres-js/migrator. |
| `backend/drizzle.config.ts` | `dialect: 'sqlite'` → `'postgresql'`; `dbCredentials: { url }` вместо `{ url: './data/...' }`. |
| `backend/.env.example` | Добавить `DATABASE_URL=postgres://...` |
| `backend/src/db/schema.ts` | Все 16 таблиц: `sqliteTable` → `pgTable`, маппинг типов (см. ниже). |

### Файлы без изменений

Все 12 файлов в `backend/src/routes/*` (кроме 4 точечных правок: `admin.ts`, `analytics.ts`, `seoPages.ts`, `blogPosts.ts`) и `backend/src/services/*` — Drizzle-запросы работают на любом драйвере прозрачно, API-ответы идентичны (PG сериализует `date`/`timestamp` в ISO-строки в JSON).

Также: `backend/.env.example` дополняется строкой `DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa`.

### Зависимости

**Удалить из `backend/package.json`:**
- `better-sqlite3` (^11.5.0)
- `@types/better-sqlite3` (^7.6.12)

**Добавить:**
- `postgres` (последняя стабильная)

### Миграции

Существующие 8 файлов `0000_white_klaw.sql` … `0007_cottage_sections_and_description.sql` (SQLite-диалект) **удаляются**. Генерируется один чистый `0000_initial.sql` под PG. Дальнейшие изменения схемы — через `drizzle-kit generate` (новые файлы нумеруются по порядку).

## Маппинг схемы

### Типы колонок

| SQLite (текущее) | Postgres (целевое) |
|---|---|
| `integer('id').primaryKey({ autoIncrement: true })` | `serial('id').primaryKey()` |
| `text('slug').notNull().unique()` | `text('slug').notNull().unique()` (без изменений) |
| `text('created_at').$defaultFn(() => new Date().toISOString())` | `timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()` |
| `text('start_date').notNull()` (date-only) | `date('start_date').notNull()` |
| `text('joined_at').notNull()` (timestamp) | `timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull()` |
| `text(..., { enum: [...] })` | `pgEnum('name', [...]).notNull()` |
| `integer(..., { mode: 'boolean' })` | `boolean(...).notNull().default(true)` |
| `real('priority')` | `doublePrecision('priority')` |
| `text('payload')` (JSON-as-text) | `jsonb('payload')` |
| `integer(...)` (числа) | `integer(...)` (то же) |

**Что НЕ переезжает как есть:**
- `schemaJson` (в `seo_pages`, `blog_posts`) — остаётся `text`. Хранится строкой для совместимости с инжектом в `<script type="application/ld+json">`.

### PG-Enum'ы (5 штук)

```ts
export const cottageImageSectionEnum = pgEnum('cottage_image_section', ['main','interior','kitchen','bathroom','amenities']);
export const priceRuleModifierEnum  = pgEnum('price_rule_modifier',   ['percent','fixed']);
export const bookingStatusEnum      = pgEnum('booking_status',        ['new','confirmed','cancelled']);
export const bookingSourceEnum      = pgEnum('booking_source',        ['site','manual']);
export const reviewSourceEnum       = pgEnum('review_source',         ['2gis','yandex','google','manual']);
```

### Что меняется в типах возврата (точечные правки)

| Поле | Было | Стало | Где это всплывёт |
|---|---|---|---|
| `createdAt`, `updatedAt`, `publishedAt`, `date` (отзывы), `joinedAt`, `lastNotifiedAt`, `sentAt` | `string` (ISO) | `Date` | Места, где `.slice()` на поле из БД |
| `startDate`, `endDate`, `checkInDate`, `checkOutDate` | `string` (ISO date) | `Date` | То же |
| `isActive`, `isPublished` | `boolean` (Drizzle мапил из 0/1) | `boolean` (нативно) | Без изменений |
| `priority` | `number` | `number` | Без изменений |
| `payload` (notifications) | `string` (JSON) | объект | Без изменений (нигде не парсится руками) |

## Async-трансформация: `.run()` / `.all()` / `.get()` → `await`

PG-driver асинхронный (postgres-js работает поверх TCP). better-sqlite3 — синхронный. Это значит:

| Текущий паттерн (sync, SQLite) | PG-эквивалент (async) |
|---|---|
| `db.delete(table).run()` | `await db.delete(table)` |
| `db.insert(t).values(...).run()` | `await db.insert(t).values(...)` |
| `db.insert(t).values(...).returning().get()` | `const [row] = await db.insert(t).values(...).returning()` |
| `db.select().from(t).all()` | `(await db.select().from(t))` |
| `db.select().from(t).where(...).get()` | `(await db.select().from(t).where(...))[0]` |

**Объём правки (грепом по `backend/src`):** ~50 мест в 12 route-файлах + 9 test-файлах + `seed.ts`. Большинство route-обработчиков уже `async` (для express-async-errors и zod-валидации), так что добавляется только `await` перед db-вызовами.

В test-файлах `beforeEach` тоже становится `async`.

## Точечные правки в роутах (5 мест)

### 1. `backend/src/routes/admin.ts:236`
```ts
// было
const month = r.checkInDate.slice(0, 7);
// станет
const month = r.checkInDate.toISOString().slice(0, 7);
```

### 2. `backend/src/routes/analytics.ts:82`
```ts
// было
const date = r.createdAt.slice(0, 10);
// станет
const date = r.createdAt.toISOString().slice(0, 10);
```

### 3. `backend/src/routes/seoPages.ts:88`
```ts
// было
const patch: Partial<typeof seoPages.$inferInsert> = { ...data, updatedAt: new Date().toISOString() };
// станет
const patch: Partial<typeof seoPages.$inferInsert> = { ...data, updatedAt: new Date() };
```

### 4. `backend/src/routes/blogPosts.ts:113`
```ts
// было
updatedAt: new Date().toISOString(),
// станет
updatedAt: new Date(),
```

### 5. `backend/src/scripts/seedDrafts.ts:56, 105`
```ts
// было
if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
// станет
if (e?.code === '23505') { // PG unique_violation
```

### Тесты — косметика

- `backend/src/routes/analytics.test.ts:91-97` — `createdAt: today` (где `today` — строка) продолжит работать: PG `timestamp` принимает и `Date`, и ISO-строку.
- `backend/src/routes/blogPosts.test.ts:131, 158` — `payload.publishedAt = new Date(payload.publishedAt).toISOString() as unknown as typeof payload.publishedAt` — убрать `as unknown as ...` cast, после смены типа станет нативно.

## Тесты

### `backend/vitest.setup.ts` (новая реализация)

```ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from './db/schema';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/zvuki-lesa-test';
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

await migrate(db, { migrationsFolder: './drizzle' });
console.log('[vitest.setup] pg test db ready');
```

### Сброс БД между тестами

Создаётся утилита `resetDb(db)` в `backend/src/db/test-utils.ts`:
```ts
export async function resetDb(db) {
  await db.execute(sql`TRUNCATE TABLE
    booking_services, bookings, notifications, price_rules, services,
    recreation_items, cottage_amenities, amenities, cottage_images, cottages,
    seo_pages, blog_posts, images_registry, reviews, max_subscribers, analytics_events
    RESTART IDENTITY CASCADE`);
}
```

Каждый `.test.ts` файл использует `beforeEach(resetDb)` (или один общий setup).

### Зависимости для разработчика

**Локальная PG для тестов** через Docker:
```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name zvuki-pg-test postgres:16-alpine
```
В `backend/.env` (или shell):
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa-test
```

## Обработка ошибок

- PG-ошибки через Drizzle: `e.code` (строка `'23505'` — unique violation, `'23503'` — FK violation, и т.д.). Текущий код уже использует этот паттерн в `seedDrafts.ts` — нужно только обновить коды.
- Все остальные catch-блоки (`else { console.error(...) }`) уже ловят общие ошибки — без изменений.
- MAX-бот: ловит `chat.not.found` из тела ответа MAX API (не зависит от БД-драйвера) — без изменений.

## Деструктивная операция в `seed.ts`

**Было:**
```ts
sqlite.exec(`
  DELETE FROM booking_services;
  DELETE FROM bookings;
  DELETE FROM notifications;
  DELETE FROM price_rules;
  DELETE FROM services;
  DELETE FROM recreation_items;
  DELETE FROM cottage_amenities;
  DELETE FROM amenities;
  DELETE FROM cottage_images;
  DELETE FROM cottages;
`);
```

**Станет:**
```ts
import { sql } from 'drizzle-orm';
await db.execute(sql`TRUNCATE TABLE
  booking_services, bookings, notifications, price_rules, services,
  recreation_items, cottage_amenities, amenities, cottage_images, cottages,
  seo_pages, blog_posts, images_registry, reviews, max_subscribers, analytics_events
  RESTART IDENTITY CASCADE`);
```

`RESTART IDENTITY` сбрасывает sequences (id снова с 1). `CASCADE` обрезает FK-связи.

## Pipeline артефакта `zvuki-lesa-pg-dump.sql`

1. Локально поднимаю `postgres:16` (Docker или установленный):
   ```bash
   docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name zvuki-pg-demo postgres:16-alpine
   ```
2. Создаю БД:
   ```bash
   createdb -h localhost -U postgres zvuki-lesa-pg-demo
   ```
3. Применяю миграции:
   ```bash
   cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa-pg-demo npm run migrate
   ```
4. Наполняю демо-данными:
   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa-pg-demo npm run seed
   ```
5. Заливаю черновики SEO/blog:
   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/zvuki-lesa-pg-demo npm run seed:drafts
   ```
6. Дамп:
   ```bash
   pg_dump --no-owner --clean --if-exists --inserts -h localhost -U postgres zvuki-lesa-pg-demo > zvuki-lesa-pg-dump.sql
   ```
7. Отдаю `zvuki-lesa-pg-dump.sql` пользователю.
8. Пользователь на сервере:
   ```bash
   createdb zvuki-lesa
   psql -d zvuki-lesa -f zvuki-lesa-pg-dump.sql
   ```

**Размер дампа:** ожидаемо < 200KB (3 домика × 5-6 фото + 5 услуг + 2 правила + 40 SEO + 15 blog черновиков + индексы).

## Риски

| Риск | Митигация |
|---|---|
| API-ответы меняют формат дат | PG сериализует `date`/`timestamp` в ISO-строки в JSON по умолчанию — фронт не заметит. Тесты на роутах проверят. |
| Тесты ломаются из-за смены типов | `tsc -b` покажет все несовместимости сразу; косметические правки в 2 тест-файлах. |
| `node-pg` не запускается на Windows | Используем чистый `postgres` (postgres.js) — без native bindings, проблем не будет. |
| Пользователь применяет дамп на несовместимой версии PG | Минимальное требование — PG 13+ (у `postgres.js` и `pgEnum` нет ограничений). Указываю в инструкции. |
| Длинные дампы при большом объёме данных | Сейчас объём маленький (только демо + черновики). Если в будущем будут большие объёмы — пересмотр pipeline. |
| Async-трансформация пропущена в каком-то месте | Прогон `tsc -b` + `vitest run` после каждой задачи. Все ~50 мест видны через grep `\.(run\|all\|get)\(\)`. |

## Что НЕ входит в скоуп

- Миграция production-данных с SQLite (их нет).
- Деплой Express-бэка на сервер пользователя.
- Правки фронта.
- Оптимизация под высокие нагрузки (это уже отдельная задача после деплоя).
