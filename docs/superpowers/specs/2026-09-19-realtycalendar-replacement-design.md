# RealtyCalendar Replacement — Звуки Леса

**Дата:** 2026-09-19
**Статус:** Утверждён
**Заменяет:** локальную систему бронирования (`bookings`, `bookingServices`, `notifications`, `maxSubscribers`, MAX-бот) на внешний сервис **RealtyCalendar** через редирект на партнёрский канал `https://homereserve.ru/feEBPdLdgb`.

## Цель

Полностью убрать локальную логику бронирования из проекта «Звуки Леса». Все бронирования теперь живут в RealtyCalendar; кнопка «Забронировать» на сайте ведёт пользователя в виджет RC на `homereserve.ru`. Бэкенд для контента (домики, отзывы, SEO-страницы, блог, изображения, админка) сохраняется. Админка для бронирований и уведомления MAX о новых бронях удаляются.

Принцип: **RealtyCalendar — единственный источник правды по броням**. Сайт не знает про конкретные даты, занятость, цены в разрезе дат, услуги-в-бронях.

## Архитектура

```
┌──────────────────────────────┐         ┌────────────────────────────┐
│  Фронт (React, SPA)          │         │  RealtyCalendar (внешний)  │
│  - Лендинг /                 │ ──CTA──▶│  https://homereserve.ru/   │
│  - Лендинг /booking/:slug    │ redirect │       feEBPdLdgb           │
│  - /blog, /seo/:slug, /404   │         │  (виджет, бронирование,    │
│  - /admin/* (только контент) │         │   оплата, гости,           │
│         │  /api/*            │         │   уведомления гостям)      │
│         ▼                    │         └────────────────────────────┘
│  ┌──────────────────────┐    │
│  │ Бэк: ТОЛЬКО контент  │    │
│  │ - домики (read)      │    │
│  │ - отзывы (read/write)│    │
│  │ - SEO-страницы       │    │
│  │ - blog               │    │
│  │ - images             │    │
│  │ - sitemap.xml        │    │
│  │ - /admin (контент)   │    │
│  └──────────────────────┘    │
└──────────────────────────────┘
```

### Что сохраняется

- **Бэкенд для контента:** `cottages`, `reviews`, `seo_pages`, `blog_posts`, `images_registry`, `amenities`, `recreation_items`, `services` (каталог для инфо-блоков на лендинге домика), `price_rules` (опционально для инфо).
- **Админка для контента:** логин `/api/admin/login` + дашборд с управлением SEO-страницами, блогом, отзывами, домиками, изображениями.
- **Schema.org:** `LodgingBusiness` JSON-LD на главной с `aggregateRating` из реальных отзывов.
- **SEO-страницы:** `/seo/:slug`, `/blog/:slug`, `/blog`, `/booking/:slug` (как лендинг домика).
- **Sitemap:** `/sitemap.xml` (только контентные страницы + домики + SEO + blog).
- **Vite proxy** `/api` → `http://localhost:3001` (для контента).

### Что удаляется

- **Таблицы БД:** `bookings`, `bookingServices`, `notifications`, `maxSubscribers`.
- **Роуты бэка:**
  - `POST /api/bookings` (публичный, `bookings.ts`)
  - `GET /api/availability`, `GET /api/cottages/:id/availability` (`availability.ts`)
  - `GET /api/calendar/:cottageId` (`calendar.ts`)
  - `GET /api/admin/bookings`, `POST /api/admin/bookings`, `PATCH /api/admin/bookings/:id`, `POST /api/admin/bookings/:id/confirm`, `POST /api/admin/bookings/:id/cancel` (секции `admin.ts`)
  - `GET /api/admin/calendar` (`admin.ts`)
  - `GET /api/admin/finance` (`admin.ts`)
