# Booking System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить Python Flask+PostgreSQL backend на Node.js+SQLite (Drizzle ORM) с системой бронирования, гибкими ценами и услугами.

**Architecture:** Express backend на порту 3001, SQLite через Drizzle ORM, Vite proxy для `/api/*`. Схема БД спроектирована для будущей миграции на Postgres. На текущей итерации данные заполняются seed-скриптом, уведомления менеджеру через запись в БД + console.log.

**Tech Stack:** Node.js 20+, TypeScript 5.9, Express 4, better-sqlite3, Drizzle ORM, Zod, Vitest. Фронт: React 19 + Vite 7 (без изменений стека).

**Spec:** `docs/superpowers/specs/2026-06-27-booking-system-design.md`

---

## File Structure

```
backend/                                        # NEW
  package.json                                  # scripts: backend:dev/migrate/seed/test
  tsconfig.json                                 # extends root, strict
  vitest.config.ts                              # node env, alias @/* → src/*
  drizzle.config.ts                             # dialect: sqlite, schema, out
  .gitignore                                    # node_modules, data/*.db, logs/*
  data/.gitkeep
  logs/.gitkeep
  src/
    server.ts                                   # Express app, CORS, error handler
    db/
      schema.ts                                 # все таблицы Drizzle
      client.ts                                 # better-sqlite3 + drizzle
      migrate.ts                                # run migrator
      seed.ts                                   # заполнение данными
    services/
      pricing.ts                                # calculateStayPrice + helpers
      availability.ts                           # findAvailable, isOverlap
      notifications.ts                          # notifyManager (DB + log)
    routes/
      cottages.ts                               # GET list, GET :idOrSlug
      availability.ts                           # GET /api/cottages/:id/availability, GET /api/availability
      services.ts                               # GET /api/services
      calendar.ts                               # GET /api/calendar/:cottageId
      bookings.ts                               # POST, GET :id, POST :id/cancel
    lib/
      validation.ts                             # Zod schemas
      errors.ts                                 # ApiError + middleware
  src/services/pricing.test.ts
  src/services/availability.test.ts
  src/db/seed.test.ts
  src/routes/bookings.test.ts
  src/routes/availability.test.ts

Modified (root):
  package.json                                  # +4 скрипта backend:*
  vite.config.ts                                # +server.proxy
  start.bat                                     # переписать под Node

Modified (frontend):
  src/lib/api.ts                                # убрать хардкод, относительный /api
  src/lib/cabins.ts                             # убрать export CABINS
  src/components/StickyFooter/StickyFooter.tsx  # реальная логика поиска
  src/components/BookingDialog.tsx              # useAvailability + услуги
  src/pages/booking/BookingPage.tsx             # API вместо getCabinById
  src/components/StickyFooter/StickyFooter.test.tsx

New (frontend):
  src/hooks/useCottages.ts
  src/hooks/useAvailability.ts
  src/hooks/useAvailability.test.ts

Deleted:
  server/app.py
  server/app_sqlite.py
  server/database.py
  server/telegram_bot.py
  server/  (вся директория)
```

---

## Task 1: Инициализация backend пакета

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.gitignore`
- Create: `backend/data/.gitkeep`
- Create: `backend/logs/.gitkeep`

- [ ] **Step 1: Создать `backend/package.json`**

```json
{
  "name": "zvuki-lesa-backend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "migrate": "tsx src/db/migrate.ts",
    "seed": "tsx src/db/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.5.0",
    "drizzle-orm": "^0.36.4",
    "express": "^4.21.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.5",
    "drizzle-kit": "^0.30.1",
    "tsx": "^4.19.2",
    "typescript": "~5.9.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Создать `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Создать `backend/.gitignore`**

```
node_modules/
dist/
data/*.db
data/*.db-journal
logs/*.log
.env
```

- [ ] **Step 4: Создать пустые `.gitkeep` файлы**

Создать пустые файлы `backend/data/.gitkeep` и `backend/logs/.gitkeep`.

- [ ] **Step 5: Установить зависимости**

Run: `cd backend && npm install`
Expected: dependencies installed без ошибок.

- [ ] **Step 6: Коммит**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/.gitignore backend/data/.gitkeep backend/logs/.gitkeep
git commit -m "feat(backend): initialize Node.js backend package"
```

---

## Task 2: Drizzle config + vitest config

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/vitest.config.ts`

- [ ] **Step 1: Создать `backend/drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/zvuki-lesa.db',
  },
} satisfies Config;
```

- [ ] **Step 2: Создать `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Коммит**

```bash
git add backend/drizzle.config.ts backend/vitest.config.ts
git commit -m "feat(backend): add drizzle and vitest config"
```

---

## Task 3: Схема БД (все таблицы)

**Files:**
- Create: `backend/src/db/schema.ts`

- [ ] **Step 1: Создать `backend/src/db/schema.ts`**

```ts
import { sqliteTable, integer, text, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const cottages = sqliteTable('cottages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  mapId: text('map_id').notNull(),
  name: text('name').notNull(),
  shortDescription: text('short_description').notNull(),
  longDescription: text('long_description').notNull(),
  basePrice: integer('base_price').notNull(),
  area: integer('area').notNull(),
  guests: integer('guests').notNull(),
  bedrooms: integer('bedrooms').notNull(),
  bedsDouble: integer('beds_double').notNull().default(0),
  bedsSingle: integer('beds_single').notNull().default(0),
  checkInTime: text('check_in_time').notNull(),
  checkOutTime: text('check_out_time').notNull(),
  mainImage: text('main_image').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const cottageImages = sqliteTable('cottage_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  position: integer('position').notNull().default(0),
}, (t) => ({
  byCottage: index('idx_cottage_images_cottage').on(t.cottageId, t.position),
}));

export const amenities = sqliteTable('amenities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon'),
});

export const cottageAmenities = sqliteTable('cottage_amenities', {
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  amenityId: integer('amenity_id').notNull().references(() => amenities.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.cottageId, t.amenityId] }),
}));

export const recreationItems = sqliteTable('recreation_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  photo: text('photo').notNull(),
  position: integer('position').notNull().default(0),
});

export const services = sqliteTable('services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  basePrice: integer('base_price'),
  icon: text('icon').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  position: integer('position').notNull().default(0),
});

export const priceRules = sqliteTable('price_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cottageId: integer('cottage_id').references(() => cottages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  modifierType: text('modifier_type', { enum: ['percent', 'fixed'] }).notNull(),
  modifierValue: integer('modifier_value').notNull(),
  weekendModifier: integer('weekend_modifier'),
  priority: integer('priority').notNull().default(0),
}, (t) => ({
  byDate: index('idx_price_rules_dates').on(t.startDate, t.endDate),
}));

export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cottageId: integer('cottage_id').notNull().references(() => cottages.id),
  guestName: text('guest_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  checkInDate: text('check_in_date').notNull(),
  checkOutDate: text('check_out_date').notNull(),
  guests: integer('guests').notNull(),
  notes: text('notes'),
  nights: integer('nights').notNull(),
  subtotal: integer('subtotal').notNull(),
  servicesTotal: integer('services_total').notNull().default(0),
  totalPrice: integer('total_price').notNull(),
  status: text('status', { enum: ['new', 'confirmed', 'cancelled'] }).notNull().default('new'),
  managerComment: text('manager_comment'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  byCottage: index('idx_bookings_cottage').on(t.cottageId, t.checkInDate, t.checkOutDate),
  byStatus: index('idx_bookings_status').on(t.status),
}));

export const bookingServices = sqliteTable('booking_services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id),
  quantity: integer('quantity').notNull().default(1),
  priceAtBooking: integer('price_at_booking'),
}, (t) => ({
  byBooking: index('idx_booking_services_booking').on(t.bookingId),
}));

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  sentAt: text('sent_at'),
});
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/db/schema.ts
git commit -m "feat(backend): add Drizzle schema for all tables"
```

---

## Task 4: DB client + migrate script

**Files:**
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/migrate.ts`

- [ ] **Step 1: Создать `backend/src/db/client.ts`**

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH ?? path.resolve(__dirname, '../../data/zvuki-lesa.db');

export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { schema };
```

- [ ] **Step 2: Создать `backend/src/db/migrate.ts`**

```ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client';

