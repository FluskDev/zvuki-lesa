# Admin Cottages CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить возможность создавать и удалять домики через админ-панель `/admin/cottages`: backend `POST/DELETE /api/admin/cottages` + UI-кнопки «Создать» и «Удалить» + режим создания в редакторе.

**Architecture:** Два новых обработчика в существующем `cottagesAdminRouter` (за `requireAdmin`). Создание — единый `POST` со всеми обязательными полями (включая `slug` и `mapId`); удаление проверяет наличие броней и при их наличии возвращает 409. На фронте — кнопки в `CottagesList` по паттерну `BlogList`, режим create в `CottageEditor` через ветку `useParams().id === undefined`, авто-транслитерация slug из имени.

**Tech Stack:** Backend — Express, Drizzle (postgres-js), zod, vitest + supertest. Frontend — React 19, React Router 6, sonner, lucide-react, существующие shadcn/ui компоненты. Без новых npm-зависимостей.

**Spec:** `docs/superpowers/specs/2026-07-16-admin-cottages-crud-design.md`

---

## File Map

| Файл | Роль |
|---|---|
| `backend/src/routes/cottages.ts` (modify) | + zod `cottageCreateSchema`, + `POST /cottages` handler, + `DELETE /cottages/:id` handler |
| `backend/src/routes/cottages-admin.test.ts` (new) | vitest-тесты create/delete с bookings + cascade |
| `src/lib/translit.ts` (new) | Утилита `transliterate(ru) -> slug` |
| `src/lib/translit.test.ts` (new) | vitest-тесты транслитерации |
| `src/lib/adminApi.ts` (modify) | + `createAdminCottage`, + `deleteAdminCottage` |
| `src/pages/admin/CottagesList.tsx` (modify) | + кнопка «Создать» в AdminNav, + кнопка «Удалить» с `useConfirm`, + баннер HAS_BOOKINGS |
| `src/pages/admin/CottageEditor.tsx` (modify) | + ветка create при отсутствии `:id`, + поля `slug`/`mapId`/`mainImage` в форме, + state `slugTouched`, + разветвление `save()` |

Никаких новых таблиц БД, никаких миграций — всё через существующую `cottages` и её каскады.

---

## Task 1: Backend POST /cottages — zod schema + handler + tests (TDD)

**Files:**
- Modify: `backend/src/routes/cottages.ts`
- Create: `backend/src/routes/cottages-admin.test.ts`

- [ ] **Step 1: Написать фейлящие тесты для create endpoint**

Создать файл `backend/src/routes/cottages-admin.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { cottages, bookings, cottageImages, cottageAmenities, recreationItems, priceRules } from '../db/schema';
import { resetDb } from '../db/test-utils';
import { cottagesAdminRouter } from './cottages';
import { adminRouter } from './admin';
import { errorHandler } from '../lib/errors';

process.env.ADMIN_PASSWORD = 'secret123';
process.env.ADMIN_TOKEN_SECRET = 'test-secret';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use('/api/admin', cottagesAdminRouter);
app.use(errorHandler);

async function login(): Promise<string> {
  const res = await request(app).post('/api/admin/login').send({ password: 'secret123' });
  return res.body.token as string;
}

beforeEach(async () => {
  await resetDb(db);
});

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'new-cottage',
    mapId: 'Домик4',
    name: 'Новый уютный домик',
    shortDescription: 'Краткое описание нового домика для превью в каталоге',
    longDescription: 'Длинное описание нового домика, рассказывающее об особенностях и преимуществах.',
    description: null,
    houseRules: null,
    basePrice: 5000,
    area: 50,
    guests: 4,
    bedrooms: 2,
    bedsDouble: 1,
    bedsSingle: 2,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    mainImage: '/images/new-cottage-main.jpg',
    isActive: true,
    ...overrides,
  };
}

describe('POST /api/admin/cottages', () => {
  it('requires admin auth', async () => {
    const res = await request(app).post('/api/admin/cottages').send(validPayload());
    expect(res.status).toBe(401);
  });

  it('creates a cottage with valid payload', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cottage.slug).toBe('new-cottage');
    expect(res.body.cottage.name).toBe('Новый уютный домик');
    expect(res.body.cottage.basePrice).toBe(5000);

    const [row] = await db.select().from(cottages).where(eq(cottages.slug, 'new-cottage'));
    expect(row).toBeDefined();
    expect(row!.mapId).toBe('Домик4');
  });

  it('rejects invalid slug (uppercase letters) with 400', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ slug: 'Bad-Slug' }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid slug (special characters) with 400', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ slug: 'bad slug!' }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects negative basePrice with 400', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ basePrice: -100 }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects zero guests with 400', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ guests: 0 }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing mainImage with 400', async () => {
    const token = await login();
    const payload = validPayload();
    delete (payload as Record<string, unknown>).mainImage;
    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 CONFLICT for duplicate slug', async () => {
    const token = await login();
    await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect(res.body.error).toContain('Slug already exists');
  });

  it('creates cottage and links amenityIds in a transaction', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ slug: 'with-amenities', amenityIds: [1, 2, 3] }));

    expect(res.status).toBe(200);
    const links = await db.select().from(cottageAmenities);
    expect(links).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться что падают**

Run: `cd backend && npx vitest run src/routes/cottages-admin.test.ts`
Expected: FAIL — module `cottages-admin.test.ts` exists but tests fail because route handler not implemented. Если файл не найден — это тоже валидный «fail» (vitest сообщит об отсутствии файла / об отсутствии `POST` handler, который вернёт 404).

- [ ] **Step 3: Реализовать zod schema и handler**

В `backend/src/routes/cottages.ts`:

1) Добавить импорт `bookings` из schema (рядом с уже импортируемыми `cottageImages, amenities, cottageAmenities, recreationItems`):

```ts
import {
  cottages, cottageImages, amenities, cottageAmenities, recreationItems, bookings,
} from '../db/schema';
```

2) После существующего `cottagePatchSchema` добавить `cottageCreateSchema`:

```ts
const slugRegex = /^[a-z0-9-]+$/;