- **Сервисы бэка:** `pricing.ts`, `availability.ts` (для броней), `notifications.ts`, `maxBot.ts`, `maxPoller.ts`.
- **`.env`:** `MAX_BOT_TOKEN`, `MAX_JOIN_CODE`.
- **Хуки фронта:** `useBookings`, `useAvailability`, `useCalendarPrices`, `useAggregateCalendarPrices`.
- **UI фронта:** `BookingDialog`, `CustomCalendar` (с подсветкой занятости), `OccupancyCalendar` (в админке), `SearchResultsPage` (страница `/search`).
- **Код валидации:** `src/lib/bookingRules.ts` (`calculateNights`, `hasWeekendOrHoliday`, `getMinNightsError`).
- **Тесты:** фронт-тесты для `BookingDialog`, `useBookings`, `useAvailability`, `bookingRules`; бэк-тесты для `bookings.test.ts`, `admin.test.ts` (частично), `notifications.test.ts`, `pricing.test.ts`, `availability.test.ts`, `maxBot.test.ts`.

## Бэкенд

### Миграция БД

Новая миграция `backend/drizzle/<timestamp>_drop_booking_tables.sql`:

```sql
DROP TABLE IF EXISTS booking_services;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS max_subscribers;
-- индексы дропаются автоматически вместе с таблицами
```

Применяется после бэкапа. Источник истины по схеме — `backend/src/db/schema.ts` (таблицы `bookings`, `bookingServices`, `notifications`, `maxSubscribers` удаляются из Drizzle-схемы перед `drizzle-kit generate`).

### `schema.ts`

Удалить Drizzle-определения таблиц `bookings`, `bookingServices`, `notifications`, `maxSubscribers`. Экспортируемые типы (`Booking`, `BookingService`, и т.п.) удалить или пометить deprecated, если используются только в удалённых роутах.

Оставить: `cottages`, `cottageImages`, `amenities`, `cottageAmenities`, `recreationItems`, `services`, `priceRules`, `seoPages`, `blogPosts`, `imagesRegistry`, `reviews`.

### `server.ts`

- Убрать `import { startMaxPolling } from './services/maxPoller.js'` и вызов после `app.listen()`.
- Убрать монтирование `bookingsRouter` (`/api/bookings`), `availabilityRouter` (`/api/availability`, `/api/cottages/:id/availability`), `calendarRouter` (`/api/calendar`).
- В `adminRouter` (`/api/admin`) убрать `GET /bookings`, `POST /bookings`, `PATCH /bookings/:id`, `POST /bookings/:id/confirm`, `POST /bookings/:id/cancel`, `GET /calendar`, `GET /finance`. Оставить `POST /login` + контентные роуты.

### Сервисы

**Удалить файлы:**
- `backend/src/services/pricing.ts` (+ `pricing.test.ts`)
- `backend/src/services/availability.ts` (+ `availability.test.ts`)
- `backend/src/services/notifications.ts` (+ `notifications.test.ts`)
- `backend/src/services/maxBot.ts` (+ `maxBot.test.ts`)
- `backend/src/services/maxPoller.ts` (+ `maxPoller.test.ts`, если есть)
- `backend/src/services/telegramBot.ts` (если связан с уведомлениями о бронях; проверить)

**Оставить без изменений:**
- `backend/src/services/imageProcessor.ts`
- `backend/src/services/reviewAvatars.ts`
- `backend/src/services/yandexReviews.ts`
- `backend/src/services/contentService.ts`
- `backend/src/services/ensureSiteElements.ts`

### Тесты бэка

**Удалить:** `bookings.test.ts`, `admin.test.ts` (или сократить до тестов контентных роутов), `notifications.test.ts`, `pricing.test.ts`, `availability.test.ts`, `maxBot.test.ts`.

**Оставить:** `cottages-admin.test.ts`, `seoPages.test.ts`, `blogPosts.test.ts`, `reviews.test.ts`, `images.test.ts`, `sitemap.test.ts`, `analytics.test.ts` (если про контент, не про брони).