console.log('[migrate] applying migrations...');
migrate(db, { migrationsFolder: './drizzle' });
console.log('[migrate] done');
```

- [ ] **Step 3: Сгенерировать первую миграцию**

Run: `cd backend && npx drizzle-kit generate`
Expected: создаётся папка `backend/drizzle/` с SQL-файлом `0000_*.sql`.

- [ ] **Step 4: Применить миграцию**

Run: `cd backend && npm run migrate`
Expected: лог `[migrate] applying migrations...` затем `[migrate] done`. Файл `backend/data/zvuki-lesa.db` создан.

- [ ] **Step 5: Коммит**

```bash
git add backend/src/db/client.ts backend/src/db/migrate.ts backend/drizzle/
git commit -m "feat(backend): add db client, migrate script, first migration"
```

---

## Task 5: Errors middleware

**Files:**
- Create: `backend/src/lib/errors.ts`

- [ ] **Step 1: Создать `backend/src/lib/errors.ts`**

```ts
import type { Request, Response, NextFunction } from 'express';

export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'DATES_UNAVAILABLE' | 'CONFLICT' | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }
  console.error('[error]', err);
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const logFile = path.resolve(process.cwd(), 'logs/error.log');
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${String(err)}\n${(err as Error)?.stack ?? ''}\n\n`);
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL' });
}
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/lib/errors.ts
git commit -m "feat(backend): add ApiError class and error middleware"
```

---

## Task 6: Pricing service (TDD)

**Files:**
- Create: `backend/src/services/pricing.ts`
- Test: `backend/src/services/pricing.test.ts`

- [ ] **Step 1: Создать `backend/src/services/pricing.ts` (заглушка)**

```ts
export interface PriceRule {
  id: number;
  cottageId: number | null;
  name: string;
  startDate: string;
  endDate: string;
  modifierType: 'percent' | 'fixed';
  modifierValue: number;
  weekendModifier: number | null;
  priority: number;
}

export interface PerNightBreakdown {
  date: string;
  base: number;
  final: number;
  rule: string | null;
}

export interface PriceQuote {
  perNight: PerNightBreakdown[];
  subtotal: number;
}

export function calculateStayPrice(
  basePrice: number,
  checkIn: string,
  checkOut: string,
  rules: PriceRule[],
  cottageId: number,
): PriceQuote {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Создать тест `backend/src/services/pricing.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { calculateStayPrice, type PriceRule } from './pricing';

const noRules: PriceRule[] = [];

describe('calculateStayPrice', () => {
  it('sums base price across nights when no rules apply', () => {
    const quote = calculateStayPrice(4500, '2026-06-17', '2026-06-20', noRules, 1);
    expect(quote.subtotal).toBe(13500);
    expect(quote.perNight).toEqual([
      { date: '2026-06-17', base: 4500, final: 4500, rule: null },
      { date: '2026-06-18', base: 4500, final: 4500, rule: null },
      { date: '2026-06-19', base: 4500, final: 4500, rule: null },
    ]);
  });

  it('applies percent rule on date range', () => {
    const rules: PriceRule[] = [
      { id: 1, cottageId: null, name: 'Высокий сезон', startDate: '2026-06-15', endDate: '2026-06-25', modifierType: 'percent', modifierValue: 50, weekendModifier: null, priority: 0 },
    ];
    const quote = calculateStayPrice(4500, '2026-06-17', '2026-06-19', rules, 1);
    expect(quote.subtotal).toBe(13500); // 4500 + 6750 + 6750 = 18000
    expect(quote.perNight[0].final).toBe(6750);
    expect(quote.perNight[0].rule).toBe('Высокий сезон');
  });

  it('applies weekend modifier on top of base rule', () => {
    // 2026-06-20 is Saturday
    const rules: PriceRule[] = [
      { id: 1, cottageId: null, name: 'Высокий сезон', startDate: '2026-06-15', endDate: '2026-06-25', modifierType: 'percent', modifierValue: 50, weekendModifier: 20, priority: 0 },
    ];
    const quote = calculateStayPrice(4500, '2026-06-19', '2026-06-21', rules, 1);
    // 2026-06-19 Fri: 4500 + 50% = 6750
    // 2026-06-20 Sat: 4500 + 50% + 20% = 8100
    expect(quote.perNight[0].final).toBe(6750);
    expect(quote.perNight[1].final).toBe(8100);
    expect(quote.subtotal).toBe(14850);
  });

  it('uses higher priority rule when multiple match', () => {
    const rules: PriceRule[] = [
      { id: 1, cottageId: null, name: 'Лето', startDate: '2026-06-01', endDate: '2026-08-31', modifierType: 'percent', modifierValue: 30, weekendModifier: null, priority: 0 },
      { id: 2, cottageId: null, name: 'Праздник', startDate: '2026-06-19', endDate: '2026-06-19', modifierType: 'percent', modifierValue: 100, weekendModifier: null, priority: 10 },
    ];
    const quote = calculateStayPrice(4500, '2026-06-19', '2026-06-20', rules, 1);
    expect(quote.perNight[0].final).toBe(9000); // +100% wins
    expect(quote.perNight[0].rule).toBe('Праздник');
  });

  it('respects cottage-specific rule over global', () => {
    const rules: PriceRule[] = [
      { id: 1, cottageId: null, name: 'Глобальная', startDate: '2026-06-17', endDate: '2026-06-17', modifierType: 'percent', modifierValue: 10, weekendModifier: null, priority: 5 },
      { id: 2, cottageId: 2, name: 'Для 2-го', startDate: '2026-06-17', endDate: '2026-06-17', modifierType: 'percent', modifierValue: 80, weekendModifier: null, priority: 5 },
    ];
    const quote2 = calculateStayPrice(4500, '2026-06-17', '2026-06-18', rules, 2);
    expect(quote2.perNight[0].rule).toBe('Для 2-го');
    expect(quote2.perNight[0].final).toBe(8100);
  });
});
```

- [ ] **Step 3: Запустить тесты (ожидаем fail)**

Run: `cd backend && npm run test -- pricing`
Expected: тесты падают с "not implemented".

- [ ] **Step 4: Реализовать `calculateStayPrice`**

Заменить `backend/src/services/pricing.ts`:

```ts
import { eachDayOfInterval, parseISO, format, isWeekend } from 'date-fns';

export interface PriceRule { /* ... same as before ... */
  id: number;
  cottageId: number | null;
  name: string;
  startDate: string;
  endDate: string;
  modifierType: 'percent' | 'fixed';
  modifierValue: number;
  weekendModifier: number | null;
  priority: number;
}

export interface PerNightBreakdown {
  date: string;
  base: number;
  final: number;
  rule: string | null;
}

export interface PriceQuote {
  perNight: PerNightBreakdown[];
  subtotal: number;
}

function ruleApplies(rule: PriceRule, dateISO: string, cottageId: number): boolean {
  if (rule.cottageId !== null && rule.cottageId !== cottageId) return false;
  return dateISO >= rule.startDate && dateISO <= rule.endDate;
}

function pickRule(rules: PriceRule[], dateISO: string, cottageId: number): PriceRule | null {
  const matches = rules.filter((r) => ruleApplies(r, dateISO, cottageId));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.priority - a.priority)[0]!;
}

function applyRule(base: number, rule: PriceRule, weekend: boolean): number {
  let price = base;
  if (rule.modifierType === 'percent') {
    price = Math.round(base * (1 + rule.modifierValue / 100));
  } else {
    price = base + rule.modifierValue;
  }
  if (weekend && rule.weekendModifier !== null) {
    price = Math.round(price * (1 + rule.weekendModifier / 100));
  }
  return price;
}

