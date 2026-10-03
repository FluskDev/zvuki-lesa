# Админка бронирований — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрытая паролем админка для подтверждения заявок с сайта и ручного заведения/редактирования/отмены броней с обзором занятости.

**Architecture:** Новый роутер `/api/admin` за middleware `requireAdmin` (Bearer-токен, HMAC на `node:crypto`, без новых зависимостей). Фронт — отдельные страницы `/admin/login` и `/admin` вне лендинга, клиент `adminApi` с токеном в `localStorage`. Схема БД получает одну колонку `source`. Существующие сервисы `pricing.ts`/`availability.ts` переиспользуются.

**Tech Stack:** Express 4, better-sqlite3 + Drizzle, zod, Vitest + supertest (бэк); React 19 + React Router 6, shadcn/ui, Vitest + Testing Library (фронт).

**Спека:** `docs/superpowers/specs/2026-07-10-admin-booking-management-design.md`

---

## Структура файлов

**Бэкенд (создать):**
- `backend/src/lib/adminAuth.ts` — подпись/проверка токена.
- `backend/src/routes/admin.ts` — все эндпоинты `/api/admin`.
- `backend/src/lib/adminAuth.test.ts`, `backend/src/routes/admin.test.ts` — тесты.
- `backend/.env.example` — образец переменных.

**Бэкенд (изменить):**
- `backend/src/db/schema.ts` — колонка `source`.
- `backend/src/lib/errors.ts` — код `UNAUTHORIZED`.
- `backend/src/lib/validation.ts` — схемы `manualBookingSchema`, `updateBookingSchema`, `adminListQuerySchema`.
- `backend/src/routes/bookings.ts` — проставлять `source='site'`, удалить публичные `cancel` и `GET /:id`.
- `backend/src/server.ts` — смонтировать `adminRouter`.
- `backend/drizzle/` — новая миграция (генерируется).

**Фронтенд (создать):**
- `src/lib/adminApi.ts` — API-клиент админки.
- `src/lib/adminApi.test.ts` — тест клиента.
- `src/pages/admin/RequireAdmin.tsx` — гвард + `src/pages/admin/RequireAdmin.test.tsx`.
- `src/pages/admin/AdminLogin.tsx` — страница входа.
- `src/pages/admin/AdminDashboard.tsx` — экран (календарь + список).
- `src/pages/admin/BookingsList.tsx` — список заявок.
- `src/pages/admin/OccupancyCalendar.tsx` — сетка занятости.
- `src/pages/admin/BookingFormDialog.tsx` — форма создания/редактирования.

**Фронтенд (изменить):**
- `src/App.tsx` — маршруты `/admin/login`, `/admin`.

**Документация (изменить):**
- `CLAUDE.md` — раздел про админку.

---

## Phase A — Бэкенд

### Task 1: Колонка `source` в схеме и миграция

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create (генерируется): `backend/drizzle/00XX_*.sql`

- [ ] **Step 1: Добавить колонку в схему**

В `backend/src/db/schema.ts` в объявление `bookings`, после поля `status`, добавить:

```ts
  source: text('source', { enum: ['site', 'manual'] }).notNull().default('site'),
```

- [ ] **Step 2: Сгенерировать миграцию**

Run: `cd backend && npx drizzle-kit generate`
Expected: создан новый файл в `backend/drizzle/` с `ALTER TABLE bookings ADD ... source`.

- [ ] **Step 3: Применить миграцию**

Run: `cd backend && npm run migrate`
Expected: вывод `[migrate] done` без ошибок.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle
git commit -m "feat(db): add source column to bookings"
```

---

### Task 2: Утилита токена `adminAuth.ts`

**Files:**
- Create: `backend/src/lib/adminAuth.ts`
- Test: `backend/src/lib/adminAuth.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `backend/src/lib/adminAuth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './adminAuth';

describe('adminAuth', () => {
  it('signs a token that verifies', () => {
    const t = signToken();
    expect(verifyToken(t)).toBe(true);
  });

  it('rejects a tampered token', () => {
    const t = signToken();
    expect(verifyToken(t + 'x')).toBe(false);
  });

  it('rejects garbage', () => {
    expect(verifyToken('not-a-token')).toBe(false);
    expect(verifyToken('')).toBe(false);
  });

  it('rejects an expired token', () => {
    const past = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const t = signToken(past);
    expect(verifyToken(t)).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `cd backend && npx vitest run src/lib/adminAuth.test.ts`
Expected: FAIL — модуль `./adminAuth` не найден.

- [ ] **Step 3: Реализовать утилиту**

Создать `backend/src/lib/adminAuth.ts`:

```ts
import crypto from 'node:crypto';

const SECRET = process.env.ADMIN_TOKEN_SECRET ?? 'dev-insecure-secret';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

function hmac(input: string): string {
  return crypto.createHmac('sha256', SECRET).update(input).digest('base64url');
}

