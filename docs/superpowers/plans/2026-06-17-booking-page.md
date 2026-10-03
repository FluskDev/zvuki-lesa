# Booking Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить отдельную страницу `/booking/:cabinId` с галереей, sticky-панелью бронирования, информацией о домике и картой с подсветкой выбранного домика.

**Architecture:** React Router v6 разделяет лендинг (`/`) и страницу бронирования (`/booking/:cabinId`). Данные домиков переезжают в `lib/cabins.ts` (single source of truth). Переиспользуем `BookingDialog`, `CustomCalendar`, `SiteMap`. Логика валидации выносится в `lib/bookingRules.ts` с unit-тестами.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, Radix UI, react-router-dom, date-fns, lucide-react, sonner, embla-carousel-react, Vitest.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/cabins.ts` (new) | Тип `Cabin` + массив `CABINS` |
| `src/lib/bookingRules.ts` (new) | `calculateNights`, `hasWeekendOrHoliday`, `minNightsError` |
| `src/test/bookingRules.test.ts` (new) | Vitest тесты bookingRules |
| `src/pages/booking/BookingPage.tsx` (new) | Корневой компонент страницы |
| `src/pages/booking/TopBar.tsx` (new) | Шапка с кнопкой «Назад» |
| `src/pages/booking/BookingHero.tsx` (new) | Hero с галереей + StickyBookingPanel |
| `src/pages/booking/StickyBookingPanel.tsx` (new) | Правая sticky-панель с датами/гостями |
| `src/pages/booking/BookingInfo.tsx` (new) | «Основная информация» |
| `src/pages/booking/BookingAmenities.tsx` (new) | «Удобства» с «Показать все» |
| `src/pages/booking/BookingRecreation.tsx` (new) | «Отдых и досуг» карточки |
| `src/pages/booking/BookingAbout.tsx` (new) | «О домике» |
| `src/pages/booking/BookingMap.tsx` (new) | «Карта участка» (обёртка SiteMap) |
| `src/pages/booking/GalleryLightbox.tsx` (new) | Лайтбокс галереи (Radix Dialog) |
| `src/components/BookingDialog.tsx` (modify) | Использовать bookingRules, добавить `initialState` проп |
| `src/sections/Cabins.tsx` (modify) | Импорт CABINS из `lib/cabins.ts`, кнопка → navigate |
| `src/components/SiteMap/SiteMap.tsx` (modify) | Проп `highlightedMapId`, кнопка «Забронировать» → navigate |
| `src/components/SiteMap/SiteMap.css` (modify) | CSS-класс `.map-highlight` |
| `src/App.tsx` (modify) | Routes (лендинг + booking) |
| `src/main.tsx` (modify) | Обернуть в BrowserRouter |
| `package.json` (modify) | Добавить `react-router-dom` |
| `vitest.config.ts` (new) | Конфиг Vitest |

---

## Task 1: Install react-router-dom

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

Run:
```bash
npm install react-router-dom@^6
```

Expected: добавлено в `dependencies` в `package.json`, без ошибок.

- [ ] **Step 2: Verify install**

Run:
```bash
grep react-router-dom package.json
```

Expected: строка `"react-router-dom": "^6.x.x"`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-router-dom dependency"
```

---

## Task 2: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest and testing library**

Run:
```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: добавлены dev-dep, без ошибок.

- [ ] **Step 2: Create vitest.config.ts**

Create `vitest.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Create setup file**

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test script to package.json**

Edit `package.json`, в поле `"scripts"` добавить:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json package-lock.json
git commit -m "chore: configure vitest for unit and component tests"
```

---

## Task 3: Create lib/cabins.ts with extended Cabin data

**Files:**
- Create: `src/lib/cabins.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/cabins.ts`:
```ts
export type CabinMapId = 'Домик1' | 'Домик2' | 'Домик3';

export interface RecreationItem {
  id: number;
  title: string;
  photo: string;
  description: string;
}

export interface Cabin {
  id: number;
  mapId: CabinMapId;
  name: string;
  shortDescription: string;
  longDescription: string;
  price: number;
  area: number;
  guests: number;
  bedrooms: number;
  beds: { double: number; single: number };
  checkInTime: string;
  checkOutTime: string;
  rules: string[];
  amenities: string[];
  amenitiesHidden?: string[];
  recreation: RecreationItem[];
  gallery: string[];
  mainImage: string;
}