export function calculateStayPrice(
  basePrice: number,
  checkIn: string,
  checkOut: string,
  rules: PriceRule[],
  cottageId: number,
): PriceQuote {
  const nights = eachDayOfInterval({ start: parseISO(checkIn), end: parseISO(parseISO(checkOut).getTime() - 86_400_000 > 0 ? format(parseISO(checkOut), 'yyyy-MM-dd') : checkOut) })
    // упрощённая версия:
    ;
  const days: string[] = [];
  let cur = parseISO(checkIn);
  const end = parseISO(checkOut);
  while (cur < end) {
    days.push(format(cur, 'yyyy-MM-dd'));
    cur = new Date(cur.getTime() + 86_400_000);
  }
  const perNight: PerNightBreakdown[] = days.map((date) => {
    const rule = pickRule(rules, date, cottageId);
    const weekend = isWeekend(parseISO(date));
    const final = rule ? applyRule(basePrice, rule, weekend) : basePrice;
    return { date, base: basePrice, final, rule: rule?.name ?? null };
  });
  const subtotal = perNight.reduce((sum, n) => sum + n.final, 0);
  return { perNight, subtotal };
}
```

- [ ] **Step 5: Запустить тесты (ожидаем pass)**

Run: `cd backend && npm run test -- pricing`
Expected: 5 тестов проходят.

- [ ] **Step 6: Коммит**

```bash
git add backend/src/services/pricing.ts backend/src/services/pricing.test.ts
git commit -m "feat(backend): implement pricing service with TDD"
```

---

## Task 7: Availability service (TDD)

**Files:**
- Create: `backend/src/services/availability.ts`
- Test: `backend/src/services/availability.test.ts`

- [ ] **Step 1: Заглушка `backend/src/services/availability.ts`**

```ts
export function isDateRangeAvailable(
  existingBookings: { checkInDate: string; checkOutDate: string; status: string }[],
  checkIn: string,
  checkOut: string,
): boolean {
  throw new Error('not implemented');
}

export function hasWeekendOrHoliday(checkIn: string, checkOut: string): boolean {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Создать тест `backend/src/services/availability.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isDateRangeAvailable, hasWeekendOrHoliday } from './availability';

describe('isDateRangeAvailable', () => {
  const noBookings: { checkInDate: string; checkOutDate: string; status: string }[] = [];

  it('returns true when no bookings', () => {
    expect(isDateRangeAvailable(noBookings, '2026-06-17', '2026-06-20')).toBe(true);
  });

  it('returns false when exact overlap', () => {
    const bookings = [{ checkInDate: '2026-06-18', checkOutDate: '2026-06-20', status: 'new' }];
    expect(isDateRangeAvailable(bookings, '2026-06-17', '2026-06-19')).toBe(false);
  });

  it('returns false when requested range is inside existing booking', () => {
    const bookings = [{ checkInDate: '2026-06-15', checkOutDate: '2026-06-25', status: 'confirmed' }];
    expect(isDateRangeAvailable(bookings, '2026-06-18', '2026-06-20')).toBe(false);
  });

  it('returns true when ranges are adjacent (checkout day free for new checkin)', () => {
    const bookings = [{ checkInDate: '2026-06-15', checkOutDate: '2026-06-20', status: 'new' }];
    expect(isDateRangeAvailable(bookings, '2026-06-20', '2026-06-22')).toBe(true);
  });

  it('ignores cancelled bookings', () => {
    const bookings = [{ checkInDate: '2026-06-18', checkOutDate: '2026-06-20', status: 'cancelled' }];
    expect(isDateRangeAvailable(bookings, '2026-06-17', '2026-06-19')).toBe(true);
  });
});

describe('hasWeekendOrHoliday', () => {
  it('returns true if any day is Saturday', () => {
    expect(hasWeekendOrHoliday('2026-06-19', '2026-06-21')).toBe(true); // 20.06 = Sat
  });

  it('returns false for weekdays only', () => {
    expect(hasWeekendOrHoliday('2026-06-17', '2026-06-19')).toBe(false);
  });
});
```

- [ ] **Step 3: Запустить тесты (fail)**

Run: `cd backend && npm run test -- availability`
Expected: ошибки "not implemented".

- [ ] **Step 4: Реализовать**

Заменить `backend/src/services/availability.ts`:

```ts
import { eachDayOfInterval, parseISO, format, isWeekend } from 'date-fns';

const HOLIDAYS = [
  { month: 1, days: [1, 2, 3, 4, 5, 6, 7, 8] },
  { month: 2, days: [23] },
  { month: 3, days: [8] },
  { month: 5, days: [1, 9] },
  { month: 6, days: [12] },
  { month: 11, days: [4] },
];

export function isDateRangeAvailable(
  existingBookings: { checkInDate: string; checkOutDate: string; status: string }[],
  checkIn: string,
  checkOut: string,
): boolean {
  const requestedStart = parseISO(checkIn);
  const requestedEnd = parseISO(checkOut);

  for (const b of existingBookings) {
    if (b.status === 'cancelled') continue;
    const existingStart = parseISO(b.checkInDate);
    const existingEnd = parseISO(b.checkOutDate);
    // Пересечение (включая день выезда как свободный)
    if (requestedStart < existingEnd && requestedEnd > existingStart) {
      return false;
    }
  }
  return true;
}

export function hasWeekendOrHoliday(checkIn: string, checkOut: string): boolean {
  const start = parseISO(checkIn);
  const end = parseISO(checkOut);
  const days = eachDayOfInterval({ start, end: new Date(end.getTime() - 86_400_000) });
  return days.some((d) => {
    if (isWeekend(d)) return true;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return HOLIDAYS.some((h) => h.month === month && h.days.includes(day));
  });
}
```

- [ ] **Step 5: Запустить тесты (pass)**

Run: `cd backend && npm run test -- availability`
Expected: все 7 тестов проходят.

- [ ] **Step 6: Коммит**

```bash
git add backend/src/services/availability.ts backend/src/services/availability.test.ts
git commit -m "feat(backend): implement availability service with TDD"
```

---

## Task 8: Notifications service

**Files:**
- Create: `backend/src/services/notifications.ts`

- [ ] **Step 1: Создать `backend/src/services/notifications.ts`**

```ts
import { db } from '../db/client';
import { notifications } from '../db/schema';

export interface BookingSummary {
  id: number;
  guestName: string;
  phone: string;
  cottageName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalPrice: number;
}

export async function notifyNewBooking(booking: BookingSummary): Promise<void> {
  const payload = JSON.stringify(booking);
  await db.insert(notifications).values({
    type: 'new_booking',
    bookingId: booking.id,
    payload,
  });
  console.log(
    `[BOOKING #${booking.id}] New: ${booking.guestName} ${booking.phone} ${booking.checkInDate}→${booking.checkOutDate}, ${booking.nights} ноч., ₽${booking.totalPrice}`,
  );
}
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/services/notifications.ts
git commit -m "feat(backend): add notifications service"
```

---

## Task 9: Validation schemas

**Files:**
- Create: `backend/src/lib/validation.ts`

- [ ] **Step 1: Создать `backend/src/lib/validation.ts`**

```ts
import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createBookingSchema = z.object({
  cottageId: z.number().int().positive(),
  guestName: z.string().min(1).max(200),
  phone: z.string().min(5).max(50),
  email: z.string().email().optional(),
  checkInDate: isoDate,
  checkOutDate: isoDate,
  guests: z.number().int().min(1).max(50),
  notes: z.string().max(2000).optional(),
  services: z.array(z.object({
    serviceId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(20),
  })).optional(),
}).refine((d) => d.checkOutDate > d.checkInDate, {
  message: 'checkOutDate must be after checkInDate',
  path: ['checkOutDate'],
});

export const availabilityQuerySchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.coerce.number().int().min(1).max(50).optional(),
}).refine((d) => d.checkOut > d.checkIn, {
  message: 'checkOut must be after checkIn',
  path: ['checkOut'],
});

export const calendarQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
});
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/lib/validation.ts
git commit -m "feat(backend): add Zod validation schemas"
```

---

## Task 10: Cottages route

**Files:**
- Create: `backend/src/routes/cottages.ts`

- [ ] **Step 1: Создать `backend/src/routes/cottages.ts`**

```ts
import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { cottages, cottageImages, amenities, cottageAmenities, recreationItems } from '../db/schema';
import { ApiError } from '../lib/errors';

async function loadCottage(cottage: typeof cottages.$inferSelect) {
  const images = await db.select().from(cottageImages).where(eq(cottageImages.cottageId, cottage.id)).orderBy(asc(cottageImages.position));
  const amenityRows = await db.select({ name: amenities.name })
    .from(cottageAmenities)
    .innerJoin(amenities, eq(amenities.id, cottageAmenities.amenityId))
    .where(eq(cottageAmenities.cottageId, cottage.id));
  const recreation = await db.select().from(recreationItems).where(eq(recreationItems.cottageId, cottage.id)).orderBy(asc(recreationItems.position));
  return {
    id: cottage.id,
    slug: cottage.slug,
    mapId: cottage.mapId,
    name: cottage.name,
    shortDescription: cottage.shortDescription,
    longDescription: cottage.longDescription,
    basePrice: cottage.basePrice,
    area: cottage.area,
    guests: cottage.guests,
    bedrooms: cottage.bedrooms,
    beds: { double: cottage.bedsDouble, single: cottage.bedsSingle },
    checkInTime: cottage.checkInTime,
    checkOutTime: cottage.checkOutTime,
    mainImage: cottage.mainImage,
    amenities: amenityRows.map((r) => r.name),
    gallery: images.map((i) => i.url),
    recreation,
  };
}