// signedAt по умолчанию — текущее время; параметр нужен для тестов срока.
export function signToken(signedAt: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: signedAt + TTL_MS })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(token: string, now: number = Date.now()): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = hmac(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Запустить тест — должен пройти**

Run: `cd backend && npx vitest run src/lib/adminAuth.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/adminAuth.ts backend/src/lib/adminAuth.test.ts
git commit -m "feat(admin): add HMAC token sign/verify util"
```

---

### Task 3: Код ошибки `UNAUTHORIZED`, схемы валидации, middleware + login

**Files:**
- Modify: `backend/src/lib/errors.ts`
- Modify: `backend/src/lib/validation.ts`
- Create: `backend/src/routes/admin.ts`
- Test: `backend/src/routes/admin.test.ts`

- [ ] **Step 1: Добавить код ошибки**

В `backend/src/lib/errors.ts` в тип `ApiErrorCode` добавить `'UNAUTHORIZED'`:

```ts
export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'DATES_UNAVAILABLE' | 'CONFLICT' | 'INTERNAL' | 'UNAUTHORIZED';
```

- [ ] **Step 2: Добавить схемы валидации**

В конец `backend/src/lib/validation.ts` добавить (используя уже объявленный `isoDate`):

```ts
export const loginSchema = z.object({
  password: z.string().min(1),
});

export const manualBookingSchema = z.object({
  cottageId: z.number().int().positive(),
  guestName: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  email: z.string().email().optional(),
  checkInDate: isoDate,
  checkOutDate: isoDate,
  guests: z.number().int().min(1).max(50),
  notes: z.string().max(2000).optional(),
  managerComment: z.string().max(2000).optional(),
  priceOverride: z.number().int().min(0).optional(),
  services: z.array(z.object({
    serviceId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(20),
  })).optional(),
}).refine((d) => d.checkOutDate > d.checkInDate, {
  message: 'checkOutDate must be after checkInDate',
  path: ['checkOutDate'],
});

export const updateBookingSchema = z.object({
  guestName: z.string().min(1).max(200).optional(),
  phone: z.string().min(1).max(50).optional(),
  email: z.string().email().nullable().optional(),
  checkInDate: isoDate.optional(),
  checkOutDate: isoDate.optional(),
  guests: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
  managerComment: z.string().max(2000).nullable().optional(),
  totalPrice: z.number().int().min(0).optional(),
  status: z.enum(['new', 'confirmed', 'cancelled']).optional(),
});

export const adminListQuerySchema = z.object({
  status: z.enum(['new', 'confirmed', 'cancelled', 'all']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  cottageId: z.coerce.number().int().positive().optional(),
});
```

- [ ] **Step 3: Написать падающий тест на login + middleware**

Создать `backend/src/routes/admin.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import { db } from '../db/client';
import { bookings, notifications, cottages } from '../db/schema';
import { eq } from 'drizzle-orm';
import { adminRouter } from './admin';
import { errorHandler } from '../lib/errors';

process.env.ADMIN_PASSWORD = 'secret123';
process.env.ADMIN_TOKEN_SECRET = 'test-secret';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use(errorHandler);

async function login(): Promise<string> {
  const res = await request(app).post('/api/admin/login').send({ password: 'secret123' });
  return res.body.token as string;
}

beforeAll(() => {
  const existing = db.select().from(cottages).where(eq(cottages.id, 1)).get();
  if (!existing) {
    db.insert(cottages).values({
      slug: 'test-cottage', mapId: 'T1', name: 'Test Cottage',
      shortDescription: 'x', longDescription: 'x', basePrice: 4000,
      area: 30, guests: 4, bedrooms: 1, bedsDouble: 1, bedsSingle: 0,
      checkInTime: '15:00', checkOutTime: '12:00', mainImage: '/t.jpg',
    }).run();
  }
});

beforeEach(() => {
  db.delete(notifications).run();
  db.delete(bookings).run();
});

describe('POST /api/admin/login', () => {
  it('returns a token for the correct password', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: 'secret123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

describe('requireAdmin', () => {
  it('blocks access without a token', async () => {
    const res = await request(app).get('/api/admin/bookings');
    expect(res.status).toBe(401);
  });

  it('allows access with a valid token', async () => {
    const token = await login();
    const res = await request(app).get('/api/admin/bookings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 4: Запустить тест — должен упасть**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: FAIL — модуль `./admin` не найден.

- [ ] **Step 5: Создать роутер с login + middleware + пустым списком**

Создать `backend/src/routes/admin.ts`:

```ts
import { Router, type Request, type Response, type NextFunction } from 'express';
import { and, eq, gte, lte, ne, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, bookingServices, services, cottages } from '../db/schema';
import { ApiError } from '../lib/errors';
import { signToken, verifyToken } from '../lib/adminAuth';
import {
  loginSchema, manualBookingSchema, updateBookingSchema, adminListQuerySchema,
} from '../lib/validation';
import { calculateStayPrice } from '../services/pricing';

export const adminRouter = Router();

adminRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
  if (parsed.data.password !== process.env.ADMIN_PASSWORD) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Неверный пароль');
  }
  res.json({ success: true, token: signToken() });
});

function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !verifyToken(token)) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
  }
  next();
}

adminRouter.use(requireAdmin);

adminRouter.get('/bookings', async (_req, res) => {
  res.json({ success: true, bookings: [] });
});
```

- [ ] **Step 6: Запустить тест — должен пройти**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: PASS (4 теста login + requireAdmin).

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/errors.ts backend/src/lib/validation.ts backend/src/routes/admin.ts backend/src/routes/admin.test.ts
git commit -m "feat(admin): login route and requireAdmin middleware"
```

---

### Task 4: Список броней и календарь занятости

**Files:**
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/src/routes/admin.test.ts`

- [ ] **Step 1: Дописать тесты списка и календаря**

В `backend/src/routes/admin.test.ts` добавить хелпер вставки и новый describe-блок (в конец файла):

```ts
function insertBooking(over: Partial<typeof bookings.$inferInsert> = {}) {
  return db.insert(bookings).values({
    cottageId: 1, guestName: 'Гость', phone: '+70000000000',
    checkInDate: '2026-09-10', checkOutDate: '2026-09-12', guests: 2,
    nights: 2, subtotal: 8000, servicesTotal: 0, totalPrice: 8000,
    status: 'new', source: 'site', ...over,
  }).returning().get();
}

