# RealtyCalendar Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить локальную систему бронирования на редирект в RealtyCalendar (`https://homereserve.ru/feEBPdLdgb`). Кнопка бронирования на сайте = `<a target="_blank">`. Бэк для контента (домики, отзывы, SEO, блог, изображения, админка) сохраняется. MAX-бот, уведомления о бронях, таблицы `bookings`/`bookingServices`/`notifications`/`maxSubscribers` — удаляются.

**Architecture:** Атомарная замена через 3 фазы (фронт-only → бэк-only → деплой → доки). Фаза 0 безопасна — фронт уже работает на RC-редиректе, но бэк ещё крутится (никем не используется). Можно катить на прод как промежуточный шаг.

**Tech Stack:** React 19 + Vite 7 + TypeScript 5.9 + Tailwind 3.4 (фронт); Express 4 + Drizzle ORM + better-sqlite3 (бэк); Vitest (тесты); pg_dump / sqlite3 .backup (бэкап).

**Spec:** `docs/superpowers/specs/2026-09-19-realtycalendar-replacement-design.md`

## Global Constraints

- **TS strict.** Никакого `any`, кроме случаев, оправданных взаимодействием с внешним API (тут нет таких).
- **Русский** в пользовательских строках, коде ошибок, логах, комментариях к бизнес-логике.
- **Тесты:** `npm run test` (Vitest) + `npm run backend:test` зелёные после каждого task, где они запускаются.
- **Билд:** `npm run build` собирается без ошибок типов после каждого task.
- **Коммиты:** conventional commits, атомарные, после зелёных тестов.
- **Бэкап БД** обязателен перед любым `DROP TABLE` в проде.
- **`RC_BOOKING_URL = "https://homereserve.ru/feEBPdLdgb"`** — единственный источник URL бронирования во всём проекте.
- **Не трогать:** `vite.config.ts` proxy, `public/robots.txt`, `src/components/ui/` (shadcn), `src/lib/api.ts` формат `{success, data}` / `{success, false, error}`.
- **Не редактировать** `backend/drizzle/*.sql` руками — только `schema.ts` + `drizzle-kit generate`.

---

## Фаза 0 — Frontend refactor (frontend-only)

### Task 0.1: Создать `src/lib/bookingRedirect.ts`

**Files:**
- Create: `src/lib/bookingRedirect.ts`
- Test: `src/lib/bookingRedirect.test.ts`

**Produces:**
```ts
export const RC_BOOKING_URL: string;
export function rcBookingHref(params?: Record<string, string | undefined>): string;
```

- [ ] **Step 1: Написать failing-тест**

```ts
// src/lib/bookingRedirect.test.ts
import { describe, it, expect } from 'vitest';
import { RC_BOOKING_URL, rcBookingHref } from './bookingRedirect';

describe('bookingRedirect', () => {
  it('exposes homereserve.ru URL', () => {
    expect(RC_BOOKING_URL).toBe('https://homereserve.ru/feEBPdLdgb');
  });

  describe('rcBookingHref', () => {
    it('returns base URL when params undefined', () => {
      expect(rcBookingHref()).toBe('https://homereserve.ru/feEBPdLdgb');
    });

    it('returns base URL when params empty', () => {
      expect(rcBookingHref({})).toBe('https://homereserve.ru/feEBPdLdgb');
    });

    it('appends query string when params given', () => {
      expect(rcBookingHref({ checkIn: '2026-12-01', checkOut: '2026-12-05' }))
        .toBe('https://homereserve.ru/feEBPdLdgb?checkIn=2026-12-01&checkOut=2026-12-05');
    });

    it('filters out undefined and empty values', () => {
      expect(rcBookingHref({ checkIn: '2026-12-01', guests: undefined, note: '' }))
        .toBe('https://homereserve.ru/feEBPdLdgb?checkIn=2026-12-01');
    });
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что FAIL**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run src/lib/bookingRedirect.test.ts
```

Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать модуль**

```ts
// src/lib/bookingRedirect.ts

/**
 * Единственный URL бронирования во всём проекте.
 * RealtyCalendar — внешний channel manager, все бронирования идут туда.
 */
export const RC_BOOKING_URL = 'https://homereserve.ru/feEBPdLdgb';

/**
 * Собрать URL с query-параметрами.
 * Фильтрует undefined и пустые строки.
 * Если после фильтра ничего не осталось — возвращает базовый URL без "?".
 */
export function rcBookingHref(params?: Record<string, string | undefined>): string {
  if (!params) return RC_BOOKING_URL;
  const filtered = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '',
  ) as [string, string][];
  if (filtered.length === 0) return RC_BOOKING_URL;
  const qs = new URLSearchParams(filtered).toString();
  return `${RC_BOOKING_URL}?${qs}`;
}
```

- [ ] **Step 4: Запустить тест, убедиться что PASS**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run src/lib/bookingRedirect.test.ts
```

Expected: 4/4 passed.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bookingRedirect.ts src/lib/bookingRedirect.test.ts
git commit -m "feat(booking): RC_BOOKING_URL + rcBookingHref helper"
```

---

### Task 0.2: Создать `<BookingCTA />` компонент

**Files:**
- Create: `src/components/BookingCTA/BookingCTA.tsx`
- Test: `src/components/BookingCTA/BookingCTA.test.tsx`

**Consumes:** `RC_BOOKING_URL` из Task 0.1, `cn()` из `src/lib/utils`, существующие `buttonVariants` из `src/components/ui/button` (shadcn).