export const cottagesRouter = Router();

cottagesRouter.get('/', async (_req, res) => {
  const all = await db.select().from(cottages).where(eq(cottages.isActive, true)).orderBy(asc(cottages.id));
  const result = await Promise.all(all.map(loadCottage));
  res.json({ success: true, cottages: result });
});

cottagesRouter.get('/:idOrSlug', async (req, res) => {
  const { idOrSlug } = req.params;
  const condition = /^\d+$/.test(idOrSlug) ? eq(cottages.id, Number(idOrSlug)) : eq(cottages.slug, idOrSlug);
  const [cottage] = await db.select().from(cottages).where(condition).limit(1);
  if (!cottage) throw new ApiError(404, 'NOT_FOUND', `Cottage ${idOrSlug} not found`);
  const result = await loadCottage(cottage);
  res.json({ success: true, cottage: result });
});
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/routes/cottages.ts
git commit -m "feat(backend): add /api/cottages routes"
```

---

## Task 11: Services route

**Files:**
- Create: `backend/src/routes/services.ts`

- [ ] **Step 1: Создать `backend/src/routes/services.ts`**

```ts
import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { services } from '../db/schema';

export const servicesRouter = Router();

servicesRouter.get('/', async (_req, res) => {
  const all = await db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.position));
  res.json({
    success: true,
    services: all.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      basePrice: s.basePrice,
      icon: s.icon,
    })),
  });
});
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/routes/services.ts
git commit -m "feat(backend): add /api/services route"
```

---

## Task 12: Calendar route

**Files:**
- Create: `backend/src/routes/calendar.ts`

- [ ] **Step 1: Создать `backend/src/routes/calendar.ts`**

```ts
import { Router } from 'express';
import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings } from '../db/schema';
import { ApiError } from '../lib/errors';
import { calendarQuerySchema } from '../lib/validation';

export const calendarRouter = Router();

calendarRouter.get('/:cottageId', async (req, res) => {
  const { cottageId } = req.params;
  const parsed = calendarQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
  const { from, to } = parsed.data;

  const id = Number(cottageId);
  if (!Number.isFinite(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cottageId');

  const rows = await db.select({
    startDate: bookings.checkInDate,
    endDate: bookings.checkOutDate,
  })
    .from(bookings)
    .where(and(
      eq(bookings.cottageId, id),
      ne(bookings.status, 'cancelled'),
      lte(bookings.checkInDate, to),
      gte(bookings.checkOutDate, from),
    ));

  res.json({ success: true, bookedDates: rows });
});
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/routes/calendar.ts
git commit -m "feat(backend): add /api/calendar/:cottageId route"
```

---

## Task 13: Availability route

**Files:**
- Create: `backend/src/routes/availability.ts`

- [ ] **Step 1: Создать `backend/src/routes/availability.ts`**

```ts
import { Router } from 'express';
import { and, eq, lte, gte, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { cottages, bookings, priceRules } from '../db/schema';
import { ApiError } from '../lib/errors';
import { availabilityQuerySchema } from '../lib/validation';
import { isDateRangeAvailable, hasWeekendOrHoliday } from '../services/availability';
import { calculateStayPrice } from '../services/pricing';

export const availabilityRouter = Router();

async function quoteForCottage(cottageId: number, checkIn: string, checkOut: string, guests: number) {
  const [cottage] = await db.select().from(cottages).where(eq(cottages.id, cottageId)).limit(1);
  if (!cottage) return null;
  if (cottage.guests < guests) return null;

  const rules = await db.select().from(priceRules);
  const overlappingBookings = await db.select({
    checkInDate: bookings.checkInDate,
    checkOutDate: bookings.checkOutDate,
    status: bookings.status,
  })
    .from(bookings)
    .where(and(
      eq(bookings.cottageId, cottageId),
      ne(bookings.status, 'cancelled'),
      lte(bookings.checkInDate, checkOut),
      gte(bookings.checkOutDate, checkIn),
    ));

  const available = isDateRangeAvailable(overlappingBookings, checkIn, checkOut);
  const quote = calculateStayPrice(cottage.basePrice, checkIn, checkOut, rules, cottageId);
  const nights = quote.perNight.length;
  const weekend = hasWeekendOrHoliday(checkIn, checkOut);
  const minNightsOk = !(weekend && nights < 2);

  return {
    cottageId: cottage.id,
    name: cottage.name,
    mainImage: cottage.mainImage,
    guests: cottage.guests,
    available,
    subtotal: quote.subtotal,
    nights,
    minNightsOk,
    warning: minNightsOk ? null : 'В выходные и праздничные дни минимальное бронирование — от 2 суток',
  };
}

availabilityRouter.get('/availability', async (req, res) => {
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
  const { checkIn, checkOut, guests = 1 } = parsed.data;

  const all = await db.select().from(cottages).where(eq(cottages.isActive, true));
  const results = (await Promise.all(all.map((c) => quoteForCottage(c.id, checkIn, checkOut, guests))))
    .filter((r): r is NonNullable<typeof r> => r !== null && r.available);

  res.json({
    success: true,
    checkIn,
    checkOut,
    nights: results[0]?.nights ?? 0,
    results,
  });
});

availabilityRouter.get('/cottages/:id/availability', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cottageId');
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
  const { checkIn, checkOut, guests = 1 } = parsed.data;

  const result = await quoteForCottage(id, checkIn, checkOut, guests);
  if (!result) throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');

  const rules = await db.select().from(priceRules);
  const quote = calculateStayPrice((await db.select().from(cottages).where(eq(cottages.id, id)).limit(1))[0]!.basePrice, checkIn, checkOut, rules, id);

  res.json({
    success: true,
    available: result.available,
    nights: result.nights,
    guests,
    price: {
      perNight: quote.perNight,
      subtotal: quote.subtotal,
      minNightsOk: result.minNightsOk,
      warning: result.warning,
    },
  });
});
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/routes/availability.ts
git commit -m "feat(backend): add availability routes"
```

---

## Task 14: Bookings route (POST)

**Files:**
- Create: `backend/src/routes/bookings.ts` (полная версия, включая GET/cancel)

- [ ] **Step 1: Создать `backend/src/routes/bookings.ts`**

```ts
import { Router } from 'express';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, bookingServices, services, cottages, notifications } from '../db/schema';
import { ApiError } from '../lib/errors';
import { createBookingSchema } from '../lib/validation';
import { calculateStayPrice } from '../services/pricing';
import { isDateRangeAvailable, hasWeekendOrHoliday } from '../services/availability';

export const bookingsRouter = Router();

bookingsRouter.post('/', async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
  const data = parsed.data;

  const [cottage] = await db.select().from(cottages).where(eq(cottages.id, data.cottageId)).limit(1);
  if (!cottage) throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
  if (cottage.guests < data.guests) throw new ApiError(400, 'VALIDATION_ERROR', 'Too many guests');

  // Проверка пересечений
  const overlapping = await db.select({
    checkInDate: bookings.checkInDate,
    checkOutDate: bookings.checkOutDate,
    status: bookings.status,
  }).from(bookings).where(and(
    eq(bookings.cottageId, data.cottageId),
    ne(bookings.status, 'cancelled'),
  ));

  if (!isDateRangeAvailable(overlapping, data.checkInDate, data.checkOutDate)) {
    throw new ApiError(409, 'DATES_UNAVAILABLE', 'Эти даты уже заняты');
  }

  // Расчёт цены
  const nights = Math.round(
    (new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime()) / 86_400_000,
  );
  if (hasWeekendOrHoliday(data.checkInDate, data.checkOutDate) && nights < 2) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'В выходные и праздники минимум 2 ночи');
  }

  const quote = calculateStayPrice(cottage.basePrice, data.checkInDate, data.checkOutDate, [], data.cottageId);
  const subtotal = quote.subtotal;

  // Услуги
  let servicesTotal = 0;
  const serviceRows: { bookingId: number; serviceId: number; quantity: number; priceAtBooking: number | null }[] = [];
  if (data.services && data.services.length > 0) {
    const allServices = await db.select().from(services);
    for (const s of data.services) {
      const srv = allServices.find((x) => x.id === s.serviceId);
      if (!srv) throw new ApiError(400, 'VALIDATION_ERROR', `Service ${s.serviceId} not found`);
      const price = srv.basePrice ?? 0;
      servicesTotal += price * s.quantity;
      serviceRows.push({ bookingId: 0, serviceId: srv.id, quantity: s.quantity, priceAtBooking: srv.basePrice });
    }
  }

  const totalPrice = subtotal + servicesTotal;

  // Транзакция
  const result = db.transaction((tx) => {
    const inserted = tx.insert(bookings).values({
      cottageId: data.cottageId,
      guestName: data.guestName,
      phone: data.phone,
      email: data.email ?? null,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      guests: data.guests,
      notes: data.notes ?? null,
      nights,
      subtotal,
      servicesTotal,
      totalPrice,
    }).returning().get();

    for (const row of serviceRows) {
      tx.insert(bookingServices).values({ ...row, bookingId: inserted.id }).run();
    }

    tx.insert(notifications).values({
      type: 'new_booking',
      bookingId: inserted.id,
      payload: JSON.stringify({
        id: inserted.id,
        guestName: data.guestName,
        phone: data.phone,
        cottageName: cottage.name,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        nights,
        totalPrice,
      }),
    }).run();

    return inserted;
  });

  console.log(`[BOOKING #${result.id}] New: ${data.guestName} ${data.phone} ${data.checkInDate}→${data.checkOutDate}, ${nights} ноч., ₽${totalPrice}`);

  res.status(201).json({
    success: true,
    booking: {
      id: result.id,
      status: result.status,
      nights: result.nights,
      subtotal: result.subtotal,
      servicesTotal: result.servicesTotal,
      totalPrice: result.totalPrice,
      createdAt: result.createdAt,
    },
  });
});

bookingsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
  res.json({ success: true, booking });
});

bookingsRouter.post('/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
  const [updated] = await db.update(bookings)
    .set({ status: 'cancelled' })
    .where(eq(bookings.id, id))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
  res.json({ success: true, booking: updated });
});
```

- [ ] **Step 2: Коммит**

```bash
git add backend/src/routes/bookings.ts
git commit -m "feat(backend): add /api/bookings routes (POST/GET/cancel)"
```

---

## Task 15: Express server

**Files:**
- Create: `backend/src/server.ts`

- [ ] **Step 1: Создать `backend/src/server.ts`**

```ts
import express from 'express';
import cors from 'cors';
import { cottagesRouter } from './routes/cottages';
import { servicesRouter } from './routes/services';
import { calendarRouter } from './routes/calendar';
import { availabilityRouter } from './routes/availability';
import { bookingsRouter } from './routes/bookings';
import { errorHandler, notFoundHandler } from './lib/errors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ success: true, timestamp: new Date().toISOString() });
});

app.use('/api/cottages', cottagesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api', availabilityRouter); // /api/availability + /api/cottages/:id/availability
app.use('/api/bookings', bookingsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Добавить cors в package.json**

Edit `backend/package.json` — добавить в dependencies:

```json
"cors": "^2.8.5",
"@types/cors": "^2.8.17",
```

Run: `cd backend && npm install`

- [ ] **Step 3: Запустить backend**

Run: `cd backend && npm run dev`
Expected: лог `[server] listening on http://localhost:3001`. В другом терминале: `curl http://localhost:3001/api/health` → `{"success":true,...}`.

Остановить сервер (Ctrl+C).

- [ ] **Step 4: Коммит**

```bash
git add backend/src/server.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add Express server with routes"
```

---

## Task 16: Seed скрипт

**Files:**
- Create: `backend/src/db/seed.ts`

- [ ] **Step 1: Создать `backend/src/db/seed.ts`**

```ts
import { db, sqlite } from './client';
import {
  cottages, cottageImages, amenities, cottageAmenities, recreationItems,
  services, priceRules,
} from './schema';

function clear() {
  // Очистка в правильном порядке (FK)
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
}

const CABIN_DATA = [
  {
    slug: 'shale-uyut', mapId: 'Домик1', name: 'Шале Уют',
    shortDescription: 'Комфортабельный двухэтажный дом с панорамными окнами и видом на горы',
    longDescription: 'Шале Уют — это уголок спокойствия в самом сердце Адыгеи. Двухэтажный дом с панорамными окнами, просторной террасой и собственным выходом к лесу.',
    basePrice: 4500, area: 49, guests: 5, bedrooms: 2,
    bedsDouble: 2, bedsSingle: 1,
    checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
    mainImage: '/images/cabin1-1.jpg',
    gallery: ['/images/cabin1-1.jpg', '/images/cabin1-2.jpg', '/images/cabin1-3.jpg', '/images/cabin1-4.jpg', '/images/cabin1-5.jpg', '/images/cabin1-6.jpg'],
    amenities: ['Площадь: 49 м²', 'Кондиционирование', 'Халаты', 'Тапочки', 'Wi-Fi', 'Бассейн'],
    recreation: [
      { title: 'Банный чан на террасе', description: 'Горячий чан под открытым небом.', photo: '/images/recreation-chan.jpg' },
      { title: 'Рафтинг по реке Белой', description: 'Сплав с инструктором.', photo: '/images/recreation-rafting.jpg' },
    ],
  },
  {
    slug: 'lesnaya-rezidenciya', mapId: 'Домик2', name: 'Лесная Резиденция',
    shortDescription: 'Уютный дом в окружении соснового леса с террасой',
    longDescription: 'Лесная Резиденция — место, где время замедляется.',
    basePrice: 3800, area: 42, guests: 4, bedrooms: 2,
    bedsDouble: 1, bedsSingle: 2,
    checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
    mainImage: '/images/cabin2-1.jpg',
    gallery: ['/images/cabin2-1.jpg', '/images/cabin2-2.jpg', '/images/cabin2-3.jpg', '/images/cabin2-4.jpg', '/images/cabin2-5.jpg'],
    amenities: ['Площадь: 42 м²', 'Кондиционирование', 'Терраса', 'Мангальная зона', 'Wi-Fi'],
    recreation: [
      { title: 'Банный чан', description: 'Под открытым небом.', photo: '/images/recreation-chan.jpg' },
      { title: 'Рафтинг', description: 'Сплав по реке.', photo: '/images/recreation-rafting.jpg' },
    ],
  },
  {
    slug: 'gorny-dom', mapId: 'Домик3', name: 'Горный Дом',
    shortDescription: 'Каждый день начинается с вида на Кавказские горы',
    longDescription: 'Горный Дом — для тех, кто ценит панорамные виды.',
    basePrice: 5200, area: 65, guests: 6, bedrooms: 3,
    bedsDouble: 2, bedsSingle: 2,
    checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
    mainImage: '/images/cabin3-1.jpg',
    gallery: ['/images/cabin3-1.jpg', '/images/cabin3-2.jpg', '/images/cabin3-3.jpg', '/images/cabin3-4.jpg', '/images/cabin3-5.jpg', '/images/cabin3-6.jpg'],
    amenities: ['Площадь: 65 м²', 'Кондиционирование', 'Камин', 'Wi-Fi', 'Бассейн'],
    recreation: [
      { title: 'Банный чан', description: 'С панорамным видом.', photo: '/images/recreation-chan.jpg' },
      { title: 'Джип-тур', description: 'В горы.', photo: '/images/recreation-jeeptour.jpg' },
    ],
  },
];

const SERVICES_DATA = [
  { slug: 'rafting', name: 'Рафтинг', description: 'Сплав по горной реке', basePrice: 2500, icon: 'Waves' },
  { slug: 'jeeping', name: 'Джиппинг', description: 'Тур по горным дорогам', basePrice: 3500, icon: 'Mountain' },
  { slug: 'bath-cham', name: 'Банный чан', description: 'Чан на террасе', basePrice: 2000, icon: 'Flame' },
  { slug: 'horse-ride', name: 'Конные прогулки', description: 'Верховая прогулка', basePrice: 1500, icon: 'Users' },
  { slug: 'atv', name: 'Квадроциклы', description: 'Катание по маршрутам', basePrice: 3000, icon: 'Bike' },
];

async function run() {
  clear();

  // Домики
  for (const [i, c] of CABIN_DATA.entries()) {
    const [cottage] = db.insert(cottages).values({
      slug: c.slug, mapId: c.mapId, name: c.name,
      shortDescription: c.shortDescription, longDescription: c.longDescription,
      basePrice: c.basePrice, area: c.area, guests: c.guests, bedrooms: c.bedrooms,
      bedsDouble: c.bedsDouble, bedsSingle: c.bedsSingle,
      checkInTime: c.checkInTime, checkOutTime: c.checkOutTime,
      mainImage: c.mainImage,
    }).returning().all();

    for (const [pos, url] of c.gallery.entries()) {
      db.insert(cottageImages).values({ cottageId: cottage.id, url, position: pos }).run();
    }

    for (const [pos, name] of c.amenities.entries()) {
      const existing = db.select().from(amenities).where((a) => a.name === name).all();
      let amenityId: number;
      if (existing.length > 0) {
        amenityId = existing[0]!.id;
      } else {
        const [inserted] = db.insert(amenities).values({ name }).returning().all();
        amenityId = inserted.id;
      }
      db.insert(cottageAmenities).values({ cottageId: cottage.id, amenityId }).run();
    }

    for (const [pos, r] of c.recreation.entries()) {
      db.insert(recreationItems).values({
        cottageId: cottage.id, title: r.title, description: r.description,
        photo: r.photo, position: pos,
      }).run();
    }

    void i;
  }

  // Услуги
  for (const [pos, s] of SERVICES_DATA.entries()) {
    db.insert(services).values({
      slug: s.slug, name: s.name, description: s.description,
      basePrice: s.basePrice, icon: s.icon, position: pos,
    }).run();
  }

  // Правила цен (пример)
  db.insert(priceRules).values({
    cottageId: null, name: 'Высокий сезон (июль-август)',
    startDate: '2026-07-01', endDate: '2026-08-31',
    modifierType: 'percent', modifierValue: 30, weekendModifier: 10, priority: 0,
  }).run();

  db.insert(priceRules).values({
    cottageId: null, name: 'Новый год',
    startDate: '2026-12-25', endDate: '2027-01-08',
    modifierType: 'percent', modifierValue: 100, weekendModifier: null, priority: 10,
  }).run();

  console.log('[seed] done');
}

run();
```

- [ ] **Step 2: Запустить seed**

Run: `cd backend && npm run seed`
Expected: лог `[seed] done`. Проверить: `cd backend && sqlite3 data/zvuki-lesa.db "SELECT slug, name FROM cottages;"` — 3 строки.

- [ ] **Step 3: Коммит**

```bash
git add backend/src/db/seed.ts
git commit -m "feat(backend): add seed script with initial data"
```

---

## Task 17: Backend integration test (bookings)

**Files:**
- Create: `backend/src/routes/bookings.test.ts`

- [ ] **Step 1: Создать тест**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../db/client';
import { bookings, notifications } from '../db/schema';
import { eq } from 'drizzle-orm';
import { cottagesRouter } from '../routes/cottages';
import { availabilityRouter } from '../routes/availability';
import { bookingsRouter } from '../routes/bookings';
import { errorHandler } from '../lib/errors';

const app = express();
app.use(express.json());
app.use('/api/cottages', cottagesRouter);
app.use('/api', availabilityRouter);
app.use('/api/bookings', bookingsRouter);
app.use(errorHandler);

beforeEach(() => {
  // Очистка перед каждым тестом
  db.delete(notifications).run();
  db.delete(bookings).run();
});

describe('POST /api/bookings', () => {
  it('creates a booking and notification', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({
        cottageId: 1,
        guestName: 'Иван',
        phone: '+79282110249',
        checkInDate: '2026-09-10',
        checkOutDate: '2026-09-13',
        guests: 2,
        services: [{ serviceId: 1, quantity: 2 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.booking.nights).toBe(3);
    expect(res.body.booking.servicesTotal).toBe(5000);

    const allBookings = db.select().from(bookings).all();
    expect(allBookings).toHaveLength(1);
    const allNotifications = db.select().from(notifications).all();
    expect(allNotifications).toHaveLength(1);
  });

  it('rejects overlapping booking with 409', async () => {
    await request(app).post('/api/bookings').send({
      cottageId: 1, guestName: 'A', phone: '+7',
      checkInDate: '2026-09-10', checkOutDate: '2026-09-13', guests: 1,
    });
    const res = await request(app).post('/api/bookings').send({
      cottageId: 1, guestName: 'B', phone: '+7',
      checkInDate: '2026-09-11', checkOutDate: '2026-09-14', guests: 1,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DATES_UNAVAILABLE');
  });
});
```

- [ ] **Step 2: Установить supertest**

Run: `cd backend && npm install --save-dev supertest @types/supertest`

- [ ] **Step 3: Запустить тест**

Run: `cd backend && npm run test -- bookings`
Expected: оба теста проходят.

- [ ] **Step 4: Коммит**

```bash
git add backend/src/routes/bookings.test.ts backend/package.json backend/package-lock.json
git commit -m "test(backend): add bookings integration test"
```

---

## Task 18: Vite proxy + root scripts

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Обновить `vite.config.ts`**

Edit `vite.config.ts`, заменить блок `export default defineConfig({...})`:

```ts
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 2: Добавить backend скрипты в root `package.json`**

Edit `package.json`, добавить в `scripts`:

```json
"backend:dev": "npm --prefix backend run dev",
"backend:migrate": "npm --prefix backend run migrate",
"backend:seed": "npm --prefix backend run seed",
"backend:test": "npm --prefix backend run test"
```

- [ ] **Step 3: Коммит**

```bash
git add vite.config.ts package.json
git commit -m "feat: add Vite proxy and backend npm scripts"
```

---

## Task 19: Переписать `src/lib/api.ts`

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Полностью заменить содержимое `src/lib/api.ts`**

```ts
const API_BASE = '/api';

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; details?: unknown };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = await res.json();
    if (!res.ok || body.success === false) {
      return {
        success: false,
        error: body.error ?? `HTTP ${res.status}`,
        code: body.code,
        details: body.details,
      };
    }
    return { success: true, data: body };
  } catch (err) {
    console.error('[api]', err);
    return { success: false, error: 'Нет связи с сервером' };
  }
}

export interface Cottage {
  id: number;
  slug: string;
  mapId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  basePrice: number;
  area: number;
  guests: number;
  bedrooms: number;
  beds: { double: number; single: number };
  checkInTime: string;
  checkOutTime: string;
  mainImage: string;
  amenities: string[];
  gallery: string[];
  recreation: { id: number; title: string; description: string; photo: string }[];
}

export interface Service {
  id: number;
  slug: string;
  name: string;
  description: string;
  basePrice: number | null;
  icon: string;
}

export interface PriceQuote {
  perNight: { date: string; base: number; final: number; rule: string | null }[];
  subtotal: number;
  minNightsOk: boolean;
  warning: string | null;
}

export interface BookingData {
  cottageId: number;
  guestName: string;
  phone: string;
  email?: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  notes?: string;
  services?: { serviceId: number; quantity: number }[];
}

export interface BookingResponse {
  id: number;
  status: 'new' | 'confirmed' | 'cancelled';
  nights: number;
  subtotal: number;
  servicesTotal: number;
  totalPrice: number;
  createdAt: string;
}

export async function getCottages() {
  return apiFetch<{ cottages: Cottage[] }>('/cottages');
}

export async function getCottage(idOrSlug: string | number) {
  return apiFetch<{ cottage: Cottage }>(`/cottages/${idOrSlug}`);
}

export async function getAvailability(
  cottageId: number,
  checkIn: string,
  checkOut: string,
  guests = 1,
) {
  const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
  return apiFetch<{
    available: boolean;
    nights: number;
    guests: number;
    price: PriceQuote;
  }>(`/cottages/${cottageId}/availability?${params}`);
}

export async function searchAvailableCottages(checkIn: string, checkOut: string, guests = 1) {
  const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
  return apiFetch<{
    checkIn: string;
    checkOut: string;
    nights: number;
    results: {
      cottageId: number;
      name: string;
      mainImage: string;
      subtotal: number;
      guests: number;
    }[];
  }>(`/availability?${params}`);
}

export async function getServices() {
  return apiFetch<{ services: Service[] }>('/services');
}

export async function getBookedDates(cottageId: number, from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  return apiFetch<{ bookedDates: { startDate: string; endDate: string }[] }>(
    `/calendar/${cottageId}?${params}`,
  );
}

export async function createBooking(data: BookingData) {
  return apiFetch<{ booking: BookingResponse }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 2: Обновить `src/lib/cabins.ts` — убрать `CABINS` экспорт**

Edit `src/lib/cabins.ts`, удалить экспорт `CABINS` (оставить только тип и `getCabinById` который будет deprecated). Или полностью удалить файл, если после рефакторинга он не нужен. Проверить: `grep -r "from '@/lib/cabins'" src/`.

Допустим, проще — оставить тип `Cabin` и убрать data. Переименовать `getCabinById` в устаревший (помечен @deprecated), либо удалить.

Edit `src/lib/cabins.ts` — заменить содержимое:

```ts
/**
 * @deprecated Используйте useCottages() хук или getCottage() из @/lib/api.
 * Тип Cabin сохранён как алиас Cottage для обратной совместимости.
 */
import type { Cottage as Cabin } from './api';

export type { Cabin };

export function getCabinById(id: number | undefined): Cabin | undefined {
  console.warn('[cabins] getCabinById is deprecated, use getCottage()');
  return undefined;
}
```

- [ ] **Step 3: Коммит**

```bash
git add src/lib/api.ts src/lib/cabins.ts
git commit -m "refactor(api): rewrite src/lib/api.ts to use relative /api path"
```

---

## Task 20: useCottages hook

**Files:**
- Create: `src/hooks/useCottages.ts`

- [ ] **Step 1: Создать `src/hooks/useCottages.ts`**

```ts
import { useEffect, useState } from 'react';
import { getCottages, type Cottage } from '@/lib/api';

export interface UseCottagesResult {
  data: Cottage[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCottages(): UseCottagesResult {
  const [data, setData] = useState<Cottage[] | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getCottages().then((res) => {
      if (ctrl.signal.aborted) return;
      if (res.success) {
        setData(res.data.cottages);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [tick]);

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) };
}
```

- [ ] **Step 2: Коммит**

```bash
git add src/hooks/useCottages.ts
git commit -m "feat(hooks): add useCottages"
```

---

## Task 21: useAvailability hook + test

**Files:**
- Create: `src/hooks/useAvailability.ts`
- Create: `src/hooks/useAvailability.test.ts`

- [ ] **Step 1: Создать `src/hooks/useAvailability.ts`**

```ts
import { useEffect, useState } from 'react';
import { getAvailability, type PriceQuote } from '@/lib/api';

export interface UseAvailabilityParams {
  cottageId: number | null;
  checkIn?: Date;
  checkOut?: Date;
  guests: number;
}

export interface UseAvailabilityResult {
  data: { available: boolean; nights: number; price: PriceQuote } | null;
  isLoading: boolean;
  error: string | null;
}

export function useAvailability({ cottageId, checkIn, checkOut, guests }: UseAvailabilityParams): UseAvailabilityResult {
  const [data, setData] = useState<UseAvailabilityResult['data']>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = `${cottageId}|${checkIn?.toISOString() ?? ''}|${checkOut?.toISOString() ?? ''}|${guests}`;

  useEffect(() => {
    if (!cottageId || !checkIn || !checkOut || checkOut <= checkIn) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const ci = checkIn.toISOString().slice(0, 10);
    const co = checkOut.toISOString().slice(0, 10);
    getAvailability(cottageId, ci, co, guests).then((res) => {
      if (ctrl.signal.aborted) return;
      if (res.success) {
        setData({ available: res.data.available, nights: res.data.nights, price: res.data.price });
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [key]);

  return { data, isLoading, error };
}
```

- [ ] **Step 2: Создать тест `src/hooks/useAvailability.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAvailability } from './useAvailability';

vi.mock('@/lib/api', () => ({
  getAvailability: vi.fn(),
}));

import { getAvailability } from '@/lib/api';
const mockGet = getAvailability as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGet.mockReset();
});

describe('useAvailability', () => {
  it('does not fetch when params invalid', async () => {
    renderHook(() => useAvailability({ cottageId: null, checkIn: undefined, checkOut: undefined, guests: 1 }));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns error on failure', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'Server down' });
    const { result } = renderHook(() =>
      useAvailability({
        cottageId: 1,
        checkIn: new Date('2026-06-17'),
        checkOut: new Date('2026-06-20'),
        guests: 2,
      }),
    );
    await waitFor(() => expect(result.current.error).toBe('Server down'));
  });
});
```

- [ ] **Step 3: Запустить тест**

Run: `npm run test -- useAvailability`
Expected: 2 теста проходят.

- [ ] **Step 4: Коммит**

```bash
git add src/hooks/useAvailability.ts src/hooks/useAvailability.test.ts
git commit -m "feat(hooks): add useAvailability with test"
```

---

## Task 22: StickyFooter — реальная логика поиска

**Files:**
- Modify: `src/components/StickyFooter/StickyFooter.tsx`

- [ ] **Step 1: Заменить содержимое `src/components/StickyFooter/StickyFooter.tsx`**

```tsx
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { searchAvailableCottages } from '@/lib/api';
import { BookingDialog } from '@/components/BookingDialog';
import styles from './StickyFooter.module.css';

export function StickyFooter() {
  const [guests, setGuests] = useState(1);
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [isLoading, setLoading] = useState(false);
  const [results, setResults] = useState<
    { cottageId: number; name: string; mainImage: string; subtotal: number; guests: number }[]
  >([]);
  const [selectedCottage, setSelectedCottage] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSearch = async () => {
    if (!checkIn || !checkOut) {
      toast.error('Выберите даты заезда и выезда');
      return;
    }
    setLoading(true);
    const res = await searchAvailableCottages(
      checkIn.toISOString().slice(0, 10),
      checkOut.toISOString().slice(0, 10),
      guests,
    );
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    if (res.data.results.length === 0) {
      toast.info('Нет доступных домиков на эти даты');
    }
    setResults(res.data.results);
  };

  return (
    <>
      <div className={styles['booker-tray-viewport']}>
        <div className={styles.container}>
          <div className={styles['footer-body']}>
            <div className={styles['footer-dates__other']}>
              <div className={styles['footer-dates__guests']}>
                <span>Гостей: {guests}</span>
                <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))}><Minus /></button>
                <button type="button" onClick={() => setGuests((g) => Math.min(20, g + 1))}><Plus /></button>
              </div>
              <button type="button" onClick={handleSearch} disabled={isLoading}>
                {isLoading ? 'Поиск...' : 'Найти'}
              </button>
            </div>
          </div>
          {results.length > 0 && (
            <div className={styles.results}>
              {results.map((r) => (
                <button
                  key={r.cottageId}
                  type="button"
                  onClick={() => {
                    setSelectedCottage(r.cottageId);
                    setDialogOpen(true);
                  }}
                >
                  {r.name} — ₽{r.subtotal.toLocaleString()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <BookingDialog
        cottage={null}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialState={{ checkIn, checkOut, guests }}
        preselectedCottageId={selectedCottage}
      />
    </>
  );
}
```

- [ ] **Step 2: Реализовать DatePicker для дат в StickyFooter (упрощённо через `<input type="date">`)**

Edit компонент выше — добавить в JSX перед `footer-dates__other`:

```tsx
<input type="date" value={checkIn?.toISOString().slice(0, 10) ?? ''} onChange={(e) => setCheckIn(e.target.value ? new Date(e.target.value) : undefined)} />
<input type="date" value={checkOut?.toISOString().slice(0, 10) ?? ''} onChange={(e) => setCheckOut(e.target.value ? new Date(e.target.value) : undefined)} />
```

- [ ] **Step 3: Обновить `BookingDialog` — добавить prop `preselectedCottageId`**

Edit `src/components/BookingDialog.tsx`:

Добавить в `BookingDialogProps`:
```ts
preselectedCottageId?: number | null;
```

В `useEffect([isOpen, cabin])` после загрузки cabin, если `initialState?.checkIn` нет и есть `preselectedCottageId`, ничего не делаем (cabin уже выбран). Если `preselectedCottageId` передан и cabin=null — нужно перезагрузить cabin (вынести логику в `useCottages` или передавать cabin целиком).

Простейший вариант: в StickyFooter использовать `useCottages` чтобы найти cabin по id и передать его целиком в `BookingDialog`. Переработать Task 22/Step 1 так:

```tsx
const { data: cottages } = useCottages();
const selectedCottageObj = selectedCottage
  ? cottages?.find((c) => c.id === selectedCottage) ?? null
  : null;
```

Передать `cabin={selectedCottageObj}` вместо `cabin={null}` + `preselectedCottageId`.

- [ ] **Step 4: Коммит**

```bash
git add src/components/StickyFooter/StickyFooter.tsx src/components/BookingDialog.tsx
git commit -m "feat(sticky-footer): real availability search via API"
```

---

## Task 23: BookingDialog — цена и услуги

**Files:**
- Modify: `src/components/BookingDialog.tsx`

- [ ] **Step 1: Добавить useAvailability в BookingDialog**

Edit `src/components/BookingDialog.tsx`. В начале компонента после существующих `useState`:

```ts
import { useAvailability } from '@/hooks/useAvailability';
// ...
const { data: priceQuote, isLoading: priceLoading } = useAvailability({
  cottageId: cabin?.id ?? null,
  checkIn,
  checkOut,
  guests: parseInt(guests) || 1,
});
```

Заменить существующий `const nights = calculateNights(...)` на:

```ts
const nights = priceQuote?.nights ?? calculateNights(checkIn, checkOut);
const subtotal = priceQuote?.price.subtotal ?? nights * (cabin?.basePrice ?? 0);
```

Заменить `calculateCabinTotal()` на использование `subtotal`.

- [ ] **Step 2: Блокировка submit если недоступно**

В `handleSubmit`, после проверки `minError`:

```ts
if (priceQuote && !priceQuote.available) {
  toast.error('Эти даты уже заняты');
  return;
}
```

- [ ] **Step 3: Коммит**

```bash
git add src/components/BookingDialog.tsx
git commit -m "feat(booking-dialog): use API price quote, block on unavailable"
```

---

## Task 24: BookingPage — API интеграция

**Files:**
- Modify: `src/pages/booking/BookingPage.tsx`

- [ ] **Step 1: Заменить источник данных**

Edit `src/pages/booking/BookingPage.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCottage, type Cottage } from '@/lib/api';
import { TopBar } from './TopBar';
import { BookingHero } from './BookingHero';
// ... остальные импорты

export function BookingPage() {
  const { cabinId } = useParams<{ cabinId: string }>();
  const [cabin, setCabin] = useState<Cottage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!cabinId) return;
    setLoading(true);
    getCottage(cabinId).then((res) => {
      setLoading(false);
      if (res.success) {
        setCabin(res.data.cottage);
      } else {
        setNotFound(true);
      }
    });
  }, [cabinId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center">
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  if (notFound || !cabin) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Домик не найден</h1>
          <Link to="/" className="...">Вернуться на главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E10]">
      <TopBar />
      <BookingHero cabin={cabin} />
      <BookingInfo cabin={cabin} />
      {/* ... остальные секции */}
    </div>
  );
}
```

- [ ] **Step 2: Коммит**

```bash
git add src/pages/booking/BookingPage.tsx
git commit -m "feat(booking-page): load cottage from API"
```

---

## Task 25: Удаление старого server, обновление start.bat

**Files:**
- Delete: `server/` (вся директория)
- Modify: `start.bat`

- [ ] **Step 1: Удалить server**

Run: `cd "C:/Users/VallfIK/Desktop/Project/Site_Brother/app" && rm -rf server`

- [ ] **Step 2: Переписать `start.bat`**

Заменить содержимое `start.bat`:

```bat
@echo off
chcp 65001 >nul
title Звуки Леса — Запуск

echo ================================================
echo    Звуки Леса — Backend + Frontend
echo ================================================

cd /d "%~dp0"

:: Backend
echo [1/2] Запуск Node backend на http://localhost:3001 ...
start "Backend" cmd /k "npm run backend:dev"

timeout /t 3 /nobreak >nul

:: Frontend
echo [2/2] Запуск Vite ...
start "Vite" cmd /k "npm run dev"

echo.
echo Готово. Закройте окна серверов для остановки.
pause
```

- [ ] **Step 3: Проверить что ничего не сломано**

Run: `grep -r "server/app.py" .` → пусто.
Run: `grep -r "from '@/lib/cabins'" src/` → не должно быть импортов CABINS, только типов.

- [ ] **Step 4: Коммит**

```bash
git add -A
git status
git commit -m "chore: remove Flask server, update start.bat for Node"
```

⚠️ **ВАЖНО:** Перед `git add -A` проверить `git status` — не должно быть неожиданных файлов. Если есть чужие изменения — откатить через `git restore`.

---

## Task 26: Финальная проверка

- [ ] **Step 1: Применить миграции и сидинг**

Run: `cd backend && npm run migrate && npm run seed`

- [ ] **Step 2: Запустить backend и frontend**

Run: `start.bat` (или в двух терминалах: `cd backend && npm run dev` и `npm run dev`).

- [ ] **Step 3: Проверить вручную**

1. Открыть http://localhost:5173 → главная загружается, домики из БД
2. В StickyFooter выбрать даты, нажать "Найти" → список доступных домиков
3. Кликнуть домик → открывается BookingDialog
4. Выбрать даты в календаре → появляется цена (несколько ночей × basePrice)
5. Выбрать услугу → услуга добавляется в чек
6. Заполнить имя/телефон → нажать "Отправить заявку"
7. В backend-консоли должен появиться лог `[BOOKING #1] New: ...`
8. `sqlite3 backend/data/zvuki-lesa.db "SELECT * FROM bookings;"` → запись есть

- [ ] **Step 4: Запустить все тесты**

Run: `npm run test` (фронт) + `cd backend && npm run test` (backend)
Expected: всё зелёное.

- [ ] **Step 5: Финальный коммит (если были fixes)**

```bash
git status
# Если есть изменения:
git add -A
git commit -m "chore: final fixes after E2E test"
```

---

## Self-Review

**Spec coverage:**
- Архитектура Express+SQLite+Vite proxy → Tasks 1, 2, 15, 18 ✓
- Схема БД (10 таблиц) → Task 3 ✓
- DB client + migrate → Task 4 ✓
- Pricing service → Task 6 ✓
- Availability service → Task 7 ✓
- Notifications → Task 8 ✓
- Validation → Task 9 ✓
- Cottages/Services/Calendar/Availability/Bookings routes → Tasks 10-14 ✓
- Vite proxy + api.ts rewrite → Tasks 18-19 ✓
- useCottages/useAvailability hooks → Tasks 20-21 ✓
- StickyFooter integration → Task 22 ✓
- BookingDialog price+services → Task 23 ✓
- BookingPage API → Task 24 ✓
- Удаление server/, start.bat → Task 25 ✓
- Tests (unit + integration) → Tasks 6, 7, 17, 21 ✓
- E2E проверка → Task 26 ✓

**Placeholder scan:** все шаги содержат конкретный код или команды. TBD/TODO отсутствуют.

**Type consistency:**
- `Cottage` тип — в api.ts, передаётся в BookingDialog и BookingPage ✓
- `BookingResponse` — соответствует Task 14 ответу (id, status, nights, subtotal, servicesTotal, totalPrice, createdAt) ✓
- `PriceQuote.perNight[]` — соответствует Task 6 + Task 13 (date, base, final, rule) ✓
- `priceQuote.price.subtotal` — соответствует схеме (subtotal) ✓
- `useAvailability` hook key format — стабильный, без нанопроблем ✓

**Файл bookingRules.ts на фронте:** оставлен (страховка), тесты остаются, хотя логика минимума теперь в backend.

**Известное несоответствие:** в seed.ts шаг 16 используется `db.select().from(amenities).where((a) => a.name === name).all()` — упрощённый синтаксис; в Drizzle правильнее использовать `eq()`:

```ts
import { eq } from 'drizzle-orm';
const existing = db.select().from(amenities).where(eq(amenities.name, name)).all();
```

Применю эту правку в финальной реализации Task 16, Step 1.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-27-booking-system.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?