describe('GET /api/admin/bookings', () => {
  it('lists bookings with cottage name', async () => {
    const token = await login();
    insertBooking({ guestName: 'Иван' });
    const res = await request(app).get('/api/admin/bookings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(1);
    expect(res.body.bookings[0].guestName).toBe('Иван');
    expect(res.body.bookings[0].cottageName).toBe('Test Cottage');
  });

  it('filters by status', async () => {
    const token = await login();
    insertBooking({ status: 'new' });
    insertBooking({ status: 'confirmed' });
    const res = await request(app).get('/api/admin/bookings?status=confirmed').set('Authorization', `Bearer ${token}`);
    expect(res.body.bookings).toHaveLength(1);
    expect(res.body.bookings[0].status).toBe('confirmed');
  });
});

describe('GET /api/admin/calendar', () => {
  it('returns occupied intervals excluding cancelled', async () => {
    const token = await login();
    insertBooking({ status: 'confirmed', checkInDate: '2026-09-10', checkOutDate: '2026-09-12' });
    insertBooking({ status: 'cancelled', checkInDate: '2026-09-15', checkOutDate: '2026-09-17' });
    const res = await request(app)
      .get('/api/admin/calendar?from=2026-09-01&to=2026-09-30')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.occupancy).toHaveLength(1);
    expect(res.body.occupancy[0].checkInDate).toBe('2026-09-10');
  });
});
```

- [ ] **Step 2: Запустить — новые тесты падают**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: FAIL — список всегда пустой, у календаря нет маршрута.

- [ ] **Step 3: Реализовать список и календарь**

В `backend/src/routes/admin.ts` заменить заглушку `GET /bookings` и добавить `GET /calendar`:

```ts
adminRouter.get('/bookings', async (req, res) => {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
  const q = parsed.data;

  const conditions = [];
  if (q.status && q.status !== 'all') conditions.push(eq(bookings.status, q.status));
  if (q.cottageId) conditions.push(eq(bookings.cottageId, q.cottageId));
  if (q.from) conditions.push(gte(bookings.checkInDate, q.from));
  if (q.to) conditions.push(lte(bookings.checkInDate, q.to));

  const rows = await db
    .select({
      id: bookings.id, cottageId: bookings.cottageId, cottageName: cottages.name,
      guestName: bookings.guestName, phone: bookings.phone, email: bookings.email,
      checkInDate: bookings.checkInDate, checkOutDate: bookings.checkOutDate,
      guests: bookings.guests, nights: bookings.nights,
      subtotal: bookings.subtotal, servicesTotal: bookings.servicesTotal,
      totalPrice: bookings.totalPrice, status: bookings.status, source: bookings.source,
      notes: bookings.notes, managerComment: bookings.managerComment, createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(cottages, eq(cottages.id, bookings.cottageId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(bookings.checkInDate));

  res.json({ success: true, bookings: rows });
});

adminRouter.get('/calendar', async (req, res) => {
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'from/to required as YYYY-MM-DD');
  }
  const rows = await db
    .select({
      bookingId: bookings.id, cottageId: bookings.cottageId,
      guestName: bookings.guestName, status: bookings.status,
      checkInDate: bookings.checkInDate, checkOutDate: bookings.checkOutDate,
    })
    .from(bookings)
    .where(and(
      ne(bookings.status, 'cancelled'),
      lte(bookings.checkInDate, to),
      gte(bookings.checkOutDate, from),
    ))
    .orderBy(asc(bookings.checkInDate));

  res.json({ success: true, occupancy: rows });
});
```

- [ ] **Step 4: Запустить — все тесты проходят**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/admin.ts backend/src/routes/admin.test.ts
git commit -m "feat(admin): bookings list and occupancy calendar endpoints"
```

---

### Task 5: Ручное создание брони (без ограничений)

**Files:**
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/src/routes/admin.test.ts`

- [ ] **Step 1: Дописать тесты ручного создания**

В `backend/src/routes/admin.test.ts` добавить в конец:

```ts
describe('POST /api/admin/bookings (manual)', () => {
  it('creates a confirmed manual booking over occupied dates and 1 night', async () => {
    const token = await login();
    insertBooking({ status: 'confirmed', checkInDate: '2026-09-10', checkOutDate: '2026-09-14' });
    const res = await request(app).post('/api/admin/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cottageId: 1, guestName: 'Звонок', phone: '+79281112233',
        checkInDate: '2026-09-11', checkOutDate: '2026-09-12', guests: 2,
      });
    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe('confirmed');
    expect(res.body.booking.source).toBe('manual');
    expect(res.body.booking.nights).toBe(1);
  });

  it('respects priceOverride', async () => {
    const token = await login();
    const res = await request(app).post('/api/admin/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cottageId: 1, guestName: 'Скидка', phone: '+79281112233',
        checkInDate: '2026-09-20', checkOutDate: '2026-09-22', guests: 2,
        priceOverride: 5000,
      });
    expect(res.status).toBe(201);
    expect(res.body.booking.totalPrice).toBe(5000);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: FAIL — нет маршрута `POST /bookings`.

- [ ] **Step 3: Реализовать ручное создание**

В `backend/src/routes/admin.ts` добавить:

```ts
adminRouter.post('/bookings', async (req, res) => {
  const parsed = manualBookingSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
  const data = parsed.data;

  const [cottage] = await db.select().from(cottages).where(eq(cottages.id, data.cottageId)).limit(1);
  if (!cottage) throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');

  // Свобода админа: НЕ проверяем занятость и минимум ночей.
  const nights = Math.round(
    (new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime()) / 86_400_000,
  );

  // Рекомендательный расчёт (правила пока не подгружаются — как в публичном создании).
  const quote = calculateStayPrice(cottage.basePrice, data.checkInDate, data.checkOutDate, [], data.cottageId);
  const subtotal = quote.subtotal;

  let servicesTotal = 0;
  const serviceRows: { serviceId: number; quantity: number; priceAtBooking: number | null }[] = [];
  if (data.services?.length) {
    const allServices = await db.select().from(services);
    for (const s of data.services) {
      const srv = allServices.find((x) => x.id === s.serviceId);
      if (!srv) throw new ApiError(400, 'VALIDATION_ERROR', `Service ${s.serviceId} not found`);
      servicesTotal += (srv.basePrice ?? 0) * s.quantity;
      serviceRows.push({ serviceId: srv.id, quantity: s.quantity, priceAtBooking: srv.basePrice });
    }
  }

  const totalPrice = data.priceOverride ?? subtotal + servicesTotal;

  const result = db.transaction((tx) => {
    const inserted = tx.insert(bookings).values({
      cottageId: data.cottageId, guestName: data.guestName, phone: data.phone,
      email: data.email ?? null, checkInDate: data.checkInDate, checkOutDate: data.checkOutDate,
      guests: data.guests, notes: data.notes ?? null, managerComment: data.managerComment ?? null,
      nights, subtotal, servicesTotal, totalPrice,
      status: 'confirmed', source: 'manual',
    }).returning().get();
    for (const row of serviceRows) {
      tx.insert(bookingServices).values({ ...row, bookingId: inserted.id }).run();
    }
    return inserted;
  });

  res.status(201).json({ success: true, booking: result });
});
```

- [ ] **Step 4: Запустить — проходит**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/admin.ts backend/src/routes/admin.test.ts
git commit -m "feat(admin): manual booking creation without constraints"
```

---

### Task 6: Редактирование, подтверждение, отмена

**Files:**
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/src/routes/admin.test.ts`

- [ ] **Step 1: Дописать тесты**

В `backend/src/routes/admin.test.ts` добавить в конец:

```ts
describe('PATCH / confirm / cancel', () => {
  it('confirms a booking', async () => {
    const token = await login();
    const b = insertBooking({ status: 'new' });
    const res = await request(app).post(`/api/admin/bookings/${b.id}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('confirmed');
  });

  it('cancels a booking', async () => {
    const token = await login();
    const b = insertBooking({ status: 'confirmed' });
    const res = await request(app).post(`/api/admin/bookings/${b.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.booking.status).toBe('cancelled');
  });

  it('recomputes nights when dates change, keeps totalPrice unless provided', async () => {
    const token = await login();
    const b = insertBooking({ checkInDate: '2026-09-10', checkOutDate: '2026-09-12', nights: 2, totalPrice: 8000 });
    const res = await request(app).patch(`/api/admin/bookings/${b.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checkInDate: '2026-09-10', checkOutDate: '2026-09-15' });
    expect(res.status).toBe(200);
    expect(res.body.booking.nights).toBe(5);
    expect(res.body.booking.totalPrice).toBe(8000);
  });

  it('updates totalPrice when provided', async () => {
    const token = await login();
    const b = insertBooking({ totalPrice: 8000 });
    const res = await request(app).patch(`/api/admin/bookings/${b.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totalPrice: 6000 });
    expect(res.body.booking.totalPrice).toBe(6000);
  });

  it('returns 404 for a missing booking', async () => {
    const token = await login();
    const res = await request(app).post(`/api/admin/bookings/999999/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: FAIL — маршрутов нет.

- [ ] **Step 3: Реализовать PATCH/confirm/cancel**

В `backend/src/routes/admin.ts` добавить:

```ts
async function setStatus(id: number, status: 'confirmed' | 'cancelled', res: Response) {
  const [updated] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
  res.json({ success: true, booking: updated });
}

adminRouter.post('/bookings/:id/confirm', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
  await setStatus(id, 'confirmed', res);
});

adminRouter.post('/bookings/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
  await setStatus(id, 'cancelled', res);
});

adminRouter.patch('/bookings/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
  const parsed = updateBookingSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
  const data = parsed.data;

  const [current] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!current) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');

  const checkInDate = data.checkInDate ?? current.checkInDate;
  const checkOutDate = data.checkOutDate ?? current.checkOutDate;
  if (checkOutDate <= checkInDate) throw new ApiError(400, 'VALIDATION_ERROR', 'checkOutDate must be after checkInDate');
  const nights = Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86_400_000);

  const patch: Partial<typeof bookings.$inferInsert> = {
    checkInDate, checkOutDate, nights,
  };
  if (data.guestName !== undefined) patch.guestName = data.guestName;
  if (data.phone !== undefined) patch.phone = data.phone;
  if (data.email !== undefined) patch.email = data.email;
  if (data.guests !== undefined) patch.guests = data.guests;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.managerComment !== undefined) patch.managerComment = data.managerComment;
  if (data.status !== undefined) patch.status = data.status;
  if (data.totalPrice !== undefined) patch.totalPrice = data.totalPrice; // сумма не пересчитывается сама

  const [updated] = await db.update(bookings).set(patch).where(eq(bookings.id, id)).returning();
  res.json({ success: true, booking: updated });
});
```

Примечание: убедиться, что `Response` импортирован из express (он уже в списке импортов Task 3).

- [ ] **Step 4: Запустить — проходит**

Run: `cd backend && npx vitest run src/routes/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/admin.ts backend/src/routes/admin.test.ts
git commit -m "feat(admin): edit, confirm and cancel booking endpoints"
```

---

### Task 7: Монтирование роутера и закрытие публичных дыр

**Files:**
- Modify: `backend/src/server.ts`
- Modify: `backend/src/routes/bookings.ts`
- Modify: `backend/src/routes/bookings.test.ts`

- [ ] **Step 1: Смонтировать adminRouter**

В `backend/src/server.ts` добавить импорт и монтирование (после других роутов, до `notFoundHandler`):

```ts
import { adminRouter } from './routes/admin';
// ...
app.use('/api/admin', adminRouter);
```

- [ ] **Step 2: Проставлять source='site' в публичном создании**

В `backend/src/routes/bookings.ts`, в объекте `tx.insert(bookings).values({...})`, добавить поле:

```ts
      source: 'site',
```

- [ ] **Step 3: Удалить публичные `GET /:id` и `cancel`**

В `backend/src/routes/bookings.ts` удалить целиком обработчики `bookingsRouter.get('/:id', ...)` и `bookingsRouter.post('/:id/cancel', ...)` (строки этих двух маршрутов). Оставить только `POST '/'`.

- [ ] **Step 4: Убрать устаревшие тесты, если они дергали удалённые маршруты**

Проверить `backend/src/routes/bookings.test.ts` — тесты в нём покрывают только `POST /api/bookings`, удалённых маршрутов не касаются. Изменений не требуется.

- [ ] **Step 5: Прогнать весь бэкенд-набор тестов**

Run: `cd backend && npm test`
Expected: PASS — все файлы (`adminAuth`, `admin`, `bookings`, `availability`, `pricing`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/server.ts backend/src/routes/bookings.ts
git commit -m "feat(admin): mount admin router, remove public cancel and GET booking"
```

---

### Task 8: Пример переменных окружения

**Files:**
- Create: `backend/.env.example`

- [ ] **Step 1: Создать файл**

Создать `backend/.env.example`:

```
# Порт API (по умолчанию 3001)
PORT=3001
# Пароль входа в админку
ADMIN_PASSWORD=change-me
# Секрет для подписи админ-токена (длинная случайная строка)
ADMIN_TOKEN_SECRET=change-me-to-a-long-random-string
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs(admin): add backend .env.example"
```

---

## Phase B — Фронтенд

### Task 9: API-клиент админки `adminApi.ts`

**Files:**
- Create: `src/lib/adminApi.ts`
- Test: `src/lib/adminApi.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/adminApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminLogin, getAdminBookings, TOKEN_KEY } from './adminApi';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('adminApi', () => {
  it('stores token on successful login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, token: 'abc' }), { status: 200 }),
    );
    const res = await adminLogin('pw');
    expect(res.success).toBe(true);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc');
  });

  it('sends Authorization header from stored token', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, bookings: [] }), { status: 200 }),
    );
    await getAdminBookings({});
    const headers = (fetchMock.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok123');
  });

  it('clears token on 401', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'x', code: 'UNAUTHORIZED' }), { status: 401 }),
    );
    const res = await getAdminBookings({});
    expect(res.success).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/lib/adminApi.test.ts`
Expected: FAIL — модуль `./adminApi` не найден.

- [ ] **Step 3: Реализовать клиент**

Создать `src/lib/adminApi.ts`:

```ts
import type { ApiResult } from './api';

