# Страница бронирования домика — Design

**Дата:** 2026-06-17
**Статус:** Утверждён

## Цель

Добавить отдельную страницу `/booking/:cabinId` для выбранного домика. Страница содержит подробную информацию о домике, галерею, выбор дат и гостей, форму бронирования и карту участка с подсветкой выбранного домика.

## Архитектура

- **Роутинг:** `react-router-dom` v6+. BrowserRouter в `main.tsx` (или `App.tsx`).
  - `/` — лендинг (SnapScroll)
  - `/booking/:cabinId` — страница бронирования
- **Точка входа:** нажатие кнопки «Забронировать» в карточке домика (`Cabins.tsx`) или в диалоге на карте (`SiteMap.tsx`) → `navigate('/booking/' + cabinId)`.
- **Кнопка «Назад»** на странице бронирования → `navigate('/')`.
- **Источник данных:** новый файл `src/lib/cabins.ts` — массив `CABINS` с расширенной типизацией. `Cabins.tsx` импортирует данные оттуда (убираем дублирование). `SiteMap.tsx` также использует `mapId` из тех же данных.
- **Существующий `BookingDialog`** остаётся и переиспользуется на странице бронирования. Открывается из Sticky-панели, ему передаются выбранные даты/гости через проп `initialState?: { checkIn?: Date; checkOut?: Date; guests?: number }`.

## Структура страницы

```
TopBar (sticky)
├── Логотип
└── Кнопка «← На главную»

BookingHero
├── Левая колонка
│   ├── Название домика (h1)
│   ├── Краткое описание
│   ├── Галерея (сетка 2×3 или carousel)
│   └── Кнопка «Показать все фото»
└── Правая колонка (sticky, top: 80px)
    ├── Выбор дат заезда/выезда (Popover + CustomCalendar)
    ├── Кол-во гостей (Input number)
    ├── Расчёт стоимости
    └── Кнопка «Забронировать» → открывает BookingDialog

BookingInfo — «Основная информация»
└── Сетка 2 колонки: иконка + пункт
    (гости, кровати, спальни, заезд/выезд, правила)

BookingAmenities — «Удобства»
└── Список с галочками. При >6 пунктах — кнопка «Показать все»

BookingRecreation — «Отдых и досуг»
└── Сетка карточек 3-4 колонки
    (фото + заголовок + кнопка «Описание» → раскрывает текст)

BookingAbout — «О домике»
└── Полное описание + характеристики

BookingMap — «Карта участка»
└── Переиспользуем SiteMap с пропсом highlightedMapId
    (выбранный домик подсвечен жёлтым)
```

## Адаптив

- ≥1024px: двухколоночный layout в Hero, sticky-панель справа.
- <1024px: одноколоночный. Галерея — snap-scroll по горизонтали. Sticky-панель превращается в блок после галереи. CTA-кнопка фиксируется снизу экрана (mobile-only, `fixed bottom-0 inset-x-0` с safe-area padding).
- 404 при невалидном cabinId: рендерим простую заглушку «Домик не найден» + ссылка «На главную».

## Поведение «Показать все фото»

Кнопка открывает лайтбокс (Radix Dialog) с полноразмерной каруселью (embla-carousel). Закрытие по ESC или клику вне. Это однозначнее, чем inline-expand, и работает на мобильных.

## Файлы

Всё для страницы бронирования лежит в `src/pages/booking/`, чтобы не смешивать с секциями лендинга.

Новые:
- `src/lib/cabins.ts` — данные + тип `Cabin`
- `src/lib/bookingRules.ts` — общие хелперы (`hasWeekendOrHoliday`, `calculateNights`)
- `src/pages/booking/BookingPage.tsx` — корневой компонент страницы
- `src/pages/booking/TopBar.tsx`
- `src/pages/booking/BookingHero.tsx` (включает галерею и StickyBookingPanel)
- `src/pages/booking/StickyBookingPanel.tsx`
- `src/pages/booking/BookingInfo.tsx`
- `src/pages/booking/BookingAmenities.tsx`
- `src/pages/booking/BookingRecreation.tsx`
- `src/pages/booking/BookingAbout.tsx`
- `src/pages/booking/BookingMap.tsx`
- `src/test/cabins.test.ts` — Vitest тесты bookingRules