### `.env.example`

Удалить секцию:

```env
# MAX-бот для уведомлений о бронированиях — УДАЛЕНО: RealtyCalendar шлёт свои уведомления
# MAX_BOT_TOKEN=
# MAX_JOIN_CODE=
```

Оставить: `DATABASE_URL` / `DATABASE_PATH`, `PORT`, `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`.

## Фронтенд

### Новый компонент — `BookingCTA`

**Файл:** `src/components/BookingCTA/BookingCTA.tsx` + (опц.) `.module.css`.

```tsx
import { cn } from '@/lib/utils';
import { RC_BOOKING_URL } from '@/lib/bookingRedirect';

interface BookingCTAProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function BookingCTA({
  variant = 'primary',
  size = 'md',
  label = 'Забронировать',
  className,
}: BookingCTAProps) {
  return (
    <a
      href={RC_BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonStyles(variant, size), className)}
    >
      {label}
    </a>
  );
}
```

Кнопка — `<a>`, не `<button onClick>`: должна быть настоящая ссылка (доступность, правая кнопка мыши «открыть в новой вкладке», индексирование).

### `src/lib/bookingRedirect.ts` (новый)

```ts
export const RC_BOOKING_URL = 'https://homereserve.ru/feEBPdLdgb';

export function rcBookingHref(params?: Record<string, string | undefined>): string {
  if (!params) return RC_BOOKING_URL;
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return RC_BOOKING_URL;
  const qs = new URLSearchParams(filtered as [string, string][]).toString();
  return `${RC_BOOKING_URL}?${qs}`;
}
```

Если в будущем RC начнёт поддерживать предзаполнение дат (например `?checkIn=2026-12-01&checkOut=2026-12-05`), переключаемся на `rcBookingHref({ checkIn, checkOut })`. В этой итерации используем просто `RC_BOOKING_URL`.

### Удаляемые файлы и роуты

**Файлы:**
- `src/components/BookingDialog/BookingDialog.tsx` (+ `.module.css` если есть)
- `src/components/CustomCalendar/` целиком (или упростить до info-блока)
- `src/pages/booking/BookingForm.tsx`, `BookingCalendar.tsx`, `BookingPricing.tsx`, `BookingServices.tsx` (если существуют)
- `src/pages/SearchResultsPage.tsx` (или `src/pages/search/SearchResultsPage.tsx`)
- `src/lib/bookingRules.ts`
- `src/components/admin/OccupancyCalendar.tsx` (в админке — больше нечего показывать)
- `src/components/admin/BookingsList.tsx`
- `src/components/admin/BookingFormDialog.tsx`

**Хуки в `src/lib/api.ts` (или `src/hooks/`):**
- `useBookings`
- `useAvailability`
- `useCalendarPrices`
- `useAggregateCalendarPrices`
- Любой вызов `/api/bookings`, `/api/availability`, `/api/calendar`, `/api/admin/bookings*`, `/api/admin/calendar`, `/api/admin/finance`

**Роуты в `src/App.tsx`:**
- Удалить `/search` → `SearchResultsPage`
- Оставить `/booking/:cabinId` (рендерится как лендинг домика — см. ниже)

### `/booking/:cabinId` — лендинг домика

**Что остаётся:**
- Hero с галереей (`mainImage` + `gallery` из `cabins.ts`)
- Описание домика
- Список удобств (`amenities`)
- Карта (`SiteMap`)
- Ближайшие достопримечательности (`NearbyAttractions`)
- Блок отзывов (read-only, из БД через `useReviews()`)
- CTA-кнопка `BookingCTA`

**Что убирается:**
- `CustomCalendar` с подсветкой занятости (заменяется текстом «Свободные даты и цены — на сайте бронирования»)
- Форма выбора дат / гостей
- Блок «Дополнительные услуги» с возможностью добавить в бронь (оставить только инфо-перечень, если есть)
- Блок «Итого» с расчётом цены
- Форма отзыва (только read-only отзывы)