export const CABINS: Cabin[] = [
  {
    id: 1,
    mapId: 'Домик1',
    name: 'Шале Уют',
    shortDescription: 'Комфортабельный двухэтажный дом с панорамными окнами и видом на горы',
    longDescription:
      'Шале Уют — это уголок спокойствия в самом сердце Адыгеи. Двухэтажный дом с панорамными окнами, просторной террасой и собственным выходом к лесу. Идеально подходит для семейного отдыха или уединённой поездки вдвоём. Внутри — натуральное дерево, тёплые пледы и всё необходимое для комфортного отдыха в любое время года.',
    price: 4500,
    area: 49,
    guests: 5,
    bedrooms: 2,
    beds: { double: 2, single: 1 },
    checkInTime: '15:00 – 23:00',
    checkOutTime: 'до 12:00',
    rules: [
      'Громкая музыка запрещена',
      'Курение запрещено (Все виды)',
      'Можно с животными по согласованию',
    ],
    amenities: [
      'Площадь: 49 м²',
      'Кондиционирование / Система климат-контроля',
      'Халаты',
      'Тапочки',
      'Туалетно-косметические принадлежности',
      'Бассейн',
    ],
    amenitiesHidden: [
      'Всё необходимое для приготовления еды',
      'Минибар',
      'Wi-Fi',
      'Телевизор',
      'Фен',
      'Полотенца',
      'Посуда',
    ],
    recreation: [
      {
        id: 1,
        title: 'Банный чан на террасе',
        photo: '/images/recreation-chan.jpg',
        description: 'Горячий чан под открытым небом с видом на лес. Прогрев 1,5–2 часа.',
      },
      {
        id: 2,
        title: 'Рафтинг по реке Белой',
        photo: '/images/recreation-rafting.jpg',
        description: 'Сплав по горной реке с опытным инструктором. От 2 часов.',
      },
      {
        id: 3,
        title: 'Джип-тур в горы',
        photo: '/images/recreation-jeeptour.jpg',
        description: 'Экскурсия по горным дорогам Адыгеи с остановками у панорамных точек.',
      },
      {
        id: 4,
        title: 'Конные прогулки',
        photo: '/images/recreation-horse.jpg',
        description: 'Прогулка верхом по окрестным тропам. От 1 часа.',
      },
    ],
    gallery: [
      '/images/cabin1-1.jpg',
      '/images/cabin1-2.jpg',
      '/images/cabin1-3.jpg',
      '/images/cabin1-4.jpg',
      '/images/cabin1-5.jpg',
      '/images/cabin1-6.jpg',
    ],
    mainImage: '/images/cabin1-1.jpg',
  },
  {
    id: 2,
    mapId: 'Домик2',
    name: 'Лесная Резиденция',
    shortDescription: 'Уютный дом в окружении соснового леса с террасой',
    longDescription:
      'Лесная Резиденция — это место, где время замедляется. Дом утопает в зелени соснового леса, а с террасы открывается вид на вековые деревья. Идеальное место для тех, кто хочет уединиться от городской суеты, насладиться тишиной и свежим воздухом.',
    price: 3800,
    area: 42,
    guests: 4,
    bedrooms: 2,
    beds: { double: 1, single: 2 },
    checkInTime: '15:00 – 23:00',
    checkOutTime: 'до 12:00',
    rules: [
      'Громкая музыка запрещена',
      'Курение запрещено (Все виды)',
      'Можно с животными по согласованию',
    ],
    amenities: [
      'Площадь: 42 м²',
      'Кондиционирование',
      'Туалетно-косметические принадлежности',
      'Терраса с видом на лес',
      'Мангальная зона',
      'Wi-Fi',
    ],
    amenitiesHidden: [
      'Всё необходимое для приготовления еды',
      'Посуда',
      'Полотенца',
      'Фен',
    ],
    recreation: [
      {
        id: 1,
        title: 'Банный чан',
        photo: '/images/recreation-chan.jpg',
        description: 'Горячий чан под открытым небом.',
      },
      {
        id: 2,
        title: 'Рафтинг',
        photo: '/images/recreation-rafting.jpg',
        description: 'Сплав по реке Белой.',
      },
      {
        id: 3,
        title: 'Пешие маршруты',
        photo: '/images/recreation-hiking.jpg',
        description: 'Тропы по лесу и к горным ручьям.',
      },
    ],
    gallery: [
      '/images/cabin2-1.jpg',
      '/images/cabin2-2.jpg',
      '/images/cabin2-3.jpg',
      '/images/cabin2-4.jpg',
      '/images/cabin2-5.jpg',
    ],
    mainImage: '/images/cabin2-1.jpg',
  },
  {
    id: 3,
    mapId: 'Домик3',
    name: 'Горный Дом',
    shortDescription: 'Каждый день начинается с вида на Кавказские горы',
    longDescription:
      'Горный Дом — для тех, кто ценит панорамные виды. Большие окна от пола до потолка, просторная терраса и камин в гостиной. Здесь вы будете просыпаться с видом на заснеженные вершины и засыпать под звёздным небом Кавказа.',
    price: 5200,
    area: 65,
    guests: 6,
    bedrooms: 3,
    beds: { double: 2, single: 2 },
    checkInTime: '15:00 – 23:00',
    checkOutTime: 'до 12:00',
    rules: [
      'Громкая музыка запрещена',
      'Курение запрещено (Все виды)',
      'Можно с животными по согласованию',
    ],
    amenities: [
      'Площадь: 65 м²',
      'Кондиционирование / Система климат-контроля',
      'Камин',
      'Халаты и тапочки',
      'Туалетно-косметические принадлежности',
      'Бассейн',
    ],
    amenitiesHidden: [
      'Всё необходимое для приготовления еды',
      'Минибар',
      'Wi-Fi',
      'Телевизор',
      'Фен',
      'Полотенца',
      'Посуда',
      'Гриль-зона',
    ],
    recreation: [
      {
        id: 1,
        title: 'Банный чан',
        photo: '/images/recreation-chan.jpg',
        description: 'Горячий чан на террасе с панорамным видом.',
      },
      {
        id: 2,
        title: 'Рафтинг',
        photo: '/images/recreation-rafting.jpg',
        description: 'Сплав по горной реке.',
      },
      {
        id: 3,
        title: 'Джип-тур',
        photo: '/images/recreation-jeeptour.jpg',
        description: 'Экскурсия в горы.',
      },
      {
        id: 4,
        title: 'Конные прогулки',
        photo: '/images/recreation-horse.jpg',
        description: 'Верховая прогулка по горным тропам.',
      },
    ],
    gallery: [
      '/images/cabin3-1.jpg',
      '/images/cabin3-2.jpg',
      '/images/cabin3-3.jpg',
      '/images/cabin3-4.jpg',
      '/images/cabin3-5.jpg',
      '/images/cabin3-6.jpg',
    ],
    mainImage: '/images/cabin3-1.jpg',
  },
];