Изменяемые:
- `package.json` — добавить `react-router-dom`
- `src/main.tsx` — обернуть в BrowserRouter
- `src/App.tsx` — Routes (лендинг + booking)
- `src/sections/Cabins.tsx` — импорт CABINS из `lib/cabins.ts`, кнопка → `navigate`
- `src/sections/SiteMap/SiteMap.tsx` — проп `highlightedMapId`, кнопка → `navigate`
- `src/components/BookingDialog.tsx` — использовать `bookingRules.ts`, принимать initial state через пропы

## Тип Cabin

```ts
interface Cabin {
  id: number;
  mapId: 'Домик1' | 'Домик2' | 'Домик3';
  name: string;
  shortDescription: string;
  longDescription: string;
  price: number;
  area: number;                    // м²
  guests: number;
  bedrooms: number;
  beds: { double: number; single: number };
  checkInTime: string;             // "15:00 – 23:00"
  checkOutTime: string;            // "до 12:00"
  rules: string[];                 // ["Громкая музыка запрещена", ...]
  amenities: string[];             // первые 6 видимых
  amenitiesHidden?: string[];      // для "Показать все"
  recreation: RecreationItem[];
  gallery: string[];
  mainImage: string;
}

interface RecreationItem {
  id: number;
  title: string;
  photo: string;
  description: string;
}
```

## Подсветка на карте

В `SiteMap.tsx`:
- Новый проп `highlightedMapId?: MapElement`
- Если передан и совпадает с группой — на группу навешиваем CSS-класс `map-highlight`
- CSS:
  ```css
  .map-highlight {
    filter: drop-shadow(0 0 12px #FACC15) drop-shadow(0 0 24px rgba(250, 204, 21, 0.5));
  }
  .map-highlight path, .map-highlight polygon, .map-highlight rect {
    fill: #FACC15 !important;
    stroke: #CA8A04 !important;
  }
  ```
- Цвет подсветки: жёлтый `#FACC15`.

## Логика бронирования

`StickyBookingPanel`:
1. Состояния: `checkIn`, `checkOut`, `guests`.
2. При выборе дат — рассчитываем `nights` через `calculateNights` и `totalPrice = nights * cabin.price`.
3. При изменении cabinId — `useEffect` вызывает `getBookedDates(cabin.id)`.
4. Кнопка «Забронировать» открывает `BookingDialog`, передавая initial state через `useRef` или callback.
5. После успешного бронирования — toast `sonner`, форма сбрасывается.
6. Валидация (мин. 2 ночи в выходные/праздники) вынесена в `bookingRules.ts`.

## Визуальный стиль

- Тёмная тема: `#0E0E10`, `#2B2B30`, акценты `#10B981` (emerald-600).
- Шрифт `gilroy` (как на остальном сайте).
- Карточки: `bg-[#1A1A1E]` с `border-white/5`, скруглённые `rounded-2xl`.
- Текст: `text-white/90` основной, `text-white/60` второстепенный.

## Зависимости

- Добавить: `react-router-dom@^6` (или новее, если доступно v7).
- Существующие: Tailwind, Radix UI (Popover, Dialog, Calendar), lucide-react, sonner, date-fns, embla-carousel-react.

## Тестирование

- **Unit (Vitest):** `bookingRules.test.ts` — расчёт ночей, проверка выходных/праздников.
- **Component (RTL):** `BookingPage.test.tsx` — рендер с разными cabinId, рендер 404 при невалидном id.
- **Manual:** переход с карточки → выбор дат → отправка формы → toast.

## Что НЕ делаем (YAGNI)

- Платёжный шлюз — только заявка.
- Админка бронирований.
- Реальный бекенд для ameneties/recreation — захардкожено в `cabins.ts`.
- Отзывы на странице бронирования — есть отдельная секция.
- Мультиязычность (только ru).
- SEO meta-теги — для SPA это не приоритет сейчас.