**Файл:** переписать `src/pages/booking/BookingAbout.tsx` (или создать `src/pages/booking/CottageLanding.tsx` — на усмотрение разработчика).

### `StickyFooter`

Сейчас: виджет поиска с двумя date-picker'ами, выбором гостей, кнопкой «Найти».

**Новый вариант:** одна крупная CTA-кнопка `BookingCTA` с лейблом «Забронировать» или «Перейти к бронированию». Без дат, без формы.

Файл: `src/components/StickyFooter/StickyFooter.tsx`.

### Главная — карточки домиков

`src/sections/Cabins.tsx`:
- Кнопка «Забронировать» в каждой карточке → `<BookingCTA />`.

`src/sections/Hero.tsx`:
- Если есть CTA-кнопка бронирования → `<BookingCTA />`.

### `src/lib/cabins.ts`

**Оставить:** статический контент (`name`, `description`, `mainImage`, `gallery`, `amenities`, `rules`, `mapId`, тексты).

**Убрать (если присутствуют):** `basePrice`, `minNights`, `seasonalPricing`. Эти поля больше не отображаются (RC сам управляет ценами).

### Schema.org / SEO

- `LodgingBusiness` JSON-LD на `/` — `priceRange` остаётся как категория (`₽₽₽` или удаляется, если неинформативно). `aggregateRating` и `review[]` из `useReviews()` сохраняются.
- `useDocumentHead()` в `src/lib/seo.ts` — проверить, что на `/booking/:cabinId` Schema.org корректен без полей про цены.

## Конфигурация и тесты фронта

### `vite.config.ts`

`server.proxy` для `/api` и `/uploads` остаётся без изменений (контент и админка бьют в бэк).

### Тесты фронта (Vitest)

**Удалить:**
- `BookingDialog.test.tsx`
- `bookingRules.test.ts`
- Тесты `useBookings`, `useAvailability` (если есть)
- Тесты `SearchResultsPage` (если есть)
- Тесты `OccupancyCalendar` (если есть)
- Тесты `BookingsList`, `BookingFormDialog` (если есть)

**Оставить без изменений:**
- Тесты контента (`SeoPage.test.tsx`, `BlogPost.test.tsx`, `ReviewsList.test.tsx`, и т.п.)
- Тесты админки (логин, контент)
- Тесты общих компонентов (`SnapScroll`, `Lenis`, и т.п.)

### `BookingCTA.test.tsx` (новый)

Минимальный тест: рендерит `<a href={RC_BOOKING_URL} target="_blank" rel="noopener noreferrer">` с правильным лейблом.

## Порядок раскатки

### Фаза 0 — Подготовка (фронт)

**Цель:** сайт уже работает на RC-редиректе, бэк для бронирования ещё крутится, но никем не используется. Безопасный промежуточный шаг — можно катить на прод.

1. Создать `src/components/BookingCTA/BookingCTA.tsx` + тест.
2. Создать `src/lib/bookingRedirect.ts`.
3. Заменить ВСЕ кнопки бронирования на `<BookingCTA />`:
   - Hero (`src/sections/Hero.tsx`)
   - Карточки Cabins (`src/sections/Cabins.tsx`)
   - `StickyFooter` — упростить до одной CTA-кнопки
   - `/booking/:cabinId` — кнопка в CTA-блоке
4. Удалить `BookingDialog`, `useBookings`, `useAvailability`, `useCalendarPrices`, `useAggregateCalendarPrices`.
5. Удалить `src/lib/bookingRules.ts` (+ тесты).
6. Переписать `/booking/:cabinId` — без формы, без `CustomCalendar`, без блока услуг, без расчёта цены.
7. Удалить `/search` роут + `SearchResultsPage`.
8. Удалить `CustomCalendar` полностью (без заглушки — на странице домика достаточно текста «Свободные даты и цены — на сайте бронирования» + CTA).
9. Удалить `OccupancyCalendar`, `BookingsList`, `BookingFormDialog` из админки (если они есть в `src/pages/admin/`).
10. Убрать поля `basePrice`, `minNights`, `seasonalPricing` из `cabins.ts` (если присутствуют).
11. **Проверить:** `npm run dev`, `npm run build`, `npm run test` — всё зелёное.