**Produces:**
```tsx
export interface BookingCTAProps {
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  label?: string;
  className?: string;
}
export function BookingCTA(props: BookingCTAProps): JSX.Element;
```

- [ ] **Step 1: Написать failing-тест**

```tsx
// src/components/BookingCTA/BookingCTA.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingCTA } from './BookingCTA';

describe('BookingCTA', () => {
  it('renders anchor with homereserve.ru URL', () => {
    render(<BookingCTA />);
    const link = screen.getByRole('link', { name: /забронировать/i });
    expect(link).toHaveAttribute('href', 'https://homereserve.ru/feEBPdLdgb');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('uses custom label', () => {
    render(<BookingCTA label="Перейти к бронированию" />);
    expect(
      screen.getByRole('link', { name: /перейти к бронированию/i }),
    ).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<BookingCTA className="my-class" />);
    expect(screen.getByRole('link')).toHaveClass('my-class');
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что FAIL**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run src/components/BookingCTA/BookingCTA.test.tsx
```

Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать компонент**

Сначала проверить, как устроены кнопки в `src/components/ui/button.tsx` (shadcn) — какие варианты `variant` доступны (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) и какие `size` (`default`, `sm`, `lg`, `icon`).

```tsx
// src/components/BookingCTA/BookingCTA.tsx
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RC_BOOKING_URL } from '@/lib/bookingRedirect';

export interface BookingCTAProps {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  className?: string;
}

/**
 * Единая CTA-кнопка бронирования. Ведёт на RealtyCalendar.
 * Используется во всех точках сайта вместо локальных форм.
 */
export function BookingCTA({
  variant = 'default',
  size = 'default',
  label = 'Забронировать',
  className,
}: BookingCTAProps) {
  return (
    <a
      href={RC_BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {label}
    </a>
  );
}
```

- [ ] **Step 4: Запустить тест, убедиться что PASS**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run src/components/BookingCTA/BookingCTA.test.tsx
```

Expected: 3/3 passed.

- [ ] **Step 5: Коммит**

```bash
git add src/components/BookingCTA/
git commit -m "feat(booking): BookingCTA component (link to RealtyCalendar)"
```

---

### Task 0.3: Подключить `BookingCTA` в Hero/Cabins

**Files:**
- Modify: `src/sections/Hero.tsx` (найти текущую CTA-кнопку бронирования)
- Modify: `src/sections/Cabins.tsx` (найти кнопку «Забронировать» в карточках)

**Strategy:** Grep для существующих кнопок бронирования, заменить на `<BookingCTA />`.

- [ ] **Step 1: Найти текущие кнопки бронирования в Hero и Cabins**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && grep -nE "забронировать|BookingDialog|bookingsRouter|setBookingOpen" src/sections/Hero.tsx src/sections/Cabins.tsx
```

Ожидаемый результат: 1+ совпадений в каждом файле (или grep ничего не находит — тогда см. Step 1b).

- [ ] **Step 1b (fallback): если grep пуст, поискать в исходниках шире**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && grep -rln "BookingDialog\|onBookNow\|bookingsRouter" src/
```

- [ ] **Step 2: Заменить в Hero.tsx**

Найти блок кнопки, например:
```tsx
<Button onClick={() => setBookingOpen(true)}>Забронировать</Button>
```

Заменить на:
```tsx
<BookingCTA variant="default" size="lg" />
```

(или с `label` если текст отличается).

Удалить импорт `Button`, `setBookingOpen` (если стал неиспользуемым), добавить `import { BookingCTA } from '@/components/BookingCTA/BookingCTA';`.

- [ ] **Step 3: Заменить в Cabins.tsx**

В каждой карточке домика найти кнопку бронирования (`Button onClick={...}` или `<Link to="/booking/...">Забронировать</Link>`) и заменить на `<BookingCTA variant="default" size="sm" />`.

**Альтернатива:** если кнопка ведёт на `/booking/:slug` через `<Link>`, оставить `<Link>` (это SEO-страница домика), а саму кнопку бронирования на `/booking/:slug` сделать через `<BookingCTA />` уже в Task 0.7.

- [ ] **Step 4: Прогнать тесты + типы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit
```

Expected: зелёные тесты, нет ошибок типов.

- [ ] **Step 5: Визуально проверить**

Запустить `npm run dev`, открыть http://localhost:5173, проверить:
- На главной CTA-кнопка в Hero ведёт на `homereserve.ru/feEBPdLdgb` в новой вкладке.
- В карточках домиков — аналогично.

- [ ] **Step 6: Коммит**

```bash
git add src/sections/Hero.tsx src/sections/Cabins.tsx
git commit -m "refactor(sections): replace local booking CTAs with BookingCTA"
```

---

### Task 0.4: Упростить `StickyFooter` до одной CTA-кнопки