const BASE = '/api/admin';
export const TOKEN_KEY = 'admin_token';

export interface AdminBooking {
  id: number;
  cottageId: number;
  cottageName: string;
  guestName: string;
  phone: string;
  email: string | null;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nights: number;
  subtotal: number;
  servicesTotal: number;
  totalPrice: number;
  status: 'new' | 'confirmed' | 'cancelled';
  source: 'site' | 'manual';
  notes: string | null;
  managerComment: string | null;
  createdAt: string;
}

export interface OccupancyItem {
  bookingId: number;
  cottageId: number;
  guestName: string;
  status: 'new' | 'confirmed';
  checkInDate: string;
  checkOutDate: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = getToken();
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) {
      clearToken();
      return { success: false, error: 'Требуется авторизация', code: 'UNAUTHORIZED' };
    }
    const body = await res.json();
    if (!res.ok || body.success === false) {
      return { success: false, error: body.error ?? `HTTP ${res.status}`, code: body.code };
    }
    return { success: true, data: body };
  } catch {
    return { success: false, error: 'Нет связи с сервером' };
  }
}

export async function adminLogin(password: string): Promise<ApiResult<{ token: string }>> {
  const res = await adminFetch<{ token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (res.success) localStorage.setItem(TOKEN_KEY, res.data.token);
  return res;
}

export interface ListParams {
  status?: 'new' | 'confirmed' | 'cancelled' | 'all';
  from?: string;
  to?: string;
  cottageId?: number;
}

export async function getAdminBookings(params: ListParams) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  return adminFetch<{ bookings: AdminBooking[] }>(`/bookings?${qs}`);
}