export function getCabinById(id: number | undefined): Cabin | undefined {
  if (id === undefined) return undefined;
  return CABINS.find((c) => c.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cabins.ts
git commit -m "feat: add extended cabins data with amenities, recreation, gallery"
```

---

## Task 4: Create lib/bookingRules.ts with TDD

**Files:**
- Create: `src/test/bookingRules.test.ts` (test first)
- Create: `src/lib/bookingRules.ts`

- [ ] **Step 1: Write failing tests**

Create `src/test/bookingRules.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calculateNights, hasWeekendOrHoliday, getMinNightsError } from '@/lib/bookingRules';

describe('calculateNights', () => {
  it('returns 0 when checkIn or checkOut undefined', () => {
    expect(calculateNights(undefined, new Date('2026-06-17'))).toBe(0);
    expect(calculateNights(new Date('2026-06-17'), undefined)).toBe(0);
    expect(calculateNights(undefined, undefined)).toBe(0);
  });

  it('returns positive nights when checkOut is after checkIn', () => {
    const inDate = new Date('2026-06-17');
    const outDate = new Date('2026-06-20');
    expect(calculateNights(inDate, outDate)).toBe(3);
  });

  it('returns 0 when checkOut is on the same day as checkIn', () => {
    const date = new Date('2026-06-17');
    expect(calculateNights(date, date)).toBe(0);
  });

  it('returns negative nights when checkOut is before checkIn', () => {
    const inDate = new Date('2026-06-20');
    const outDate = new Date('2026-06-17');
    expect(calculateNights(inDate, outDate)).toBeLessThan(0);
  });
});

describe('hasWeekendOrHoliday', () => {
  it('returns true for Saturday', () => {
    // 2026-06-20 is a Saturday
    expect(hasWeekendOrHoliday(new Date('2026-06-20'), new Date('2026-06-20'))).toBe(true);
  });

  it('returns true for Sunday', () => {
    // 2026-06-21 is a Sunday
    expect(hasWeekendOrHoliday(new Date('2026-06-21'), new Date('2026-06-21'))).toBe(true);
  });

  it('returns false for a regular weekday', () => {
    // 2026-06-17 is a Wednesday
    expect(hasWeekendOrHoliday(new Date('2026-06-17'), new Date('2026-06-17'))).toBe(false);
  });

  it('returns true if any day in range is a weekend', () => {
    // Wed → Sat
    expect(hasWeekendOrHoliday(new Date('2026-06-17'), new Date('2026-06-20'))).toBe(true);
  });

  it('returns true for Russian holiday', () => {
    // 2026-01-01 is a holiday
    expect(hasWeekendOrHoliday(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(true);
  });
});

describe('getMinNightsError', () => {
  it('returns null when dates undefined', () => {
    expect(getMinNightsError(undefined, undefined)).toBeNull();
  });

  it('returns null when range is 2+ nights', () => {
    expect(getMinNightsError(new Date('2026-06-19'), new Date('2026-06-21'))).toBeNull();
  });

  it('returns message when 1 night in weekend', () => {
    const msg = getMinNightsError(new Date('2026-06-19'), new Date('2026-06-20'));
    expect(msg).toMatch(/минимум|2 суток|2 дней/i);
  });

  it('returns null when 1 night in regular weekday range', () => {
    expect(getMinNightsError(new Date('2026-06-17'), new Date('2026-06-18'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: ошибки импорта (`bookingRules` не существует).

- [ ] **Step 3: Implement bookingRules.ts**

Create `src/lib/bookingRules.ts`:
```ts
// Праздничные дни в России (месяц, день)
const RUSSIAN_HOLIDAYS: Array<{ month: number; day: number }> = [
  { month: 1, day: 1 }, { month: 1, day: 2 }, { month: 1, day: 3 },
  { month: 1, day: 4 }, { month: 1, day: 5 }, { month: 1, day: 6 },
  { month: 1, day: 7 }, { month: 1, day: 8 },
  { month: 2, day: 23 },
  { month: 3, day: 8 },
  { month: 5, day: 1 }, { month: 5, day: 9 },
  { month: 6, day: 12 },
  { month: 11, day: 4 },
];

const isWeekendOrHoliday = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return RUSSIAN_HOLIDAYS.some((h) => h.month === month && h.day === day);
};

/**
 * Проверяет, попадает ли диапазон дат на выходные или праздники (включая день выезда)
 */
export function hasWeekendOrHoliday(checkIn: Date | undefined, checkOut: Date | undefined): boolean {
  if (!checkIn || !checkOut) return false;
  const current = new Date(checkIn);
  current.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    if (isWeekendOrHoliday(current)) return true;
    current.setDate(current.getDate() + 1);
  }
  return false;
}

/**
 * Рассчитывает количество ночей между датами
 */
export function calculateNights(checkIn: Date | undefined, checkOut: Date | undefined): number {
  if (!checkIn || !checkOut) return 0;
  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Возвращает сообщение об ошибке минимального бронирования или null
 */
export function getMinNightsError(checkIn: Date | undefined, checkOut: Date | undefined): string | null {
  if (!checkIn || !checkOut) return null;
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 2 && hasWeekendOrHoliday(checkIn, checkOut)) {
    return 'В выходные и праздничные дни минимальное бронирование — от 2 суток';
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: все тесты `bookingRules.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test/bookingRules.test.ts src/lib/bookingRules.ts
git commit -m "feat: add bookingRules with weekend/holiday and nights logic"
```

---

## Task 5: Refactor BookingDialog to use bookingRules

**Files:**
- Modify: `src/components/BookingDialog.tsx`

- [ ] **Step 1: Update imports**

В начале файла `src/components/BookingDialog.tsx` заменить:
```ts
import { useState, useEffect, useMemo } from 'react';
```
на:
```ts
import { useState, useEffect, useMemo } from 'react';
```

Заменить:
```ts
import { Check, Loader2, Waves, Mountain, Flame, CalendarIcon, HelpCircle } from 'lucide-react';
```
на:
```ts
import { Check, Loader2, Waves, Mountain, Flame, CalendarIcon, HelpCircle } from 'lucide-react';
```

Заменить:
```ts
import { createBooking, getBookedDates, getServices, type Service } from '@/lib/api';
```
на:
```ts
import { createBooking, getBookedDates, getServices, type Service } from '@/lib/api';
import { calculateNights, hasWeekendOrHoliday, getMinNightsError } from '@/lib/bookingRules';
```

- [ ] **Step 2: Удалить локальные константы RUSSIAN_HOLIDAYS, isWeekendOrHoliday, hasWeekendOrHoliday**

Удалить в `BookingDialog.tsx`:
- Константу `RUSSIAN_HOLIDAYS` (строки 22-31).
- Функцию `isWeekendOrHoliday` (строки 34-43).
- Функцию `hasWeekendOrHoliday` (строки 46-58).

- [ ] **Step 3: Обновить useEffect для weekendWarning**

Найти useEffect (был на ~117 строке):
```ts
useEffect(() => {
  if (checkIn && checkOut) {
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (nights < 2 && hasWeekendOrHoliday(checkIn, checkOut)) {
      setWeekendWarning('В выходные и праздничные дни минимальное бронирование — от 2 дней');
    } else {
      setWeekendWarning(null);
    }
  } else {
    setWeekendWarning(null);
  }
}, [checkIn, checkOut]);
```

Заменить на:
```ts
useEffect(() => {
  setWeekendWarning(getMinNightsError(checkIn, checkOut));
}, [checkIn, checkOut]);
```

- [ ] **Step 4: Удалить локальный calculateNights**

Удалить метод `calculateNights` (был ~161 строки):
```ts
const calculateNights = () => {
  if (!checkIn || !checkOut) return 0;
  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
};
```

Заменить все вызовы `calculateNights()` в файле на `calculateNights(checkIn, checkOut)`.

Всего таких вызовов будет в JSX:
- `{calculateNights() > 0 && ...}` → `{calculateNights(checkIn, checkOut) > 0 && ...}` (1 раз)
- `{calculateNights()} {calculateNights() === 1 ? ... : calculateNights() < 5 ? ... : ...}` → переписать с переменной:
- `{calculateNights() < 2 && hasWeekendOrHoliday(checkIn, checkOut)}` → `{getMinNightsError(checkIn, checkOut)}` в `handleSubmit`.

Чтобы было чисто, в `handleSubmit` заменить:
```ts
if (calculateNights() <= 0) {
  toast.error('Дата выезда должна быть позже даты заезда');
  return;
}

// Проверка минимального бронирования в выходные/праздничные дни
if (calculateNights() < 2 && hasWeekendOrHoliday(checkIn, checkOut)) {
  toast.error('В выходные и праздничные дни минимальное бронирование — от 2 суток');
  return;
}
```

На:
```ts
if (calculateNights(checkIn, checkOut) <= 0) {
  toast.error('Дата выезда должна быть позже даты заезда');
  return;
}

const minError = getMinNightsError(checkIn, checkOut);
if (minError) {
  toast.error(minError);
  return;
}
```

И в JSX-блоке «Итого»:
```tsx
{calculateNights() > 0 && (
  <div className="bg-stone-50 p-4 rounded-lg space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-stone-600">Проживание ({calculateNights()} {calculateNights() === 1 ? 'день' : calculateNights() < 5 ? 'дня' : 'дней'})</span>
```

Заменить на:
```tsx
{nights > 0 && (
  <div className="bg-stone-50 p-4 rounded-lg space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-stone-600">Проживание ({nights} {nights === 1 ? 'день' : nights < 5 ? 'дня' : 'дней'})</span>
```

И добавить в начало компонента (после `if (!cabin) return null;`):
```ts
const nights = calculateNights(checkIn, checkOut);
const calculateCabinTotal = () => nights * cabin.price;
```

(вычисление `nights` нужно перед `calculateCabinTotal`).

- [ ] **Step 5: Добавить проп initialState**

В интерфейсе `BookingDialogProps`:
```ts
interface BookingDialogProps {
  cabin: Cabin | null;
  isOpen: boolean;
  onClose: () => void;
}
```

Добавить:
```ts
interface BookingDialogProps {
  cabin: Cabin | null;
  isOpen: boolean;
  onClose: () => void;
  initialState?: {
    checkIn?: Date;
    checkOut?: Date;
    guests?: number;
  };
}
```

В сигнатуре функции добавить параметр:
```ts
export function BookingDialog({ cabin, isOpen, onClose, initialState }: BookingDialogProps) {
```

В `resetForm()` (был ~257) добавить сброс гостей:
```ts
const resetForm = () => {
  setName('');
  setPhone('');
  setEmail('');
  setCheckIn(undefined);
  setCheckOut(undefined);
  setGuests('2');
  setNotes('');
  setSelectedServices(new Set());
};
```

Заменить на:
```ts
const resetForm = () => {
  setName('');
  setPhone('');
  setEmail('');
  setCheckIn(initialState?.checkIn);
  setCheckOut(initialState?.checkOut);
  setGuests(String(initialState?.guests ?? 2));
  setNotes('');
  setSelectedServices(new Set());
};
```

- [ ] **Step 6: Применять initialState при открытии**

Найти useEffect, который загружает данные:
```ts
useEffect(() => {
  if (isOpen && cabin) {
```

Добавить в начало блока:
```ts
if (initialState?.checkIn) setCheckIn(initialState.checkIn);
if (initialState?.checkOut) setCheckOut(initialState.checkOut);
if (initialState?.guests) setGuests(String(initialState.guests));
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: успешная компиляция TypeScript без ошибок.

- [ ] **Step 8: Commit**

```bash
git add src/components/BookingDialog.tsx
git commit -m "refactor: use shared bookingRules and add initialState prop to BookingDialog"
```

---

## Task 6: Refactor Cabins.tsx to use CABINS from lib

**Files:**
- Modify: `src/sections/Cabins.tsx`

- [ ] **Step 1: Удалить локальный массив и интерфейс**

Удалить в `src/sections/Cabins.tsx`:
- `interface Cabin { ... }` (строки 4-13).
- `const cabins: Cabin[] = [ ... ]` (строки 15-46).
- `Bed, Bath` из импорта `lucide-react` (если не используются).

- [ ] **Step 2: Добавить импорт и useNavigate**

В начало файла добавить:
```ts
import { useNavigate } from 'react-router-dom';
import { CABINS } from '@/lib/cabins';
```

- [ ] **Step 3: Использовать CABINS в компоненте**

В `export function Cabins()` добавить:
```ts
export function Cabins() {
  const navigate = useNavigate();
  return (
    // ... существующий JSX
    // заменить `cabins.map(...)` на `CABINS.map(...)`
```

В `MiniCabinCard` заменить тип:
```ts
function MiniCabinCard({ cabin }: { cabin: Cabin }) {
```
на:
```ts
function MiniCabinCard({ cabin }: { cabin: typeof CABINS[number] }) {
```

- [ ] **Step 4: Заменить кнопку «price» на «Забронировать»**

В `MiniCabinCard` заменить:
```tsx
<button
  style={{ /* ... */ }}
>
  <span>{cabin.price.toLocaleString()}₽</span>
  <span> c 01.06</span>
</button>
```

На:
```tsx
<button
  onClick={() => navigate(`/booking/${cabin.id}`)}
  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-4 px-8 rounded-full transition-colors w-full"
>
  Забронировать
</button>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: успешная компиляция.

- [ ] **Step 6: Commit**

```bash
git add src/sections/Cabins.tsx
git commit -m "refactor: source cabins from lib/cabins and add book button"
```

---

## Task 7: Extend SiteMap with highlightedMapId prop

**Files:**
- Modify: `src/components/SiteMap/SiteMap.tsx`
- Modify: `src/components/SiteMap/SiteMap.css`

- [ ] **Step 1: Добавить пропс**

В `SiteMap.tsx`:
```ts
export function SiteMap() {
```

Заменить на:
```ts
export function SiteMap({ highlightedMapId }: { highlightedMapId?: MapElement }) {
  const navigate = useNavigate();
  // ... существующий код
```

Добавить импорт в начало:
```ts
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Применять класс подсветки**

Найти useEffect с handleClick (был ~65 строки). Добавить внутри (после установки selectedElement, или в новом эффекте):

Добавить новый useEffect:
```ts
useEffect(() => {
  if (!svgContent) return;
  const container = document.querySelector('.site-map-container');
  if (!container) return;
  // убрать старую подсветку
  container.querySelectorAll('.map-highlight').forEach((el) => el.classList.remove('map-highlight'));
  if (highlightedMapId) {
    const group = container.querySelector(`g[id="_${highlightedMapId}"]`);
    if (group) group.classList.add('map-highlight');
  }
}, [svgContent, highlightedMapId]);
```

- [ ] **Step 3: Сделать кнопку «Забронировать» рабочей**

Найти:
```tsx
{data && data.hasButton && (
  <div className="flex justify-center pt-4">
    <Button className="bg-green-600 hover:bg-green-700 text-white px-8">
      Забронировать
    </Button>
  </div>
)}
```

Заменить на:
```tsx
{data && data.hasButton && (
  <div className="flex justify-center pt-4">
    <Button
      className="bg-green-600 hover:bg-green-700 text-white px-8"
      onClick={() => {
        const cabin = CABINS.find((c) => c.mapId === data.id);
        if (cabin) navigate(`/booking/${cabin.id}`);
      }}
    >
      Забронировать
    </Button>
  </div>
)}
```

Добавить импорт:
```ts
import { CABINS } from '@/lib/cabins';
```

- [ ] **Step 4: Добавить CSS-класс подсветки**

В `src/components/SiteMap/SiteMap.css` добавить:
```css
.map-highlight {
  filter: drop-shadow(0 0 12px #FACC15) drop-shadow(0 0 24px rgba(250, 204, 21, 0.5));
}
.map-highlight path,
.map-highlight polygon,
.map-highlight rect,
.map-highlight circle,
.map-highlight ellipse {
  fill: #FACC15 !important;
  stroke: #CA8A04 !important;
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: успешная компиляция.

- [ ] **Step 6: Commit**

```bash
git add src/components/SiteMap/SiteMap.tsx src/components/SiteMap/SiteMap.css
git commit -m "feat: highlight cabin on SiteMap and add booking navigation"
```

---

## Task 8: Wrap App with Router

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update main.tsx**

В `src/main.tsx` обернуть рендер:
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Заменить на:
```tsx
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Update App.tsx**

В `src/App.tsx`:
```tsx
import { Toaster } from '@/components/ui/sonner';
import { Navigation } from '@/sections/Navigation';
// ...
```

Добавить импорт:
```tsx
import { Routes, Route } from 'react-router-dom';
import { BookingPage } from '@/pages/booking/BookingPage';
```

Обернуть рендер:
```tsx
return (
  <>
    <Toaster position="top-center" richColors />
    <Routes>
      <Route path="/" element={
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
                <Reviews />
                <ContactUsLanding />
              </main>
            </SnapScroll>
          </div>
          <StickyFooter />
        </>
      } />
      <Route path="/booking/:cabinId" element={<BookingPage />} />
    </Routes>
  </>
);
```

(Заменить существующий `return` целиком.)

- [ ] **Step 3: Commit (без проверки — BookingPage ещё нет)**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: wire react-router in main and add /booking route"
```

---

## Task 9: Create TopBar component

**Files:**
- Create: `src/pages/booking/TopBar.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/TopBar.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TopBar() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 bg-[#0E0E10]/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">На главную</span>
        </button>
        <span className="text-white/60 text-sm">Звуки леса</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/TopBar.tsx
git commit -m "feat: add TopBar with back button for booking page"
```

---

## Task 10: Create StickyBookingPanel

**Files:**
- Create: `src/pages/booking/StickyBookingPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/StickyBookingPanel.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarIcon, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomCalendar } from '@/components/CustomCalendar';
import { BookingDialog } from '@/components/BookingDialog';
import { calculateNights, getMinNightsError } from '@/lib/bookingRules';
import { getBookedDates } from '@/lib/api';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function StickyBookingPanel({ cabin }: Props) {
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guests, setGuests] = useState(cabin.guests);
  const [bookedDates, setBookedDates] = useState<{ start_date: string; end_date: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    getBookedDates(cabin.id).then((r) => {
      if (r.success) setBookedDates(r.booked_dates);
    });
  }, [cabin.id]);

  const nights = calculateNights(checkIn, checkOut);
  const total = nights * cabin.price;
  const warning = getMinNightsError(checkIn, checkOut);

  return (
    <>
      <div className="lg:sticky lg:top-24 bg-[#1A1A1E] border border-white/5 rounded-2xl p-6 space-y-5">
        <div>
          <p className="text-sm text-white/60">от</p>
          <p className="text-3xl font-bold text-white">
            {cabin.price.toLocaleString('ru-RU')} ₽
            <span className="text-base font-normal text-white/60"> / сутки</span>
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-white/80">Даты проживания</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left">
                <CalendarIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  {checkIn && checkOut ? (
                    <>
                      <p className="text-white">
                        {format(checkIn, 'dd MMM', { locale: ru })} — {format(checkOut, 'dd MMM', { locale: ru })}
                      </p>
                      <p className="text-white/60 text-xs">
                        {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}
                      </p>
                    </>
                  ) : (
                    <p className="text-white/60">Выберите даты заезда и выезда</p>
                  )}
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CustomCalendar
                selectedStart={checkIn}
                selectedEnd={checkOut}
                onSelectStart={setCheckIn}
                onSelectEnd={setCheckOut}
                bookedDates={bookedDates}
                minDate={new Date()}
                warningMessage={warning}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="guests" className="text-white/80">Количество гостей</Label>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-white/60" />
            <Input
              id="guests"
              type="number"
              min={1}
              max={cabin.guests}
              value={guests}
              onChange={(e) => setGuests(Math.max(1, Math.min(cabin.guests, Number(e.target.value) || 1)))}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        {nights > 0 && (
          <div className="border-t border-white/10 pt-4 space-y-1 text-sm">
            <div className="flex justify-between text-white/70">
              <span>{cabin.price.toLocaleString('ru-RU')} ₽ × {nights} ноч.</span>
              <span>{total.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex justify-between font-bold text-white text-base pt-2">
              <span>Итого</span>
              <span className="text-emerald-400">{total.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        )}

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6"
          disabled={nights <= 0}
          onClick={() => setDialogOpen(true)}
        >
          {nights > 0 ? 'Забронировать' : 'Выберите даты'}
        </Button>

        {warning && nights > 0 && (
          <p className="text-xs text-amber-400 text-center">{warning}</p>
        )}
      </div>

      <BookingDialog
        cabin={cabin}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialState={{ checkIn, checkOut, guests }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/StickyBookingPanel.tsx
git commit -m "feat: add StickyBookingPanel with date/guest selection"
```

---

## Task 11: Create GalleryLightbox

**Files:**
- Create: `src/pages/booking/GalleryLightbox.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/GalleryLightbox.tsx`:
```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface Props {
  images: string[];
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}

export function GalleryLightbox({ images, open, onClose, initialIndex = 0 }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-black/95 border-white/10 p-0">
        <Carousel opts={{ startIndex: initialIndex, loop: true }}>
          <CarouselContent>
            {images.map((src, i) => (
              <CarouselItem key={i}>
                <img
                  src={src}
                  alt={`Фото ${i + 1}`}
                  className="w-full h-[80vh] object-contain"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4" />
          <CarouselNext className="right-4" />
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/GalleryLightbox.tsx
git commit -m "feat: add GalleryLightbox with embla carousel"
```

---

## Task 12: Create BookingHero

**Files:**
- Create: `src/pages/booking/BookingHero.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/BookingHero.tsx`:
```tsx
import { useState } from 'react';
import { Expand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StickyBookingPanel } from './StickyBookingPanel';
import { GalleryLightbox } from './GalleryLightbox';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingHero({ cabin }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const visibleImages = cabin.gallery.slice(0, 5);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">{cabin.name}</h1>
          <p className="text-lg text-white/70 mb-6">{cabin.shortDescription}</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {visibleImages.map((src, i) => (
              <button
                key={i}
                onClick={() => openLightbox(i)}
                className={`relative overflow-hidden rounded-xl group ${
                  i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto md:row-span-2' : 'aspect-square'
                }`}
              >
                <img
                  src={src}
                  alt={`${cabin.name} фото ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {i === visibleImages.length - 1 && cabin.gallery.length > visibleImages.length && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium">
                    +{cabin.gallery.length - visibleImages.length} фото
                  </div>
                )}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={() => openLightbox(0)}
            className="mt-4 border-white/20 text-white hover:bg-white/5"
          >
            <Expand className="w-4 h-4 mr-2" />
            Показать все фото
          </Button>
        </div>

        <StickyBookingPanel cabin={cabin} />
      </div>

      <GalleryLightbox
        images={cabin.gallery}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        initialIndex={lightboxIndex}
      />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/BookingHero.tsx
git commit -m "feat: add BookingHero with gallery grid and sticky panel"
```

---

## Task 13: Create BookingInfo section

**Files:**
- Create: `src/pages/booking/BookingInfo.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/BookingInfo.tsx`:
```tsx
import { Users, BedDouble, SingleBed, Bed, Clock, VolumeX, CigaretteOff, PawPrint } from 'lucide-react';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

const RULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Громкая музыка запрещена': VolumeX,
  'Курение запрещено (Все виды)': CigaretteOff,
  'Можно с животными по согласованию': PawPrint,
};

export function BookingInfo({ cabin }: Props) {
  const items = [
    { icon: Users, text: `До ${cabin.guests} гостей` },
    { icon: BedDouble, text: `${cabin.beds.double} двуспальные кровати` },
    ...(cabin.beds.single > 0
      ? [{ icon: SingleBed, text: `${cabin.beds.single} односпальная кровать` }]
      : []),
    { icon: Bed, text: `${cabin.bedrooms} ${cabin.bedrooms === 1 ? 'спальня' : 'спальни'}` },
    { icon: Clock, text: `Заезд: ${cabin.checkInTime} / Выезд ${cabin.checkOutTime}` },
    ...cabin.rules.map((rule) => ({
      icon: RULE_ICONS[rule] || VolumeX,
      text: rule,
    })),
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-8">Основная информация</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-white/90">{item.text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/BookingInfo.tsx
git commit -m "feat: add BookingInfo section with icons"
```

---

## Task 14: Create BookingAmenities section

**Files:**
- Create: `src/pages/booking/BookingAmenities.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/BookingAmenities.tsx`:
```tsx
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingAmenities({ cabin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hidden = cabin.amenitiesHidden ?? [];
  const hasHidden = hidden.length > 0;
  const visible = expanded ? [...cabin.amenities, ...hidden] : cabin.amenities;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-8">Удобства</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
        {visible.map((amenity, i) => (
          <div key={i} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span className="text-white/90">{amenity}</span>
          </div>
        ))}
      </div>
      {hasHidden && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-6 inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {expanded ? 'Скрыть' : 'Показать все'}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/BookingAmenities.tsx
git commit -m "feat: add BookingAmenities with expand toggle"
```

---

## Task 15: Create BookingRecreation section

**Files:**
- Create: `src/pages/booking/BookingRecreation.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/BookingRecreation.tsx`:
```tsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingRecreation({ cabin }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-8">Отдых и досуг</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cabin.recreation.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className="bg-[#1A1A1E] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={item.photo} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-4 flex flex-col gap-3">
                <h3 className="font-medium text-white">{item.title}</h3>
                {isOpen && (
                  <p className="text-sm text-white/70">{item.description}</p>
                )}
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="mt-auto inline-flex items-center justify-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {isOpen ? 'Скрыть' : 'Описание'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/BookingRecreation.tsx
git commit -m "feat: add BookingRecreation cards with description toggle"
```

---

## Task 16: Create BookingAbout section

**Files:**
- Create: `src/pages/booking/BookingAbout.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/BookingAbout.tsx`:
```tsx
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingAbout({ cabin }: Props) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-6">О домике</h2>
      <p className="text-lg text-white/80 leading-relaxed mb-8 max-w-3xl">
        {cabin.longDescription}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Площадь</p>
          <p className="text-xl font-bold text-white">{cabin.area} м²</p>
        </div>
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Спален</p>
          <p className="text-xl font-bold text-white">{cabin.bedrooms}</p>
        </div>
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Гостей</p>
          <p className="text-xl font-bold text-white">до {cabin.guests}</p>
        </div>
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Заезд</p>
          <p className="text-xl font-bold text-white">{cabin.checkInTime}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/BookingAbout.tsx
git commit -m "feat: add BookingAbout section with stats"
```

---

## Task 17: Create BookingMap section

**Files:**
- Create: `src/pages/booking/BookingMap.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/BookingMap.tsx`:
```tsx
import { SiteMap } from '@/components/SiteMap/SiteMap';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingMap({ cabin }: Props) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-6">Карта участка</h2>
      <p className="text-white/70 mb-6">
        Ваш домик выделен жёлтым на карте.
      </p>
      <div className="aspect-[16/10] bg-[#1A1A1E] border border-white/5 rounded-2xl overflow-hidden">
        <SiteMap highlightedMapId={cabin.mapId} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/booking/BookingMap.tsx
git commit -m "feat: add BookingMap section reusing SiteMap with highlight"
```

---

## Task 18: Create BookingPage that composes sections

**Files:**
- Create: `src/pages/booking/BookingPage.tsx`

- [ ] **Step 1: Create the component**

Create `src/pages/booking/BookingPage.tsx`:
```tsx
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getCabinById } from '@/lib/cabins';
import { TopBar } from './TopBar';
import { BookingHero } from './BookingHero';
import { BookingInfo } from './BookingInfo';
import { BookingAmenities } from './BookingAmenities';
import { BookingRecreation } from './BookingRecreation';
import { BookingAbout } from './BookingAbout';
import { BookingMap } from './BookingMap';

export function BookingPage() {
  const { cabinId } = useParams<{ cabinId: string }>();
  const cabin = getCabinById(cabinId ? Number(cabinId) : undefined);

  if (!cabin) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Домик не найден</h1>
          <p className="text-white/70 mb-8">К сожалению, запрашиваемый домик не существует.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E10]">
      <TopBar />
      <BookingHero cabin={cabin} />
      <BookingInfo cabin={cabin} />
      <BookingAmenities cabin={cabin} />
      <BookingRecreation cabin={cabin} />
      <BookingAbout cabin={cabin} />
      <BookingMap cabin={cabin} />
      <footer className="border-t border-white/5 mt-12 py-8 text-center text-white/40 text-sm">
        © Звуки леса, {new Date().getFullYear()}
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: успешная компиляция.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
Expected: открывается `http://localhost:5173`, лендинг работает. Перейти на `/booking/1` — открывается страница с шале. Перейти на `/booking/99` — показывает «Домик не найден».

- [ ] **Step 4: Commit**

```bash
git add src/pages/booking/BookingPage.tsx
git commit -m "feat: compose BookingPage with all sections and 404 fallback"
```

---

## Task 19: Final verification

**Files:** none

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: все тесты проходят.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: без ошибок (предупреждения допустимы).

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: успешная сборка.

- [ ] **Step 4: Manual e2e checklist**

- [ ] На главной нажать «Забронировать» на карточке → переход на `/booking/:id`.
- [ ] На странице нажать «← На главную» → возврат.
- [ ] Открыть карту участка, нажать «Забронировать» → переход на страницу.
- [ ] На странице выбрать даты → расчёт стоимости.
- [ ] Нажать «Забронировать» → открывается диалог с предзаполненными датами.
- [ ] Заполнить и отправить форму → toast.
- [ ] Карта внизу страницы подсвечивает выбранный домик жёлтым.
- [ ] `/booking/999` показывает 404.

- [ ] **Step 5: Final commit (если были мелкие правки)**

```bash
git status
git add -A
git commit -m "chore: final fixes after e2e check" --allow-empty
```

---

## Self-Review

После написания плана проверил:

1. **Spec coverage:**
   - Архитектура (роутинг, источник данных, переиспользование BookingDialog) → Tasks 1, 3, 5, 6, 7, 8.
   - Структура страницы (TopBar, Hero, Info, Amenities, Recreation, About, Map) → Tasks 9-18.
   - Адаптив (≥1024 / <1024) → реализован в Task 12 (`grid-cols-1 lg:grid-cols-[1fr_400px]`) и Task 10 (sticky на lg).
   - 404 → Task 18.
   - Лайтбокс «Показать все фото» → Task 11, 12.
   - Подсветка карты → Tasks 7, 17.
   - Логика бронирования → Task 10.
   - Визуальный стиль → все секции используют тёмные цвета.
   - Зависимости → Task 1.
   - Тестирование → Tasks 2, 4, 19.
   - YAGNI → соблюдён (нет платёжки, админки, i18n).

2. **Placeholder scan:** нет «TBD», «TODO», «add appropriate handling» — везде конкретный код.

3. **Type consistency:** `Cabin` импортируется из `@/lib/cabins` во всех местах одинаково. `calculateNights`, `hasWeekendOrHoliday`, `getMinNightsError` — те же имена в `bookingRules.ts`, тестах, `BookingDialog` и `StickyBookingPanel`. `MapElement` в `SiteMap` остаётся локальным типом, `highlightedMapId` принимает его.

Всё ок.