**Коммит:** один или несколько атомарных коммитов. Промежуточные коммиты допустимы (по слоям: компонент → хуки → страницы → календарь).

### Фаза 1 — Удаление бэкенда бронирования

**Цель:** убрать код и таблицы, связанные с бронированием.

1. **Бэкап БД:** `pg_dump` (для `192.168.1.103:5432/ZvukiLesa`) или `sqlite3 .backup` (для `backend/data/zvuki-lesa.db`). Хранить минимум 3 месяца.
2. **Sanity-check импортов** перед удалением (см. ниже).
3. Удалить из `backend/src/db/schema.ts` таблицы `bookings`, `bookingServices`, `notifications`, `maxSubscribers`.
4. Сгенерировать миграцию: `cd backend && npx drizzle-kit generate` (создаст `drop_*.sql`).
5. Проверить сгенерированный SQL (DROP TABLE IF EXISTS + индексы). Должна быть обратная совместимость (если таблиц нет — DROP IF EXISTS пропустит).
6. Удалить файлы сервисов: `pricing.ts`, `availability.ts`, `notifications.ts`, `maxBot.ts`, `maxPoller.ts` (+ их тесты).
7. Удалить файлы роутов: `bookings.ts` (целиком), `availability.ts` (целиком), `calendar.ts` (целиком). Из `admin.ts` удалить секции `bookings`, `calendar`, `finance`.
8. В `server.ts` убрать импорт и вызов `maxPoller`, монтирование `bookingsRouter`, `availabilityRouter`, `calendarRouter`.
9. В `.env.example` убрать секцию MAX.
10. Удалить `pricing.test.ts`, `availability.test.ts`, `notifications.test.ts`, `maxBot.test.ts`. Сократить `admin.test.ts` до тестов контентных роутов. Удалить `bookings.test.ts`.
11. **Проверить:** `npm run backend:dev` поднимается, `npm run backend:test` зелёный, `npm run build` собирается.

**Коммит:** один или несколько атомарных коммитов (по файлам).

### Фаза 2 — Применение миграции на проде

1. Залить фронт (Фаза 0 уже на проде с предыдущего деплоя).
2. Применить миграцию на `192.168.1.103:5432/ZvukiLesa` (через `npm run backend:migrate`).
3. Перезапустить бэк.
4. Проверить в браузере: главная, `/booking/<slug>`, `/admin/login`, `/seo/<slug>`, `/blog/<slug>`, `/sitemap.xml`.
5. Проверить: кнопка бронирования ведёт на `homereserve.ru/feEBPdLdgb` и открывается в новой вкладке.
6. (Опционально) провести тестовую бронь через RC, убедиться, что RC шлёт свои уведомления владельцу.

### Фаза 3 — Документация

1. Обновить корневой `CLAUDE.md`:
   - Убрать секции: «Админка бронирований», «Уведомления MAX (бот для владельца и жены)», «Дублирование бизнес-правил».
   - Обновить секцию «Архитектура» — убрать упоминания `bookings`, `bookingServices`, `notifications`, `maxSubscribers`, `pricing.ts`, `availability.ts`.
   - Добавить секцию: «RealtyCalendar-редирект» — компонент `BookingCTA`, константа `RC_BOOKING_URL`, `src/lib/bookingRedirect.ts`.
2. (Опционально) Удалить `docs/superpowers/specs/2026-06-27-booking-system-design.md`, `2026-07-10-admin-booking-management-design.md`, `2026-07-18-telegram-notifications-design.md` — они описывают удаляемую систему.