export async function getAdminCalendar(from: string, to: string) {
  const qs = new URLSearchParams({ from, to });
  return adminFetch<{ occupancy: OccupancyItem[] }>(`/calendar?${qs}`);
}

export interface ManualBookingInput {
  cottageId: number;
  guestName: string;
  phone: string;
  email?: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  notes?: string;
  managerComment?: string;
  priceOverride?: number;
}

export async function createAdminBooking(input: ManualBookingInput) {
  return adminFetch<{ booking: AdminBooking }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminBooking(id: number, patch: Partial<ManualBookingInput & { status: string; totalPrice: number }>) {
  return adminFetch<{ booking: AdminBooking }>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function confirmAdminBooking(id: number) {
  return adminFetch<{ booking: AdminBooking }>(`/bookings/${id}/confirm`, { method: 'POST' });
}

export async function cancelAdminBooking(id: number) {
  return adminFetch<{ booking: AdminBooking }>(`/bookings/${id}/cancel`, { method: 'POST' });
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run src/lib/adminApi.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminApi.ts src/lib/adminApi.test.ts
git commit -m "feat(admin): frontend admin API client"
```

---

### Task 10: Гвард `RequireAdmin`

**Files:**
- Create: `src/pages/admin/RequireAdmin.tsx`
- Test: `src/pages/admin/RequireAdmin.test.tsx`

- [ ] **Step 1: Написать падающий тест**

Создать `src/pages/admin/RequireAdmin.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAdmin } from './RequireAdmin';
import { TOKEN_KEY } from '@/lib/adminApi';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/admin" element={<RequireAdmin><div>DASHBOARD</div></RequireAdmin>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin', () => {
  beforeEach(() => localStorage.clear());

  it('redirects to login without a token', () => {
    renderAt('/admin');
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
  });

  it('renders children with a token', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    renderAt('/admin');
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/pages/admin/RequireAdmin.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать гвард**

Создать `src/pages/admin/RequireAdmin.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '@/lib/adminApi';

export function RequireAdmin({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run src/pages/admin/RequireAdmin.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/RequireAdmin.tsx src/pages/admin/RequireAdmin.test.tsx
git commit -m "feat(admin): RequireAdmin route guard"
```

---

### Task 11: Страница входа `AdminLogin`

**Files:**
- Create: `src/pages/admin/AdminLogin.tsx`

- [ ] **Step 1: Реализовать страницу**

Создать `src/pages/admin/AdminLogin.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { adminLogin } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await adminLogin(password);
    setLoading(false);
    if (res.success) {
      navigate('/admin', { replace: true });
    } else {
      toast.error(res.error || 'Не удалось войти');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#141414] p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="text-lg font-semibold text-white">Вход в админку</h1>
        <Input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading ? 'Вход…' : 'Войти'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку типов**

Run: `npx tsc -b --noEmit` (из корня)
Expected: без ошибок в новом файле.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminLogin.tsx
git commit -m "feat(admin): login page"
```

---

### Task 12: Список броней `BookingsList`

**Files:**
- Create: `src/pages/admin/BookingsList.tsx`

- [ ] **Step 1: Реализовать компонент**

Создать `src/pages/admin/BookingsList.tsx`:

```tsx
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AdminBooking } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type StatusFilter = 'all' | 'new' | 'confirmed' | 'cancelled';

const STATUS_LABEL: Record<AdminBooking['status'], string> = {
  new: 'Новая', confirmed: 'Подтверждена', cancelled: 'Отменена',
};
const STATUS_VARIANT: Record<AdminBooking['status'], 'default' | 'secondary' | 'destructive'> = {
  new: 'default', confirmed: 'secondary', cancelled: 'destructive',
};

function fmt(d: string) {
  return format(new Date(d), 'd MMM', { locale: ru });
}

export function BookingsList({
  bookings, filter, onFilterChange, onConfirm, onCancel, onEdit,
}: {
  bookings: AdminBooking[];
  filter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void;
  onConfirm: (b: AdminBooking) => void;
  onCancel: (b: AdminBooking) => void;
  onEdit: (b: AdminBooking) => void;
}) {
  return (
    <div className="space-y-3">
      <Tabs value={filter} onValueChange={(v) => onFilterChange(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="new">Новые</TabsTrigger>
          <TabsTrigger value="confirmed">Подтверждённые</TabsTrigger>
          <TabsTrigger value="cancelled">Отменённые</TabsTrigger>
        </TabsList>
      </Tabs>

      {bookings.length === 0 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">Броней нет</p>
      ) : (
        <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
              <button className="font-medium hover:underline" onClick={() => onEdit(b)}>{b.guestName}</button>
              <span className="text-neutral-400">{b.cottageName}</span>
              <span className="text-neutral-400">{fmt(b.checkInDate)} – {fmt(b.checkOutDate)}</span>
              {b.source === 'manual' && <span className="text-xs text-neutral-500">(вручную)</span>}
              <span className="ml-auto font-medium">{b.totalPrice.toLocaleString('ru')} ₽</span>
              <div className="flex gap-1">
                {b.status === 'new' && (
                  <Button size="sm" variant="outline" onClick={() => onConfirm(b)}>Подтвердить</Button>
                )}
                {b.status !== 'cancelled' && (
                  <Button size="sm" variant="ghost" onClick={() => onCancel(b)}>Отменить</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onEdit(b)}>Ред.</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { StatusFilter };
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/BookingsList.tsx
git commit -m "feat(admin): bookings list with status filter and actions"
```

---

### Task 13: Календарь занятости `OccupancyCalendar`

**Files:**
- Create: `src/pages/admin/OccupancyCalendar.tsx`

- [ ] **Step 1: Реализовать компонент**

Создать `src/pages/admin/OccupancyCalendar.tsx`. Показывает N дней от `startDate`; строки — домики из пропа `cottages`; занятые дни закрашены; клик по свободной клетке зовёт `onCellClick(cottageId, dateISO)`.

```tsx
import { addDays, format, parseISO, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { OccupancyItem } from '@/lib/adminApi';

interface CottageRef { id: number; name: string; }

const DAYS = 30;

function isOccupied(occ: OccupancyItem[], cottageId: number, day: Date): OccupancyItem | undefined {
  return occ.find((o) => {
    if (o.cottageId !== cottageId) return false;
    // День выезда свободен: интервал [checkIn, checkOut)
    return isWithinInterval(day, { start: parseISO(o.checkInDate), end: addDays(parseISO(o.checkOutDate), -1) });
  });
}

export function OccupancyCalendar({
  cottages, occupancy, startDate, onCellClick,
}: {
  cottages: CottageRef[];
  occupancy: OccupancyItem[];
  startDate: Date;
  onCellClick: (cottageId: number, dateISO: string) => void;
}) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(startDate, i));

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="min-w-max text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-neutral-900 p-2 text-left">Домик</th>
            {days.map((d) => (
              <th key={d.toISOString()} className="p-1 text-neutral-500 font-normal w-7 text-center">
                {format(d, 'd', { locale: ru })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cottages.map((c) => (
            <tr key={c.id} className="border-t border-neutral-800">
              <td className="sticky left-0 bg-neutral-900 p-2 font-medium whitespace-nowrap">{c.name}</td>
              {days.map((d) => {
                const occ = isOccupied(occupancy, c.id, d);
                const dateISO = format(d, 'yyyy-MM-dd');
                return (
                  <td key={dateISO} className="p-0.5">
                    <button
                      title={occ ? occ.guestName : 'Свободно — создать бронь'}
                      onClick={() => !occ && onCellClick(c.id, dateISO)}
                      className={
                        'h-6 w-6 rounded ' +
                        (occ
                          ? occ.status === 'confirmed' ? 'bg-emerald-600' : 'bg-amber-500'
                          : 'bg-neutral-800 hover:bg-neutral-700')
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { CottageRef };
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/OccupancyCalendar.tsx
git commit -m "feat(admin): occupancy calendar grid"
```

---

### Task 14: Форма создания/редактирования `BookingFormDialog`

**Files:**
- Create: `src/pages/admin/BookingFormDialog.tsx`

- [ ] **Step 1: Реализовать компонент**

Создать `src/pages/admin/BookingFormDialog.tsx`. Диалог с полями; при создании считает подсказку цены = `basePrice * nights` (простая оценка), поле цены редактируемо. Даты вводятся двумя `date`-инпутами (нативными) для простоты и надёжности.

```tsx
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  createAdminBooking, updateAdminBooking, type AdminBooking,
} from '@/lib/adminApi';
import type { CottageRef } from './OccupancyCalendar';

export interface FormPreset {
  cottageId?: number;
  checkInDate?: string;
  booking?: AdminBooking; // если задано — режим редактирования
}

interface Cottage extends CottageRef { basePrice: number; }

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export function BookingFormDialog({
  open, onOpenChange, cottages, preset, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cottages: Cottage[];
  preset: FormPreset;
  onSaved: () => void;
}) {
  const editing = preset.booking;
  const [cottageId, setCottageId] = useState<number>(cottages[0]?.id ?? 0);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState('');
  const [managerComment, setManagerComment] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Инициализация при открытии
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCottageId(editing.cottageId);
      setGuestName(editing.guestName);
      setPhone(editing.phone);
      setEmail(editing.email ?? '');
      setCheckInDate(editing.checkInDate);
      setCheckOutDate(editing.checkOutDate);
      setGuests(editing.guests);
      setNotes(editing.notes ?? '');
      setManagerComment(editing.managerComment ?? '');
      setPrice(editing.totalPrice);
      setPriceTouched(true);
    } else {
      setCottageId(preset.cottageId ?? cottages[0]?.id ?? 0);
      setGuestName(''); setPhone(''); setEmail('');
      setCheckInDate(preset.checkInDate ?? '');
      setCheckOutDate('');
      setGuests(2); setNotes(''); setManagerComment('');
      setPrice(0); setPriceTouched(false);
    }
  }, [open, editing, preset, cottages]);

  const nights = nightsBetween(checkInDate, checkOutDate);
  const basePrice = useMemo(
    () => cottages.find((c) => c.id === cottageId)?.basePrice ?? 0,
    [cottages, cottageId],
  );

  // Автоподсказка цены, пока пользователь не тронул поле вручную
  useEffect(() => {
    if (!priceTouched) setPrice(basePrice * nights);
  }, [basePrice, nights, priceTouched]);

  async function onSubmit() {
    if (!guestName || !phone || !checkInDate || !checkOutDate) {
      toast.error('Заполни имя, телефон и даты');
      return;
    }
    if (checkOutDate <= checkInDate) {
      toast.error('Дата выезда должна быть позже заезда');
      return;
    }
    setSaving(true);
    const res = editing
      ? await updateAdminBooking(editing.id, {
          guestName, phone, email: email || undefined, checkInDate, checkOutDate,
          guests, notes: notes || undefined, managerComment: managerComment || undefined,
          totalPrice: price,
        })
      : await createAdminBooking({
          cottageId, guestName, phone, email: email || undefined,
          checkInDate, checkOutDate, guests,
          notes: notes || undefined, managerComment: managerComment || undefined,
          priceOverride: price,
        });
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Бронь обновлена' : 'Бронь создана');
      onOpenChange(false);
      onSaved();
    } else {
      toast.error(res.error || 'Ошибка сохранения');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать бронь' : 'Новая бронь'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!editing && (
            <Select value={String(cottageId)} onValueChange={(v) => setCottageId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Домик" /></SelectTrigger>
              <SelectContent>
                {cottages.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Имя гостя" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email (необязательно)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-neutral-400">Заезд
              <Input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            </label>
            <label className="flex-1 text-xs text-neutral-400">Выезд
              <Input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-neutral-400">Гостей
              <Input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
            </label>
            <label className="flex-1 text-xs text-neutral-400">Сумма, ₽ ({nights} ноч.)
              <Input
                type="number" min={0} value={price}
                onChange={(e) => { setPriceTouched(true); setPrice(Number(e.target.value)); }}
              />
            </label>
          </div>
          <Textarea placeholder="Заметки" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Textarea placeholder="Комментарий менеджера" value={managerComment} onChange={(e) => setManagerComment(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { Cottage as FormCottage };
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/BookingFormDialog.tsx
git commit -m "feat(admin): create/edit booking dialog"
```

---

### Task 15: Дашборд и маршруты

**Files:**
- Create: `src/pages/admin/AdminDashboard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Реализовать дашборд**

Создать `src/pages/admin/AdminDashboard.tsx`. Грузит домики (через публичный `getCottages`), брони и занятость; связывает список, календарь и диалог.

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getCottages, type Cottage } from '@/lib/api';
import {
  getAdminBookings, getAdminCalendar, confirmAdminBooking, cancelAdminBooking,
  type AdminBooking, type OccupancyItem, TOKEN_KEY,
} from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { BookingsList, type StatusFilter } from './BookingsList';
import { OccupancyCalendar } from './OccupancyCalendar';
import { BookingFormDialog, type FormPreset, type FormCottage } from './BookingFormDialog';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [cottages, setCottages] = useState<Cottage[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState<FormPreset>({});

  const today = useMemo(() => new Date(), []);
  const from = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const to = useMemo(() => new Date(today.getTime() + 60 * 86_400_000).toISOString().slice(0, 10), [today]);

  const load = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([
      getAdminBookings({ status: filter }),
      getAdminCalendar(from, to),
    ]);
    if (bRes.success) setBookings(bRes.data.bookings);
    if (cRes.success) setOccupancy(cRes.data.occupancy);
    if (!bRes.success && bRes.code === 'UNAUTHORIZED') navigate('/admin/login', { replace: true });
  }, [filter, from, to, navigate]);

  useEffect(() => {
    getCottages().then((r) => { if (r.success) setCottages(r.data.cottages); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const formCottages: FormCottage[] = cottages.map((c) => ({ id: c.id, name: c.name, basePrice: c.basePrice }));

  function openCreate(cottageId?: number, checkInDate?: string) {
    setPreset({ cottageId, checkInDate });
    setDialogOpen(true);
  }
  function openEdit(b: AdminBooking) {
    setPreset({ booking: b });
    setDialogOpen(true);
  }
  async function onConfirm(b: AdminBooking) {
    const res = await confirmAdminBooking(b.id);
    if (res.success) { toast.success('Подтверждено'); load(); } else toast.error(res.error);
  }
  async function onCancel(b: AdminBooking) {
    const res = await cancelAdminBooking(b.id);
    if (res.success) { toast.success('Отменено'); load(); } else toast.error(res.error);
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <header className="flex items-center justify-between border-b border-neutral-800 p-4">
        <h1 className="text-lg font-semibold">Брони — админка</h1>
        <div className="flex gap-2">
          <Button onClick={() => openCreate()}>+ Бронь</Button>
          <Button variant="ghost" onClick={logout}>Выйти</Button>
        </div>
      </header>

      <main className="space-y-8 p-4">
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">Занятость (60 дней)</h2>
          <OccupancyCalendar
            cottages={formCottages}
            occupancy={occupancy}
            startDate={today}
            onCellClick={openCreate}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">Заявки</h2>
          <BookingsList
            bookings={bookings}
            filter={filter}
            onFilterChange={setFilter}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onEdit={openEdit}
          />
        </section>
      </main>

      <BookingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cottages={formCottages}
        preset={preset}
        onSaved={load}
      />
    </div>
  );
}
```

- [ ] **Step 2: Подключить маршруты в App.tsx**

В `src/App.tsx` добавить импорты и маршруты внутри `<Routes>`:

```tsx
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { RequireAdmin } from '@/pages/admin/RequireAdmin';
```

И два маршрута (рядом с существующими, вне обёртки лендинга):

```tsx
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
```

- [ ] **Step 3: Проверить типы и сборку**

Run: `npm run build`
Expected: `tsc -b` без ошибок, сборка успешна.

- [ ] **Step 4: Ручная проверка в браузере**

Запустить `npm run backend:dev` и `npm run dev`. Открыть `http://localhost:5173/admin` → редирект на `/admin/login`. Ввести пароль из `.env` → попасть на дашборд. Проверить: список заявок, вкладки-фильтры, подтверждение «новой» брони, клик по свободной клетке календаря открывает форму с подставленными домиком/датой, создание ручной брони (в т.ч. на 1 ночь и поверх занятой даты), редактирование, отмена.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminDashboard.tsx src/App.tsx
git commit -m "feat(admin): dashboard wiring and routes"
```

---

## Phase C — Документация

### Task 16: Обновить CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Дописать раздел**

В `CLAUDE.md` добавить в раздел «Бэкенд» описание эндпоинтов `/api/admin` и переменных `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`; в раздел архитектуры фронта — маршруты `/admin`, `/admin/login` и папку `src/pages/admin/`; отметить колонку `bookings.source` и что публичные `GET /api/bookings/:id` и `POST /api/bookings/:id/cancel` удалены (отмена — только через админку).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document admin panel in CLAUDE.md"
```

---

## Итоговая проверка

- [ ] `cd backend && npm test` — все бэкенд-тесты зелёные.
- [ ] `npm run test` (корень) — фронтенд-тесты зелёные.
- [ ] `npm run build` — типы и сборка без ошибок.
- [ ] Ручной прогон сценариев из Task 15 Step 4.