const cottageCreateSchema = z.object({
  slug: z.string().min(1).max(80).regex(slugRegex),
  mapId: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  shortDescription: z.string().min(1).max(300),
  longDescription: z.string().min(1).max(2000),
  description: z.string().max(8000).optional().nullable(),
  houseRules: z.string().max(8000).optional().nullable(),
  basePrice: z.number().int().nonnegative(),
  area: z.number().int().positive(),
  guests: z.number().int().positive(),
  bedrooms: z.number().int().nonnegative(),
  bedsDouble: z.number().int().nonnegative().default(0),
  bedsSingle: z.number().int().nonnegative().default(0),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/),
  mainImage: z.string().min(1).max(500),
  isActive: z.boolean().default(true),
  amenityIds: z.array(z.number().int().positive()).optional(),
});
```

3) В `cottagesAdminRouter` (после `cottagesAdminRouter.patch(...)` handler, перед image-routes) добавить POST handler:

```ts
cottagesAdminRouter.post('/cottages', async (req, res) => {
  const parsed = cottageCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
  }
  const { amenityIds, ...data } = parsed.data;

  let created;
  try {
    [created] = await db.insert(cottages).values(data).returning();
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === '23505') {
      throw new ApiError(409, 'CONFLICT', 'Slug already exists');
    }
    throw e;
  }

  if (amenityIds && amenityIds.length > 0) {
    await db.insert(cottageAmenities).values(
      amenityIds.map((amenityId) => ({ cottageId: created.id, amenityId })),
    );
  }

  const [cottage] = await db.select().from(cottages).where(eq(cottages.id, created.id)).limit(1);
  res.json({ success: true, cottage: await loadCottage(cottage) });
});
```

- [ ] **Step 4: Прогнать тесты — убедиться что зелёные**

Run: `cd backend && npx vitest run src/routes/cottages-admin.test.ts`
Expected: 9/9 PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && npx tsc --noEmit -p . 2>&1 | head -20   # quick type check
git add backend/src/routes/cottages.ts backend/src/routes/cottages-admin.test.ts
git commit -m "feat(backend): POST /api/admin/cottages with zod validation"
```

---

## Task 2: Backend DELETE /cottages/:id — handler + tests (TDD)

**Files:**
- Modify: `backend/src/routes/cottages.ts`
- Modify: `backend/src/routes/cottages-admin.test.ts`

- [ ] **Step 1: Добавить фейлящие тесты для delete**

В конец `backend/src/routes/cottages-admin.test.ts` добавить блок:

```ts
describe('DELETE /api/admin/cottages/:id', () => {
  it('requires admin auth', async () => {
    await db.insert(cottages).values(validPayload() as typeof cottages.$inferInsert);
    const res = await request(app).delete('/api/admin/cottages/1');
    expect(res.status).toBe(401);
  });

  it('deletes cottage without bookings (cascade to images/amenities/rules)', async () => {
    const token = await login();
    await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ slug: 'to-delete' }));

    await db.insert(cottageImages).values({ cottageId: 1, url: '/x.jpg', section: 'main', position: 0 });
    await db.insert(cottageAmenities).values({ cottageId: 1, amenityId: 1 });
    await db.insert(recreationItems).values({ cottageId: 1, title: 't', description: 'd', photo: '/p.jpg', position: 0 });
    await db.insert(priceRules).values({
      cottageId: 1, name: 'rule', startDate: '2026-01-01', endDate: '2026-12-31',
      modifierType: 'percent', modifierValue: 10, priority: 0,
    });

    const res = await request(app)
      .delete('/api/admin/cottages/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const remaining = await db.select().from(cottages);
    expect(remaining).toHaveLength(0);
    const imgs = await db.select().from(cottageImages);
    expect(imgs).toHaveLength(0);
    const amen = await db.select().from(cottageAmenities);
    expect(amen).toHaveLength(0);
    const rec = await db.select().from(recreationItems);
    expect(rec).toHaveLength(0);
    const rules = await db.select().from(priceRules);
    expect(rules).toHaveLength(0);
  });

  it('returns 409 CONFLICT when cottage has bookings', async () => {
    const token = await login();
    await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ slug: 'with-bookings' }));

    await db.insert(bookings).values({
      cottageId: 1,
      guestName: 'Иван Иванов',
      phone: '+79001234567',
      checkInDate: '2026-08-01',
      checkOutDate: '2026-08-03',
      guests: 2,
      nights: 2,
      subtotal: 10000,
      servicesTotal: 0,
      totalPrice: 10000,
      status: 'new',
      source: 'site',
    });

    const res = await request(app)
      .delete('/api/admin/cottages/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect(res.body.error).toContain('бронирован');

    const remaining = await db.select().from(cottages);
    expect(remaining).toHaveLength(1);
    const remainingBookings = await db.select().from(bookings);
    expect(remainingBookings).toHaveLength(1);
  });

  it('blocks delete even for cancelled bookings', async () => {
    const token = await login();
    await request(app)
      .post('/api/admin/cottages')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ slug: 'with-cancelled' }));

    await db.insert(bookings).values({
      cottageId: 1,
      guestName: 'Пётр',
      phone: '+79009999999',
      checkInDate: '2026-09-01',
      checkOutDate: '2026-09-02',
      guests: 1,
      nights: 1,
      subtotal: 5000,
      servicesTotal: 0,
      totalPrice: 5000,
      status: 'cancelled',
      source: 'site',
    });

    const res = await request(app)
      .delete('/api/admin/cottages/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('returns 200 (no-op) for non-existent id', async () => {
    const token = await login();
    const res = await request(app)
      .delete('/api/admin/cottages/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться что падают**

Run: `cd backend && npx vitest run src/routes/cottages-admin.test.ts`
Expected: 4 новых теста FAIL (handler не существует).

- [ ] **Step 3: Реализовать DELETE handler**

В `backend/src/routes/cottages.ts`, после POST handler (но до image-routes) добавить:

```ts
cottagesAdminRouter.delete('/cottages/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
  }

  const [existing] = await db.select().from(cottages).where(eq(cottages.id, id)).limit(1);
  if (!existing) {
    res.json({ success: true });
    return;
  }

  const hasBookings = (await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.cottageId, id))
    .limit(1)).length > 0;

  if (hasBookings) {
    throw new ApiError(409, 'CONFLICT',
      'Невозможно удалить: у домика есть бронирования. Скройте его через isActive=false.');
  }

  await db.delete(cottages).where(eq(cottages.id, id));
  res.json({ success: true });
});
```

- [ ] **Step 4: Прогнать все тесты — убедиться что зелёные**

Run: `cd backend && npx vitest run src/routes/cottages-admin.test.ts`
Expected: 13/13 PASS.

- [ ] **Step 5: Прогнать весь backend test suite — убедиться что ничего не сломал**

Run: `cd backend && npx vitest run`
Expected: все ранее зелёные тесты по-прежнему PASS, плюс 13 новых.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/cottages.ts backend/src/routes/cottages-admin.test.ts
git commit -m "feat(backend): DELETE /api/admin/cottages/:id with bookings guard"
```

---

## Task 3: Frontend translit utility (TDD)

**Files:**
- Create: `src/lib/translit.ts`
- Create: `src/lib/translit.test.ts`

- [ ] **Step 1: Написать фейлящие тесты для transliterate**