## Sanity-check перед удалением (обязательно)

Перед `git rm` любого файла, связанного с бронированием, проверить:

```bash
# Кто ещё импортирует pricing.ts?
cd backend && grep -rn "from.*pricing" src/

# Кто импортирует availability.ts?
cd backend && grep -rn "from.*services/availability" src/

# Кто использует таблицу bookings в schema.ts?
cd backend && grep -rn "bookings," src/

# Кто читает max_subscribers?
cd backend && grep -rn "maxSubscribers" src/

# Кто вызывает notifications?
cd backend && grep -rn "notifyNewBooking\|notifications" src/
```

Если хоть один из этих grep'ов находит не-удаляемый файл — **не удалять**, пересмотреть дизайн.

На фронте аналогично:

```bash
cd src && grep -rn "useBookings\|useAvailability\|BookingDialog\|bookingRules" .
```

## Чеклист Definition of Done

- [ ] На главной кнопка бронирования (Hero и/или `StickyFooter`) ведёт на `https://homereserve.ru/feEBPdLdgb` в новой вкладке.
- [ ] В карточках домиков на главной кнопка бронирования ведёт на RC.
- [ ] `/booking/:slug` отображает лендинг домика (галерея, описание, удобства, карта, nearby, отзывы) с одной CTA-кнопкой на RC.
- [ ] `/search` возвращает 404 (или редирект на главную).
- [ ] `npm run dev` поднимается без ошибок, `npm run test` зелёный, `npm run build` собирается.
- [ ] `npm run backend:dev` поднимается без ошибок, `npm run backend:test` зелёный.
- [ ] `/admin/login` работает; админка для SEO/блога/отзывов/домиков функциональна.
- [ ] Schema.org `aggregateRating` из реальных отзывов на главной сохранился.
- [ ] `/sitemap.xml` отдаёт домики, SEO-страницы, блог.
- [ ] MAX-бот, уведомления о бронях, таблицы `bookings`, `bookingServices`, `notifications`, `maxSubscribers` удалены.
- [ ] `CLAUDE.md` обновлён.
- [ ] Перед удалением таблиц выполнен бэкап БД.

## Что НЕ входит в этот объём (явно)

- ❌ Интеграция с API RealtyCalendar (никаких API-ключей, никаких синхронизаций, только редирект).
- ❌ Webhook от RC обратно к нам.
- ❌ Синхронизация отзывов из RC.
- ❌ Миграция исторических броней из нашей БД в RC (RC начинает с пустого состояния; старые брони остаются только в бэкапе).
- ❌ Редизайн лендинга домика (только структурные правки: убрать форму/календарь, оставить CTA).
- ❌ Поддержка нескольких языков (homereserve.ru — русский интерфейс).
- ❌ A/B-тестирование или постепенный rollout (замена атомарная).

## Открытые вопросы (перед writing-plans)

Эти вопросы разрешаются в плане (writing-plans), не блокируют сам spec:

1. Поддерживает ли homereserve.ru query-параметры для предзаполнения дат? (Нужно проверить вручную перед раскаткой Фазы 0 — если да, добавить date-picker в `StickyFooter`.)
2. Удалять ли `price_rules` из БД и поле `basePrice` из `cabins.ts`? Сейчас в дизайне — **оставить `price_rules` в БД** (если она используется для отображения инфо на лендинге домика), удалить `basePrice` из `cabins.ts`. Финальное решение — в плане.
3. `services` (таблица) — оставить как перечень для инфо на странице домика, но без возможности «добавить в бронь». В дизайне — **оставить**.
4. `ADMIN_PASSWORD` — оставить или удалить? Если админка для контента остаётся — **оставить**. **Решение для плана: оставить** (админка контента нужна, пользователь явно просил убрать только аналитику и уведомления о бронях).