**Files:**
- Modify: `src/components/StickyFooter/StickyFooter.tsx`
- Modify: `src/components/StickyFooter/StickyFooter.module.css` (если есть стили для date-picker'ов — удалить)

**Strategy:** Убрать `DatePicker`/`Calendar`/`GuestsSelector` и любые связанные state'ы. Оставить `BookingCTA`.

- [ ] **Step 1: Прочитать текущий `StickyFooter.tsx`**

Прочитать файл целиком. Понять, какие state'ы, импорты и UI-блоки относятся к поиску (даты, гости, кнопка «Найти»).

- [ ] **Step 2: Заменить внутреннюю разметку поиска на `<BookingCTA />`**

В компоненте `StickyFooter`:
- Удалить `useState` для дат, гостей, видимости.
- Удалить импорты date-picker / calendar / guests-selector.
- Внутри `<footer>` оставить только `<BookingCTA variant="default" size="lg" />` (или с лейблом «Забронировать»).

Пример итоговой структуры:
```tsx
export function StickyFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <BookingCTA variant="default" size="lg" />
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Почистить CSS**

Удалить из `StickyFooter.module.css` (или `.css`) классы, относящиеся к date-picker'ам и селектору гостей (`.datePicker`, `.guests`, `.searchButton`, и т.п.).

- [ ] **Step 4: Прогнать тесты + типы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit
```

- [ ] **Step 5: Визуально проверить**

`npm run dev`, проверить, что футер показывает одну кнопку «Забронировать» → RC.

- [ ] **Step 6: Коммит**

```bash
git add src/components/StickyFooter/
git commit -m "refactor(sticky-footer): drop search widget, use single BookingCTA"
```

---

### Task 0.5: Удалить `BookingDialog` + связанные хуки

**Files:**
- Delete: `src/components/BookingDialog/` (целиком)
- Delete: `src/components/BookingDialog/BookingDialog.test.tsx` (если есть)
- Modify: `src/lib/api.ts` — удалить `useBookings`, `useAvailability`, `useCalendarPrices`, `useAggregateCalendarPrices`

**Strategy:** Удалить файлы и хуки. Проверить, что нигде не осталось импортов.

- [ ] **Step 1: Найти все использования `BookingDialog`**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && grep -rln "BookingDialog" src/
```

Если grep находит — нужно удалить каждый импорт/использование. К этому моменту (после Task 0.3) `BookingDialog` уже нигде не должен быть нужен (всё заменено на `BookingCTA`).

- [ ] **Step 2: Удалить папку `BookingDialog`**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && git rm -r src/components/BookingDialog/
```

- [ ] **Step 3: Удалить хуки из `src/lib/api.ts`**

Прочитать `src/lib/api.ts`, найти функции/хуки: `useBookings`, `useAvailability`, `useCalendarPrices`, `useAggregateCalendarPrices` (или в отдельных файлах в `src/hooks/`). Удалить их.

**Также удалить импорты** `@/api/bookings`, `@/api/availability`, и т.п. — оставить только то, что используется для контента (`/api/cottages`, `/api/reviews`, `/api/seo-pages`, и т.п.).

- [ ] **Step 4: Прогнать тесты + типы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit
```

Если ошибка типа `Cannot find module '@/hooks/useBookings'` — найти и удалить оставшийся импорт.

- [ ] **Step 5: Билд**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run build
```

Expected: успешная сборка.

- [ ] **Step 6: Коммит**

```bash
git add -A
git commit -m "refactor(booking): remove BookingDialog and booking hooks"
```

---

### Task 0.6: Удалить `CustomCalendar` целиком

**Files:**
- Delete: `src/components/CustomCalendar/` (целиком)

**Strategy:** После Task 0.5 календарь больше никем не используется.

- [ ] **Step 1: Проверить, что `CustomCalendar` нигде не импортируется**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && grep -rln "CustomCalendar" src/
```

Если находит — нужно понять, используется ли он для чего-то ещё (например, для отображения дат в инфо-блоке). Если используется — переписать на простой текст + `BookingCTA`.

- [ ] **Step 2: Удалить папку**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && git rm -r src/components/CustomCalendar/
```

- [ ] **Step 3: Прогнать тесты + типы + билд**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Коммит**

```bash
git commit -m "refactor(booking): remove CustomCalendar (RC owns availability)"
```

---

### Task 0.7: Переписать `/booking/:cabinId` как лендинг домика

**Files:**
- Modify: `src/pages/booking/BookingAbout.tsx` (или `BookingCabin.tsx` — что есть)
- Modify: `src/pages/booking/BookingAmenities.tsx` (если есть) — оставить
- Modify: `src/pages/booking/NearbyAttractions.tsx` — оставить
- Modify: `src/pages/booking/SiteMap` если есть отдельный файл — оставить

**Strategy:** Убрать блоки с формой, ценами, услугами-в-бронях, расчётом стоимости. Оставить галерею, описание, удобства, карту, nearby, отзывы (read-only). Добавить `<BookingCTA />` в CTA-блок.

- [ ] **Step 1: Прочитать текущий `src/pages/booking/*.tsx`**

Составить список:
- Какие компоненты используются (`CabinGallery`, `CabinDescription`, `Amenities`, `SiteMap`, `NearbyAttractions`, `ReviewsList`, ...)
- Какие блоки относятся к форме (`PriceBreakdown`, `BookingForm`, `Services`, `MinNightsWarning`, ...)

- [ ] **Step 2: В CTA-блоке заменить форму на `<BookingCTA />`**

В файле, где находится CTA-блок (вероятно `BookingAbout.tsx` или `index.tsx`):
```tsx
// Было: <BookingDialog ... /> или форма с DatePicker'ами
// Стало:
<section className={styles.ctaSection}>
  <p className={styles.ctaHint}>
    Свободные даты и цены — на сайте бронирования.
  </p>
  <BookingCTA variant="default" size="lg" label="Забронировать" />
</section>
```

- [ ] **Step 3: Удалить блоки формы, цены, услуг**

Удалить JSX и связанные импорты:
- `PriceBreakdown`, `BookingForm`, `BookingPricing`, `BookingServices`, `BookingCalendar`, `MinNightsWarning`
- Любые `useState`, `useForm`, `react-hook-form`, `zod` для валидации формы брони
- `useAvailability`, `useBookings`, и т.п.

**Оставить:** `CabinGallery`, описание, удобства (`amenities`), `SiteMap`, `NearbyAttractions`, `ReviewsList` (read-only).

- [ ] **Step 4: Обновить Schema.org (если был)**

Проверить, что `useDocumentHead({...})` для `/booking/:cabinId` не содержит полей про цены (`priceRange`, `offers`). Оставить `LodgingBusiness` без `offers`.

- [ ] **Step 5: Прогнать тесты + типы + билд**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit && npm run build
```

- [ ] **Step 6: Визуально проверить**

`npm run dev`, открыть `/booking/<slug>` (например `/booking/chalet-uyut`), проверить:
- Галерея, описание, удобства, карта, nearby, отзывы — отображаются.
- Нет формы/календаря/расчёта цены.
- CTA-кнопка «Забронировать» ведёт на RC.

- [ ] **Step 7: Коммит**

```bash
git add src/pages/booking/
git commit -m "refactor(booking-page): cottage landing without local booking form"
```

---

### Task 0.8: Удалить `/search` роут + `SearchResultsPage`

**Files:**
- Delete: `src/pages/SearchResultsPage.tsx` (или `src/pages/search/SearchResultsPage.tsx`)
- Modify: `src/App.tsx` — удалить `<Route path="/search" ... />`

- [ ] **Step 1: Найти `SearchResultsPage` и его использование**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && grep -rln "SearchResultsPage\|'/search'" src/
```

- [ ] **Step 2: Удалить файл и роут**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && git rm src/pages/SearchResultsPage.tsx
```

В `src/App.tsx` удалить строку `<Route path="/search" element={<SearchResultsPage />} />` и связанный `import`.

- [ ] **Step 3: Прогнать тесты + типы + билд**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Коммит**

```bash
git add -A
git commit -m "refactor(routes): remove /search (RC handles availability)"
```

---

### Task 0.9: Удалить `src/lib/bookingRules.ts`

**Files:**
- Delete: `src/lib/bookingRules.ts`
- Delete: `src/lib/bookingRules.test.ts` (если есть)

**Strategy:** После Task 0.5/0.7 эти правила больше не нужны (нет формы = нет валидации).

- [ ] **Step 1: Проверить, что нигде не импортируется**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && grep -rln "bookingRules" src/
```

Если находит — пересмотреть использование. Если это что-то кроме формы (например, в `StickyFooter` — но мы его уже упростили) — оставить.

- [ ] **Step 2: Удалить файлы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && git rm src/lib/bookingRules.ts src/lib/bookingRules.test.ts
```

- [ ] **Step 3: Прогнать тесты + типы + билд**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Коммит**

```bash
git commit -m "refactor(booking): remove local bookingRules (RC enforces min nights)"
```

---

### Task 0.10: Удалить админку бронирований

**Files:**
- Delete: `src/components/admin/OccupancyCalendar.tsx` (если есть)
- Delete: `src/components/admin/BookingsList.tsx` (если есть)
- Delete: `src/components/admin/BookingFormDialog.tsx` (если есть)
- Modify: `src/pages/admin/AdminDashboard.tsx` — убрать ссылки/импорты этих компонентов

- [ ] **Step 1: Найти компоненты админки бронирований**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && ls src/components/admin/ && grep -rln "OccupancyCalendar\|BookingsList\|BookingFormDialog" src/
```

- [ ] **Step 2: Удалить файлы и почистить `AdminDashboard.tsx`**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && git rm src/components/admin/OccupancyCalendar.tsx src/components/admin/BookingsList.tsx src/components/admin/BookingFormDialog.tsx
```

В `src/pages/admin/AdminDashboard.tsx`:
- Удалить импорты этих компонентов.
- Удалить JSX-блоки, где они используются.
- Если был раздел «Бронирования» (таб/ссылка) — удалить.

- [ ] **Step 3: Прогнать тесты + типы + билд**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Визуально проверить админку**

`npm run dev`, залогиниться в `/admin/login`, проверить:
- Нет вкладки/раздела «Бронирования».
- SEO-страницы, блог, отзывы, домики — работают.

- [ ] **Step 5: Коммит**

```bash
git add -A
git commit -m "refactor(admin): remove bookings section (managed in RC)"
```

---

### Task 0.11: Очистить `cabins.ts` от полей цен

**Files:**
- Modify: `src/lib/cabins.ts` — удалить `basePrice`, `minNights`, `seasonalPricing` (если присутствуют)

**Strategy:** Эти поля больше не используются (RC управляет ценами). Но `mapId`, `name`, `description`, `mainImage`, `gallery`, `amenities`, `rules` — оставить.

- [ ] **Step 1: Прочитать `src/lib/cabins.ts`**

Составить список полей, относящихся к бронированию.

- [ ] **Step 2: Удалить ценовые поля**

Удалить из интерфейса `Cabin` (если есть):
- `basePrice?: number`
- `minNights?: number`
- `seasonalPricing?: ...`

Из каждого объекта в массиве `CABINS` удалить эти поля.

- [ ] **Step 3: Прогнать тесты + типы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npx vitest run && npx tsc --noEmit
```

Если что-то ещё ссылается на эти поля — пересмотреть.

- [ ] **Step 4: Коммит**

```bash
git add src/lib/cabins.ts
git commit -m "refactor(cabins): remove price fields (managed in RC)"
```

---

### Task 0.12: Финальная проверка Фазы 0

- [ ] **Step 1: Полный прогон**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run lint && npm run test && npm run build
```

Expected: всё зелёное.

- [ ] **Step 2: Поднять dev и пройтись по сайту вручную**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run dev
```

Открыть `http://localhost:5173`:
- [ ] Главная: CTA-кнопка в Hero или StickyFooter → RC.
- [ ] Карточки домиков: «Забронировать» → RC.
- [ ] `/booking/<slug>`: лендинг домика без формы, CTA → RC.
- [ ] `/search`: 404.
- [ ] `/admin/login`: работает, контентные разделы функциональны.

- [ ] **Step 3: Поднять бэкенд отдельно (он ещё должен работать)**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run backend:dev
```

Проверить, что бэк стартует без ошибок (он ещё не тронут в Фазе 0). `curl http://localhost:3001/api/cottages` отдаёт домики.

- [ ] **Step 4: Билд prerender**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run build
```

Проверить `dist/`:
- [ ] `dist/index.html` — главная без падений.
- [ ] `dist/booking/<slug>/index.html` — лендинг домика рендерится.
- [ ] Нет 404 в prerender-логе.

- [ ] **Step 5: Готово к раскатке Фазы 0 на прод**

Если всё ок — фронт можно катить (Фаза 0 → Фаза 2 step 1).

---

## Фаза 1 — Backend removal

### Task 1.1: Бэкап БД (на сервере)

**Where:** удалённый сервер с `DATABASE_URL=postgres://postgres:L0kijuhy!@192.168.1.103:5432/ZvukiLesa`.

> ⚠️ Этот task выполняется ОТДЕЛЬНО от локальных коммитов. Бэкап хранится на сервере минимум 3 месяца.

- [ ] **Step 1: Подключиться к серверу и сделать дамп**

```bash
ssh user@server
pg_dump -h 192.168.1.103 -U postgres -d ZvukiLesa -Fc -f /backup/zvuki-lesa-$(date +%Y%m%d-%H%M%S).dump
```

(Или, если бэк на удалённой машине, скопировать `backend/data/zvuki-lesa.db` в `_backup/`.)

- [ ] **Step 2: Проверить размер дампа**

```bash
ls -lh /backup/zvuki-lesa-*.dump
```

Expected: размер > 0.

- [ ] **Step 3: Записать путь к бэкапу в описание коммита Фазы 2**

Сохранить путь в заметках — пригодится, если что-то пойдёт не так.

---

### Task 1.2: Sanity-check импортов (локально)

**Files:** только чтение.

- [ ] **Step 1: Проверить, что удаляемые модули никто не дёргает вне удаляемых роутов**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && grep -rn "from.*services/pricing\|from.*services/availability\|from.*services/notifications\|from.*services/maxBot\|from.*services/maxPoller" src/
```

Ожидаемые совпадения только в удаляемых файлах (`bookings.ts`, `admin.ts`, `server.ts`, и тесты). Если что-то ещё — пересмотреть план.

- [ ] **Step 2: Проверить, что `maxSubscribers` и `notifications` не дёргаются откуда-то ещё**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && grep -rn "maxSubscribers\|notifyNewBooking\|notifications\b" src/
```

- [ ] **Step 3: Проверить, что таблица `bookings` не используется в `analytics.ts` или `cottages.ts`**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && grep -n "bookings" src/routes/analytics.ts src/routes/cottages.ts src/routes/calendar.ts
```

Если `analytics.ts` использует `bookings` для агрегатов — нужно решить: оставить `analytics.ts` с пустыми результатами или удалить.

- [ ] **Step 4: Зафиксировать результаты в комментарии коммита**

Если что-то нашлось — добавить task или решить перед удалением. Если всё чисто — продолжать.

---

### Task 1.3: Удалить таблицы из `schema.ts`

**Files:**
- Modify: `backend/src/db/schema.ts` — удалить Drizzle-определения таблиц `bookings`, `bookingServices`, `notifications`, `maxSubscribers`

- [ ] **Step 1: Прочитать `schema.ts`, найти таблицы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && grep -n "^export const \(bookings\|bookingServices\|notifications\|maxSubscribers\)" src/db/schema.ts
```

- [ ] **Step 2: Удалить определения таблиц + связанные enum'ы и типы**

Удалить:
- `export const bookings = sqliteTable(...)` (целиком)
- `export const bookingServices = sqliteTable(...)` (целиком)
- `export const notifications = sqliteTable(...)` (целиком)
- `export const maxSubscribers = sqliteTable(...)` (целиком)
- Enum'ы: `bookingStatusEnum`, `bookingSourceEnum` (если выделены отдельно)
- Типы: `Booking`, `BookingService`, `Notification`, `MaxSubscriber` (если экспортированы)

**Не удалять:** таблицы `cottages`, `reviews`, `seoPages`, `blogPosts`, `imagesRegistry`, `services`, `priceRules`, `amenities`, `cottageAmenities`, `recreationItems`, `cottageImages`.

- [ ] **Step 3: Сгенерировать миграцию**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npx drizzle-kit generate
```

Будет создан файл в `backend/drizzle/<timestamp>_*.sql`.

- [ ] **Step 4: Проверить сгенерированный SQL**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && cat drizzle/0*drop*.sql
```

Ожидаемое содержимое:
```sql
DROP TABLE IF EXISTS "booking_services";
DROP TABLE IF EXISTS "bookings";
DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "max_subscribers";
-- возможно дроп индексов, если они отдельно
```

Если в SQL есть неожиданные `ALTER TABLE` или удаление не тех таблиц — пересмотреть правки в `schema.ts`.

- [ ] **Step 5: Прогнать типы бэка**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npx tsc --noEmit
```

Expected: ошибки типов в `bookings.ts`, `admin.ts`, `notifications.ts` и т.п. (потому что импорты теперь невалидны). Это нормально — поправим в Task 1.5–1.7.

- [ ] **Step 6: Коммит (только schema.ts + новая миграция)**

```bash
git add backend/src/db/schema.ts backend/drizzle/
git commit -m "refactor(db): drop bookings/booking_services/notifications/max_subscribers"
```

---

### Task 1.4: Удалить файлы сервисов

**Files:**
- Delete: `backend/src/services/pricing.ts`
- Delete: `backend/src/services/pricing.test.ts` (если есть)
- Delete: `backend/src/services/availability.ts`
- Delete: `backend/src/services/availability.test.ts` (если есть)
- Delete: `backend/src/services/notifications.ts`
- Delete: `backend/src/services/notifications.test.ts` (если есть)
- Delete: `backend/src/services/maxBot.ts`
- Delete: `backend/src/services/maxBot.test.ts` (если есть)
- Delete: `backend/src/services/maxPoller.ts`
- Delete: `backend/src/services/maxPoller.test.ts` (если есть)
- Delete: `backend/src/services/telegramBot.ts` (если связан только с бронями; проверить `grep "bookings"`)

- [ ] **Step 1: Проверить telegramBot.ts**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && grep -n "bookings\|notifyNewBooking" src/services/telegramBot.ts
```

Если есть упоминания — НЕ удалять (используется для чего-то ещё). Если нет — удалить.

- [ ] **Step 2: Удалить файлы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && git rm src/services/pricing.ts src/services/pricing.test.ts src/services/availability.ts src/services/availability.test.ts src/services/notifications.ts src/services/notifications.test.ts src/services/maxBot.ts src/services/maxBot.test.ts src/services/maxPoller.ts src/services/maxPoller.test.ts
```

(Опц.) `git rm src/services/telegramBot.ts src/services/telegramBot.test.ts` если Step 1 решил удалять.

- [ ] **Step 3: Коммит**

```bash
git commit -m "refactor(services): remove booking/notification/max services"
```

---

### Task 1.5: Удалить роуты бронирования

**Files:**
- Delete: `backend/src/routes/bookings.ts`
- Delete: `backend/src/routes/bookings.test.ts` (если есть)
- Delete: `backend/src/routes/availability.ts`
- Delete: `backend/src/routes/availability.test.ts` (если есть)
- Delete: `backend/src/routes/calendar.ts`
- Delete: `backend/src/routes/calendar.test.ts` (если есть)
- Modify: `backend/src/routes/admin.ts` — удалить секции `/bookings`, `/calendar`, `/finance`

- [ ] **Step 1: Удалить файлы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && git rm src/routes/bookings.ts src/routes/bookings.test.ts src/routes/availability.ts src/routes/availability.test.ts src/routes/calendar.ts src/routes/calendar.test.ts
```

- [ ] **Step 2: Почистить `admin.ts`**

Прочитать `backend/src/routes/admin.ts`, удалить:
- `GET /bookings`, `POST /bookings`, `PATCH /bookings/:id`, `POST /bookings/:id/confirm`, `POST /bookings/:id/cancel`
- `GET /calendar`
- `GET /finance`

Оставить: `POST /login` + любые контентные роуты (если они в `admin.ts`). Сохранить `requireAdmin` middleware.

- [ ] **Step 3: Прогнать тесты бэка**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npm run test
```

Если тесты падают на `bookings.test.ts` — этот файл уже удалён, должно быть ок. Если падают на `admin.test.ts` — нужно отредактировать файл, удалив тесты удалённых роутов.

- [ ] **Step 4: Коммит**

```bash
git add -A
git commit -m "refactor(routes): remove bookings/availability/calendar/admin-bookings routes"
```

---

### Task 1.6: Почистить `server.ts`

**Files:**
- Modify: `backend/src/server.ts` — убрать импорты и монтирование удалённых роутов, убрать запуск `maxPoller`

- [ ] **Step 1: Прочитать `server.ts`, найти импорты удалённых модулей**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && grep -n "bookings\|availability\|calendar\|maxPoller\|maxBot\|notifications" src/server.ts
```

- [ ] **Step 2: Удалить импорты и использования**

Удалить:
- `import { bookingsRouter } from './routes/bookings.js';`
- `import { availabilityRouter } from './routes/availability.js';`
- `import { calendarRouter } from './routes/calendar.js';`
- `app.use('/api', bookingsRouter);`
- `app.use('/api', availabilityRouter);`
- `app.use('/api', calendarRouter);`
- `import { startMaxPolling } from './services/maxPoller.js';`
- `if (process.env.MAX_BOT_TOKEN) { startMaxPolling(); }` (или аналогичный код)

Оставить: импорты и использования `cottages`, `seoPages`, `blogPosts`, `reviews`, `images`, `sitemap`, `analytics` и `admin` (с `/login`).

- [ ] **Step 3: Прогнать типы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npx tsc --noEmit
```

Expected: ошибок нет (если Task 1.3–1.5 выполнены чисто).

- [ ] **Step 4: Поднять бэк вручную и проверить эндпоинты**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npm run dev
```

В другом терминале:
```bash
curl http://localhost:3001/api/cottages | head -c 200
curl http://localhost:3001/api/reviews | head -c 200
curl -X POST http://localhost:3001/api/bookings -H "Content-Type: application/json" -d '{}' -w "%{http_code}\n"
```

Expected:
- `/api/cottages` — 200, JSON со списком домиков.
- `/api/reviews` — 200, JSON.
- `/api/bookings` — 404 (роут удалён).

- [ ] **Step 5: Коммит**

```bash
git add backend/src/server.ts
git commit -m "refactor(server): drop booking/availability/calendar/maxpoller mounts"
```

---

### Task 1.7: Очистить `.env.example`

**Files:**
- Modify: `backend/.env.example` — удалить `MAX_BOT_TOKEN`, `MAX_JOIN_CODE`

- [ ] **Step 1: Прочитать `.env.example`**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && cat .env.example
```

- [ ] **Step 2: Удалить секцию MAX**

Удалить строки:
```
# MAX-бот для уведомлений о бронированиях
MAX_BOT_TOKEN=
MAX_JOIN_CODE=
```

(Или весь комментарий-блок, если он отдельный.)

**Оставить:** `DATABASE_URL`, `PORT`, `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`.

- [ ] **Step 3: Коммит**

```bash
git add backend/.env.example
git commit -m "chore(env): drop MAX_BOT_TOKEN/MAX_JOIN_CODE (RC owns notifications)"
```

---

### Task 1.8: Финальная проверка бэка

- [ ] **Step 1: Прогнать все тесты бэка**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npm run test
```

Expected: все тесты (cottages, seo, blog, reviews, images, sitemap, admin сокращённый) зелёные.

- [ ] **Step 2: Прогнать типы**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npx tsc --noEmit
```

Expected: 0 ошибок.

- [ ] **Step 3: Прогнать миграцию локально (dry-run)**

На текущей dev-БД:
```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npm run migrate
```

Проверить, что миграция применилась без ошибок (идемпотентно — `DROP TABLE IF EXISTS`).

- [ ] **Step 4: Поднять локально и проверить API**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npm run dev
```

В другом терминале:
```bash
curl http://localhost:3001/api/cottages | head -c 100
curl http://localhost:3001/api/reviews | head -c 100
curl http://localhost:3001/api/admin/login -X POST -H "Content-Type: application/json" -d "{\"password\":\"$ADMIN_PASSWORD\"}"
```

Expected: 200/401 как обычно, никаких 500.

- [ ] **Step 5: Полный билд фронта (с локальным бэком)**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run build
```

Expected: успешная сборка.

---

## Фаза 2 — Production deployment

### Task 2.1: Залить Фазу 0 на прод (если ещё не залита)

> Если Фаза 0 уже залита (промежуточный деплой) — пропустить.

- [ ] **Step 1: Собрать фронт**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run build
```

- [ ] **Step 2: Залить `dist/` на прод через FTP/SSH**

Стандартный деплой (см. внутреннюю инструкцию проекта).

- [ ] **Step 3: Smoke на проде (главная)**

Открыть сайт, проверить:
- CTA → RC работает.
- `/booking/<slug>` — лендинг без формы.

---

### Task 2.2: Применить миграцию и залить Фазу 1 на прод

**Where:** удалённый сервер.

- [ ] **Step 1: Залить изменения бэка**

Через git pull / scp / Ansible — стандартный деплой бэка.

- [ ] **Step 2: Остановить текущий бэк**

```bash
ssh user@server
systemctl stop zvuki-lesa-backend  # или pm2 stop, или как настроено
```

- [ ] **Step 3: Применить миграцию**

```bash
cd /path/to/ZvukiLesa/backend
npm run migrate
```

В логах должно быть `Dropping bookings`, `Dropping booking_services`, `Dropping notifications`, `Dropping max_subscribers`.

- [ ] **Step 4: Запустить бэк**

```bash
systemctl start zvuki-lesa-backend
# или: pm2 start ..., или npm run start
```

- [ ] **Step 5: Smoke API на проде**

```bash
curl https://zvuki-lesa.ru/api/cottages | head -c 200
curl https://zvuki-lesa.ru/api/reviews | head -c 200
curl -X POST https://zvuki-lesa.ru/api/bookings -H "Content-Type: application/json" -d '{}' -w "\n%{http_code}\n"
```

Expected:
- `/api/cottages` — 200.
- `/api/reviews` — 200.
- `/api/bookings` — 404.

- [ ] **Step 6: Smoke админки**

Зайти в `/admin/login`, убедиться, что вход работает и контентные разделы функциональны.

- [ ] **Step 7: Smoke публичного сайта**

- Главная: CTA → RC.
- `/booking/<slug>`: лендинг домика.
- `/seo/<slug>`: SEO-страница.
- `/blog/<slug>`: блог-пост.
- `/sitemap.xml`: не 500.

- [ ] **Step 8: Тестовая бронь через RC**

Открыть сайт, кликнуть CTA, дойти до формы RC, попробовать создать бронь. Проверить, что RC обрабатывает (у RC свои уведомления — это не наша зона).

---

### Task 2.3: Удалить MAX_BOT_TOKEN из `.env` на проде

- [ ] **Step 1: Отредактировать `.env` на сервере**

Удалить строки:
```
MAX_BOT_TOKEN=...
MAX_JOIN_CODE=...
```

- [ ] **Step 2: Перезапустить бэк**

```bash
systemctl restart zvuki-lesa-backend
```

---

## Фаза 3 — Documentation

### Task 3.1: Обновить `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Прочитать текущий `CLAUDE.md`**

Найти секции, которые относятся к удалённой системе:
- «Админка бронирований (с закрытым входом)»
- «Уведомления MAX (бот для владельца и жены)»
- «Дублирование бизнес-правил (следить за синхронностью)»
- В секции «Архитектура → Взаимодействие фронта и бэка» — упоминания `bookings`
- В секции «Два источника данных о домиках» — упоминания про цену

- [ ] **Step 2: Удалить/сократить эти секции**

- Удалить целиком секцию «Уведомления MAX».
- Удалить целиком секцию «Админка бронирований» (или сократить до упоминания, что админка только для контента).
- Удалить секцию «Дублирование бизнес-правил» (больше нет расчёта цены на фронте).
- В секции «Два источника данных» оставить только описание `cabins.ts` (убрать упоминания БД-источника про цены/доступность).

- [ ] **Step 3: Добавить новую секцию про RealtyCalendar-редирект**

После секции «Архитектура» добавить:

```markdown
### Бронирование через RealtyCalendar

Локальная система бронирования (БД `bookings`, `bookingServices`, MAX-бот, расчёт цены) удалена.
Все бронирования идут через RealtyCalendar — внешний channel manager.

- Кнопка бронирования: `<BookingCTA />` (`src/components/BookingCTA/BookingCTA.tsx`).
- URL бронирования: `RC_BOOKING_URL = "https://homereserve.ru/feEBPdLdgb"` (`src/lib/bookingRedirect.ts`).
- Хелпер для query: `rcBookingHref(params)` (если RC начнёт поддерживать предзаполнение дат).
- Кнопка открывается в новой вкладке (`target="_blank" rel="noopener noreferrer"`).

Что НЕ делается на нашем бэке:
- Нет таблицы броней, нет расчёта цены, нет проверки доступности дат, нет услуг-в-бронях, нет уведомлений о новых бронях.
- Админка бронирований удалена — все брони управляются в RealtyCalendar.
```

- [ ] **Step 4: Обновить секцию «Стек» (если нужно)**

Убрать из зависимостей что-то, что больше не используется. (Вряд ли — MAX был в `node:crypto`, без внешних пакетов.)

- [ ] **Step 5: Коммит**

```bash
git add CLAUDE.md
git commit -m "docs: replace booking system docs with RealtyCalendar section"
```

---

### Task 3.2: Удалить устаревшие спеки (опционально)

**Files:**
- Delete: `docs/superpowers/specs/2026-06-27-booking-system-design.md`
- Delete: `docs/superpowers/specs/2026-07-10-admin-booking-management-design.md`
- Delete: `docs/superpowers/specs/2026-07-18-telegram-notifications-design.md`

> Эти спеки описывают удалённую систему. Можно оставить для истории, но они вводят в заблуждение при будущих правках.

- [ ] **Step 1: Спросить себя (или пользователя): оставляем как историю или удаляем?**

- [ ] **Step 2: Если удаляем — `git rm` + коммит**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && git rm docs/superpowers/specs/2026-06-27-booking-system-design.md docs/superpowers/specs/2026-07-10-admin-booking-management-design.md docs/superpowers/specs/2026-07-18-telegram-notifications-design.md
git commit -m "docs(specs): remove obsolete booking/telegram/admin-booking specs"
```

---

### Task 3.3: Финальная верификация

- [ ] **Step 1: Полный прогон тестов + билд + lint**

```bash
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани" && npm run lint && npm run test && npm run build
cd "C:/Users/VallfIK/Desktop/Работа Сайты/Сайт Сани/backend" && npm run test
```

Expected: всё зелёное.

- [ ] **Step 2: Definition of Done — пройтись по чеклисту из спеки**

Открыть `docs/superpowers/specs/2026-09-19-realtycalendar-replacement-design.md` → секция «Чеклист Definition of Done». Пройти все 11 пунктов.

- [ ] **Step 3: Закоммитить plan completion note (если есть wiki/CHANGELOG)**

Опционально.

---

## Notes

- **TDD строгость** применяется там, где есть чистая логика: `bookingRedirect` (Task 0.1), `BookingCTA` (Task 0.2). Остальные таски — рефакторинг + удаление, тесты либо не нужны, либо проверяются через `npm run test` / `tsc --noEmit` / визуальную проверку.
- **Каждый коммит атомарен** — после него фронт/бэк должны собираться (`npm run build` / `npm run backend:dev`).
- **Фаза 0 → Фаза 2 step 1** — это безопасный промежуточный деплой (только фронт). Пользователи уже могут бронировать через RC, бэк ещё крутится вхолостую.
- **Фаза 1 + Фаза 2 step 2** — это финальное удаление, необратимо без бэкапа (см. Task 1.1).
- **Риски отката** минимальны на каждой фазе: можно откатить коммит и перезапустить бэк/фронт.