Создать `src/lib/translit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { transliterate } from './translit';

describe('transliterate', () => {
  it('converts simple Russian to Latin', () => {
    expect(transliterate('Шале Уют')).toBe('shale-uyut');
  });

  it('handles ё and й', () => {
    expect(transliterate('Ёлки-Палки')).toBe('yolki-palki');
  });

  it('handles ь and ъ', () => {
    expect(transliterate('Подъезд')).toBe('podyezd');
  });

  it('replaces spaces and punctuation with hyphens', () => {
    expect(transliterate('Дом у реки №3!')).toBe('dom-u-reki-3');
  });

  it('collapses multiple hyphens', () => {
    expect(transliterate('А   Б   В')).toBe('a-b-v');
  });

  it('strips leading/trailing hyphens', () => {
    expect(transliterate('---тест---')).toBe('test');
  });

  it('preserves already-Latin characters and digits', () => {
    expect(transliterate('Cottage 42')).toBe('cottage-42');
  });

  it('returns empty string for empty input', () => {
    expect(transliterate('')).toBe('');
  });

  it('truncates to 80 characters', () => {
    const long = 'а'.repeat(200);
    expect(transliterate(long).length).toBeLessThanOrEqual(80);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться что падают**

Run: `npx vitest run src/lib/translit.test.ts`
Expected: FAIL — module `./translit` не существует.

- [ ] **Step 3: Реализовать transliterate**

Создать `src/lib/translit.ts`:

```ts
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Транслитерирует русский текст в URL-slug.
 * - Латиница и цифры сохраняются.
 * - Не-буквенно-цифровые символы → '-'.
 * - Повторяющиеся '-' схлопываются, крайние обрезаются.
 * - Длина ограничена 80 символами.
 */
export function transliterate(input: string): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (MAP[ch] !== undefined) {
      out += MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += '-';
    }
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return out.slice(0, 80);
}
```

- [ ] **Step 4: Прогнать тесты — убедиться что зелёные**

Run: `npx vitest run src/lib/translit.test.ts`
Expected: 9/9 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/translit.ts src/lib/translit.test.ts
git commit -m "feat(lib): add RU→slug transliterate utility"
```

---

## Task 4: Frontend adminApi helpers

**Files:**
- Modify: `src/lib/adminApi.ts`

- [ ] **Step 1: Добавить createAdminCottage и deleteAdminCottage**

В `src/lib/adminApi.ts`, после блока `// ---------- Домики ----------` и ПЕРЕД `export async function getAdminCottage` добавить:

```ts
export interface CreateCottageInput {
  slug: string;
  mapId: string;
  name: string;
  mainImage: string;
  shortDescription: string;
  longDescription: string;
  description?: string | null;
  houseRules?: string | null;
  basePrice: number;
  area: number;
  guests: number;
  bedrooms: number;
  bedsDouble: number;
  bedsSingle: number;
  checkInTime: string;
  checkOutTime: string;
  isActive: boolean;
  amenityIds?: number[];
}

export async function createAdminCottage(input: CreateCottageInput) {
  return adminFetch<{ cottage: AdminCottage }>('/cottages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminCottage(id: number) {
  return adminFetch<{ success: true }>(`/cottages/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc -b 2>&1 | head -30`
Expected: 0 ошибок (или только pre-existing unrelated).

- [ ] **Step 3: Commit**

```bash
git add src/lib/adminApi.ts
git commit -m "feat(admin): createAdminCottage + deleteAdminCottage helpers"
```

---

## Task 5: Frontend CottagesList — Create + Delete buttons

**Files:**
- Modify: `src/pages/admin/CottagesList.tsx`

- [ ] **Step 1: Добавить state и импорты**

В начало файла (после импорта `useEffect, useState`) добавить:

```ts
import { Plus, Pencil, Trash2, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { AdminNav } from './AdminNav';
import { TableRowSkeleton } from './AdminUI';
import { useConfirm } from './ConfirmDialog';
```

Заменить текущий импорт `import { Pencil, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';` на новый (выше).

- [ ] **Step 2: Добавить state и логику delete**

После `const [error, setError] = useState<string | null>(null);` добавить:

```ts
const { ask, dialog } = useConfirm();
const [infoBanner, setInfoBanner] = useState<string | null>(null);

const remove = (id: number, name: string) => {
  ask({
    title: `Удалить домик «${name}»?`,
    description: 'Все фото, удобства и ценовые правила этого домика также будут удалены. Это действие нельзя отменить.',
    destructive: true,
    confirmLabel: 'Удалить',
    onConfirm: async () => {
      const r = await adminApi.delete(`/cottages/${id}`);
      if (r.success) {
        toast.success('Удалено');
        load();
      } else if (r.code === 'CONFLICT' && r.error.includes('бронирован')) {
        toast.error('Нельзя удалить: у домика есть бронирования');
        setInfoBanner(`У домика «${name}» есть бронирования. Скройте его через редактирование → Активен.`);
        setTimeout(() => setInfoBanner(null), 8000);
      } else {
        toast.error(r.error);
        setError(r.error);
      }
    },
  });
};
```

- [ ] **Step 3: Обновить шапку AdminNav для кнопки Создать**

Найти `<AdminNav />` (в текущем файле он используется без children) и заменить на:

```tsx
<AdminNav>
  <Button asChild size="sm">
    <Link to="/admin/cottages/new">
      <Plus className="h-4 w-4 sm:mr-1.5" />
      <span className="hidden sm:inline">Создать</span>
    </Link>
  </Button>
</AdminNav>
```

- [ ] **Step 4: Добавить баннер infoBanner**

Сразу после `<main className="p-4 sm:p-6 space-y-4">` и ПЕРЕД `<div>` с заголовком «Домики» добавить:

```tsx
{infoBanner && (
  <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200 flex items-start justify-between gap-3">
    <span>{infoBanner}</span>
    <button
      type="button"
      onClick={() => setInfoBanner(null)}
      className="text-amber-400 hover:text-amber-200 shrink-0"
      aria-label="Закрыть"
    >
      ×
    </button>
  </div>
)}
```

- [ ] **Step 5: Добавить иконку удаления в колонку Действия**

Внутри `<div className="flex justify-end gap-1">` ПОСЛЕ кнопки `Pencil` (после закрывающего `</Button>` карандаша) добавить:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-neutral-400 hover:text-red-400"
  onClick={() => remove(c.id, c.name)}
  aria-label="Удалить"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

- [ ] **Step 6: Добавить `{dialog}` в конец компонента**

Внутри корневого `<div className="dark min-h-screen bg-[#141414] text-white">`, после `</main>` добавить:

```tsx
{dialog}
```

- [ ] **Step 7: Проверить типы**

Run: `npx tsc -b 2>&1 | head -30`
Expected: 0 ошибок.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/CottagesList.tsx
git commit -m "feat(admin/cottages): add Create and Delete buttons"
```

---

## Task 6: Frontend CottageEditor — Create mode + slug/mapId/mainImage fields

**Files:**
- Modify: `src/pages/admin/CottageEditor.tsx`

Это самый крупный таск — форма расширяется тремя полями и двумя режимами работы.

- [ ] **Step 1: Расширить импорты**

В начало файла (после существующих импортов из `lucide-react`) добавить импорт `Loader2` уже есть. Добавить:

```ts
import { createAdminCottage } from '@/lib/adminApi';
import { transliterate } from '@/lib/translit';
```

- [ ] **Step 2: Расширить интерфейс CottageForm**

Заменить блок `interface CottageForm { ... }` на:

```ts
interface CottageForm {
  name: string;
  slug: string;
  mapId: string;
  mainImage: string;
  shortDescription: string;
  longDescription: string;
  description: string;
  houseRules: string;
  basePrice: number;
  area: number;
  guests: number;
  bedrooms: number;
  bedsDouble: number;
  bedsSingle: number;
  checkInTime: string;
  checkOutTime: string;
  isActive: boolean;
}
```

- [ ] **Step 3: Расширить emptyForm**

```ts
const emptyForm: CottageForm = {
  name: '',
  slug: '',
  mapId: '',
  mainImage: '',
  shortDescription: '',
  longDescription: '',
  description: '',
  houseRules: '',
  basePrice: 0,
  area: 0,
  guests: 0,
  bedrooms: 0,
  bedsDouble: 0,
  bedsSingle: 0,
  checkInTime: '15:00',
  checkOutTime: '12:00',
  isActive: true,
};
```

- [ ] **Step 4: Добавить state slugTouched + создание useMemo для авто-slug**

В теле компонента `CottageEditor` (после `const [selectedAmenityIds, setSelectedAmenityIds] = useState<Set<number>>(new Set());`) добавить:

```ts
const [slugTouched, setSlugTouched] = useState(false);
const autoSlug = useMemo(() => transliterate(form.name), [form.name]);
```

- [ ] **Step 5: Перестроить useEffect для обработки create-режима**

Заменить существующий `useEffect` (целиком от `useEffect(() => {` до `}, [id]);`) на:

```ts
useEffect(() => {
  let cancelled = false;
  async function load() {
    if (!id) {
      // Режим создания
      setCottage(null);
      setForm(emptyForm);
      setSelectedAmenityIds(new Set());
      setSlugTouched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [cottageRes, amenitiesRes] = await Promise.all([
      getAdminCottage(Number(id)),
      listAdminAmenities(),
    ]);
    if (cancelled) return;
    if (!cottageRes.success) {
      setError(cottageRes.error);
      setLoading(false);
      return;
    }
    const c = cottageRes.data.cottage;
    setCottage(c);
    setForm({
      name: c.name,
      slug: c.slug,
      mapId: c.mapId,
      mainImage: c.mainImage,
      shortDescription: c.shortDescription,
      longDescription: c.longDescription,
      description: c.description ?? '',
      houseRules: c.houseRules ?? '',
      basePrice: c.basePrice,
      area: c.area,
      guests: c.guests,
      bedrooms: c.bedrooms,
      bedsDouble: c.beds.double,
      bedsSingle: c.beds.single,
      checkInTime: c.checkInTime,
      checkOutTime: c.checkOutTime,
      isActive: c.isActive ?? true,
    });
    setSelectedAmenityIds(new Set(c.amenitiesFull.map((a) => a.id)));
    if (amenitiesRes.success) {
      setAllAmenities(amenitiesRes.data.amenities);
    }
    setLoading(false);
  }
  load();
  return () => {
    cancelled = true;
  };
}, [id]);
```

- [ ] **Step 6: Разветвить save() для create/update**

Заменить функцию `save` целиком на:

```ts
const save = async () => {
  if (!form.mainImage.trim()) {
    toast.error('Укажите URL главного фото');
    setError('Укажите URL главного фото');
    return;
  }
  if (saving) return;
  setSaving(true);
  setError(null);
  try {
    if (cottage) {
      // Существующая PATCH-логика
      const patch: Record<string, unknown> = {};
      if (dirty) {
        if (form.name !== cottage.name) patch.name = form.name;
        if (form.shortDescription !== cottage.shortDescription) patch.shortDescription = form.shortDescription;
        if (form.longDescription !== cottage.longDescription) patch.longDescription = form.longDescription;
        patch.description = form.description || null;
        patch.houseRules = form.houseRules || null;
        if (form.basePrice !== cottage.basePrice) patch.basePrice = form.basePrice;
        if (form.area !== cottage.area) patch.area = form.area;
        if (form.guests !== cottage.guests) patch.guests = form.guests;
        if (form.bedrooms !== cottage.bedrooms) patch.bedrooms = form.bedrooms;
        if (form.bedsDouble !== cottage.beds.double) patch.bedsDouble = form.bedsDouble;
        if (form.bedsSingle !== cottage.beds.single) patch.bedsSingle = form.bedsSingle;
        if (form.checkInTime !== cottage.checkInTime) patch.checkInTime = form.checkInTime;
        if (form.checkOutTime !== cottage.checkOutTime) patch.checkOutTime = form.checkOutTime;
        if (form.isActive !== (cottage.isActive ?? true)) patch.isActive = form.isActive;
      }
      if (amenitiesDirty) {
        patch.amenityIds = Array.from(selectedAmenityIds);
      }
      const r = await updateAdminCottage(cottage.id, patch);
      if (!r.success) {
        toast.error(r.error);
        setError(r.error);
        return;
      }
      setCottage(r.data.cottage);
      toast.success('Сохранено');
    } else {
      // Режим создания
      const finalSlug = (slugTouched ? form.slug : autoSlug).trim();
      if (!finalSlug) {
        toast.error('Slug пустой — укажите название или введите slug вручную');
        setError('Slug пустой');
        return;
      }
      if (!form.mapId.trim()) {
        toast.error('Укажите mapId (например, Домик4)');
        setError('mapId пустой');
        return;
      }
      const r = await createAdminCottage({
        slug: finalSlug,
        mapId: form.mapId.trim(),
        name: form.name,
        mainImage: form.mainImage.trim(),
        shortDescription: form.shortDescription,
        longDescription: form.longDescription,
        description: form.description || null,
        houseRules: form.houseRules || null,
        basePrice: form.basePrice,
        area: form.area,
        guests: form.guests,
        bedrooms: form.bedrooms,
        bedsDouble: form.bedsDouble,
        bedsSingle: form.bedsSingle,
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        isActive: form.isActive,
        amenityIds: Array.from(selectedAmenityIds),
      });
      if (!r.success) {
        toast.error(r.error);
        setError(r.error);
        return;
      }
      toast.success('Создано');
      nav(`/admin/cottages/${r.data.cottage.id}`, { replace: true });
    }
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 7: Заменить блок заголовка для create-режима**

Внутри `<main>...</main>` найти блок `<div className="flex items-center gap-3">` (содержит кнопку «Назад» и `<h2>` с `cottage.name`) и заменить на:

```tsx
<div className="flex items-center gap-3">
  <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
    <Link to="/admin/cottages" aria-label="Назад к списку">
      <ArrowLeft className="h-4 w-4" />
    </Link>
  </Button>
  <div>
    <h2 className="text-xl font-semibold tracking-tight">
      {cottage ? cottage.name : 'Новый домик'}
    </h2>
    {cottage ? (
      <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
        <code className="bg-neutral-900 px-1.5 py-0.5 rounded">{cottage.slug}</code>
        <span>·</span>
        <code className="bg-neutral-900 px-1.5 py-0.5 rounded">{cottage.mapId}</code>
        {hasChanges && <span className="text-amber-400">· не сохранено</span>}
      </div>
    ) : (
      <div className="text-xs text-neutral-500 mt-0.5">Заполните основные поля и сохраните</div>
    )}
  </div>
</div>
```

- [ ] **Step 8: Заменить текст кнопки сохранения для create-режима**

Найти `<Button onClick={save} ...>` внутри `<AdminNav>` и заменить на:

```tsx
<Button onClick={save} disabled={saving || (cottage ? !hasChanges : false)} size="sm">
  {saving ? (
    <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
  ) : (
    <Save className="h-4 w-4 sm:mr-1.5" />
  )}
  <span className="hidden sm:inline">
    {saving ? 'Сохранение...' : cottage ? 'Сохранить' : 'Создать'}
  </span>
</Button>
```

- [ ] **Step 9: Передать новые пропсы в DescriptionTab**

Найти `<DescriptionTab form={form} setForm={setForm} />` и заменить на:

```tsx
<DescriptionTab
  form={form}
  setForm={setForm}
  slugTouched={slugTouched}
  autoSlug={autoSlug}
  onSlugTouched={() => setSlugTouched(true)}
  onSlugChange={(slug) => setForm((prev) => ({ ...prev, slug }))}
  isCreate={!cottage}
/>
```

- [ ] **Step 10: Обновить интерфейс и сигнатуру DescriptionTab**

Заменить:

```ts
interface DescriptionTabProps {
  form: CottageForm;
  setForm: React.Dispatch<React.SetStateAction<CottageForm>>;
  slugTouched: boolean;
  autoSlug: string;
  onSlugTouched: () => void;
  onSlugChange: (slug: string) => void;
  isCreate: boolean;
}
```

- [ ] **Step 11: Добавить секцию «Идентификаторы» в DescriptionTab**

Внутри `function DescriptionTab({...})` ПЕРЕД первым `<section>` (Основное) добавить useMemo для отображаемого slug:

```ts
const displayedSlug = slugTouched ? form.slug : autoSlug;
```

Затем в самое начало возвращаемого JSX (перед `<section>` с «Основное») добавить секцию:

```tsx
<section className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 space-y-4">
  <h3 className="text-sm font-semibold text-neutral-300">Идентификаторы</h3>
  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-1.5">
      <Label htmlFor="slug">Slug (URL)</Label>
      <Input
        id="slug"
        value={displayedSlug}
        readOnly={!isCreate}
        placeholder="shale-uyut"
        className={!isCreate ? 'bg-neutral-900/50 text-neutral-400' : ''}
        onChange={(e) => {
          if (!isCreate) return;
          onSlugChange(e.target.value);
          onSlugTouched();
        }}
      />
      {isCreate && !slugTouched && form.name && (
        <p className="text-xs text-neutral-500">
          Автогенерация из названия. Измените, чтобы зафиксировать.
        </p>
      )}
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="mapId">Map ID (точка на карте)</Label>
      <Input
        id="mapId"
        value={form.mapId}
        readOnly={!isCreate}
        placeholder="Домик4"
        className={!isCreate ? 'bg-neutral-900/50 text-neutral-400' : ''}
        onChange={(e) => update('mapId', e.target.value)}
      />
      {isCreate && (
        <p className="text-xs text-neutral-500">
          Связывает домик с точкой на карте (src/lib/cabins.ts).
        </p>
      )}
    </div>
  </div>
</section>
```

- [ ] **Step 12: Добавить поле mainImage в секцию «Основное»**

Внутри `<section>` с `<h3>Основное</h3>` ПЕРЕД блоком `<div className="grid gap-4 md:grid-cols-2">` (с `name` и `basePrice`) добавить:

```tsx
<div className="space-y-1.5">
  <Label htmlFor="mainImage">
    URL главного фото <span className="text-red-400">*</span>
  </Label>
  <Input
    id="mainImage"
    value={form.mainImage}
    onChange={(e) => update('mainImage', e.target.value)}
    placeholder="/images/cottage-main.jpg"
  />
  {isCreate && !form.mainImage.trim() && (
    <p className="text-xs text-amber-400">Обязательное поле — используется как обложка в каталоге.</p>
  )}
</div>
```

- [ ] **Step 13: Проверить типы**

Run: `npx tsc -b 2>&1 | head -40`
Expected: 0 ошибок. Если есть ошибки про `isCreate` в `useMemo` или порядок хуков — перепроверить, что `useMemo` для `autoSlug` поднят в `CottageEditor` (Task 6 шаг 4), а `displayedSlug` — внутри `DescriptionTab`.

- [ ] **Step 14: Commit**

```bash
git add src/pages/admin/CottageEditor.tsx
git commit -m "feat(admin/cottages): create mode in CottageEditor with slug/mapId/mainImage"
```

---

## Task 7: Smoke-проверка в браузере

**Files:** только runtime-проверка, без изменений в коде (если не найдены баги).

- [ ] **Step 1: Запустить backend + frontend**

Run в двух терминалах:
```bash
npm run backend:dev
npm run dev
```

- [ ] **Step 2: Зайти в /admin/cottages, проверить кнопки**

Browser: открыть `/admin/login` → ввести пароль → перейти на `/admin/cottages`.
Ожидаемое:
- Кнопка «Создать» в правом верхнем углу.
- Кнопка 🗑️ рядом с ✏️ в каждой строке.

- [ ] **Step 3: Создать тестовый домик**

- Клик «Создать» → открылся `/admin/cottages/new`.
- Заполнить: name=«Тестовый домик», short/long description, basePrice=3000, area=40, guests=2, bedrooms=1, checkInTime=15:00, checkOutTime=12:00, mainImage=/images/test.jpg.
- Нажать «Создать».
- Должен произойти редирект на `/admin/cottages/:id`, toast «Создано».

- [ ] **Step 4: Отредактировать только что созданный домик**

- Изменить basePrice → 3500.
- Нажать «Сохранить».
- Toast «Сохранено», значение в БД обновилось.

- [ ] **Step 5: Попробовать удалить домик без броней**

- На `/admin/cottages` найти тестовый домик.
- Клик 🗑️ → диалог подтверждения.
- Подтвердить → toast «Удалено», строка исчезла.

- [ ] **Step 6: Попробовать удалить домик с бронированием (для проверки HAS_BOOKINGS)**

- Создать ещё один домик.
- В `OccupancyCalendar` (на `/admin`) кликнуть на ячейку нового домика → заполнить бронь → сохранить.
- Вернуться на `/admin/cottages` → клик 🗑️ → подтвердить.
- Ожидаемое: toast «Нельзя удалить: у домика есть бронирования», оранжевый баннер сверху на 8 секунд.

- [ ] **Step 7: Попробовать дубликат slug**

- Создать домик с slug=«dup-slug».
- Попробовать создать ещё один с тем же slug.
- Ожидаемое: 409 → toast.error с текстом ошибки, форма остаётся.

- [ ] **Step 8: Проверить авто-транслитерацию**

- Создать домик с name=«Шале Уют», не трогая slug.
- Slug должен автоматически показать «shale-uyut».
- Изменить slug вручную → больше не меняется при правке name.

- [ ] **Step 9: Backend-тесты финальный прогон**

Run: `cd backend && npx vitest run`
Expected: всё PASS.

- [ ] **Step 10: Frontend-тесты финальный прогон**

Run: `npx vitest run`
Expected: всё PASS (включая 9 тестов translit).

- [ ] **Step 11: Commit (если были правки по итогам смок-проверки)**

```bash
git status
# Если есть правки:
git add -A
git commit -m "fix(admin/cottages): smoke-test fixes"
# Если правок нет — коммитить нечего.
```

---

## Out of scope (НЕ делаем в этом плане)

- Синхронизация с `src/lib/cabins.ts` (статический контент для `/booking/*`).
- Редактирование `slug` и `mapId` после создания (в редакторе они `readOnly`).
- Каскад по `bookings` при удалении.
- Wizard / multi-step форма.
- Frontend-тесты для форм (только utils).
- SEO-индексация новых домиков в sitemap.