# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Звуки леса — Гостевой дом

Туристический сайт гостевого дома «Звуки леса» в станице Даховская, Республика Адыгея. Фронтенд (React) в корне репозитория, бэкенд (Express) — отдельный npm-пакет в `backend/`.

## Команды

Фронтенд (корень):
- `npm run dev` — Vite dev-сервер на http://localhost:5173 (проксирует `/api` → `http://localhost:3001`)
- `npm run build` — `tsc -b` (проверка типов) + production сборка
- `npm run lint` — ESLint
- `npm run preview` — просмотр production сборки
- `npm run test` — Vitest (один прогон), `npm run test:watch` — watch-режим

Бэкенд (из корня, через проксирующие скрипты):
- `npm run backend:dev` — запуск API на http://localhost:3001 (`tsx watch src/server.ts`, автоперезапуск)
- `npm run backend:migrate` — применить Drizzle-миграции из `backend/drizzle/`
- `npm run backend:seed` — засеять БД демо-данными (домики, услуги, ценовые правила)
- `npm run backend:test` — Vitest бэкенда (supertest для роутов)

Прямо в `backend/` те же скрипты доступны как `npm run dev|migrate|seed|test`.

Запустить один тест: `npx vitest run путь/к/файлу.test.ts` или `npx vitest run -t "фрагмент имени"`.

## Билд не требует БД (важно)

`npm run build` **не** ходит в PostgreSQL и **не** требует живого backend. Список маршрутов для prerender лежит в `scripts/routes.manifest.json` (коммитится в репо). `prebuild` (`scripts/fetch-slugs.mjs`) читает только этот файл; `prerender.mjs` тоже не делает health-probe `/api/reviews`.

Когда обновлять manifest:
- **Добавил/удалил домик** в `backend/src/db/seed.ts` (меняется `slug`) → обнови поле `cottages` в manifest руками.
- **Опубликовал SEO-страницу или блог-пост** через `/admin` → обнови поля `seoPages` / `blogPosts` в manifest руками.
- **Массовая синхронизация** — на машине с `DATABASE_URL` (обычно сервер): `npm run routes:sync`. Скрипт перезаписывает manifest из Postgres. После — закоммитить обновлённый manifest.

**Порядок для первичного наполнения на сервере:**
```bash
cd E:\ZvukiLesa
npm run seed:publish              # заливает 15 blog + 40 SEO как isPublished=true
npm run routes:sync               # обновляет scripts/routes.manifest.json из БД
git add scripts/routes.manifest.json && git commit -m "chore: sync routes from DB"
npm run build                     # отрендерит /seo/<slug>/ и /blog/<slug>/ в HTML
# залить dist/ на прод
```

Если manifest пустой (`seoPages: []`, `blogPosts: []`) — prerender всё равно отрендерит `/`, `/blog`, `/404` и домики из `cottages`. Яндекс увидит эти страницы как статический HTML, остальное — через SPA-fallback.

## Prerender без backend (важно)

`scripts/prerender.mjs` перед стартом делает короткий health-probe `http://localhost:3001/api/reviews` (2с таймаут). Если backend недоступен:

1. **proxy `/api` и `/uploads` отключается** — нет зависаний на navigation timeout.
2. **routes фильтруются:** отбрасываются `/booking/<slug>`, `/seo/<slug>`, `/blog/<slug>` (эти страницы показывают invalid state без данных API и роняют prerender). Остаются `/`, `/blog`, `/404`.
3. Главная и `/blog` рендерятся с fallback для Schema.org `aggregateRating` (без живых отзывов) — это не критично для prerender, реальный рейтинг подтянется при первом заходе живого пользователя.
4. `/404/` рендерится полностью — это и есть системная страница для `ErrorDocument 404 /404/index.html` на Apache.

На сервере (с живым backend + DATABASE_URL) prerender работает в полном объёме — рендерит все маршруты из manifest, включая домики и опубликованные SEO/блог.

Полный локальный запуск: два процесса — `npm run backend:dev` и `npm run dev`. БД (`backend/data/zvuki-lesa.db`) уже создана и засеяна; миграция/сид нужны только на чистом окружении.

Генерация новой миграции после изменения схемы: отредактировать `backend/src/db/schema.ts`, затем `cd backend && npx drizzle-kit generate`, затем `npm run backend:migrate`.

**БД на удалённом сервере:** `192.168.1.103:5432/ZvukiLesa` (PG 18.3). `DATABASE_URL=postgres://postgres:L0kijuhy!@192.168.1.103:5432/ZvukiLesa` прописан в `backend/.env.example`. Для dev и тестов используется одна и та же БД — тесты чистят таблицы в `beforeEach`.

## Стек

Фронтенд: React 19 + Vite 7 + TypeScript 5.9, Tailwind 3.4 + Radix UI (shadcn/ui, slate, dark mode), React Router 6, Embla Carousel, Lenis (плавный скролл), react-three-fiber/three (3D), date-fns (ru), react-hook-form + zod, sonner (toast), lucide-react. Тесты: Vitest + @testing-library/react + jsdom.

Бэкенд: Express 4 + better-sqlite3 + Drizzle ORM (dialect sqlite), zod-валидация, express-async-errors. Тесты: Vitest + supertest.

Алиас `@/` → `./src` (в `vite.config.ts` и `vitest.config.ts`).

## Архитектура

### Взаимодействие фронта и бэка

Фронтенд НЕ обращается к бэкенду по абсолютному URL. `src/lib/api.ts` бьёт в относительный `/api`, а Vite dev-сервер проксирует это на `http://localhost:3001` (см. `server.proxy` в `vite.config.ts`). Формат ответа единый: `{ success: true, data }` либо `{ success: false, error, code?, details? }` — `apiFetch` разворачивает это в `ApiResult<T>`. В production проксирование должен обеспечивать реверс-прокси/сервер.

### Два источника данных о домиках (важный нюанс)

Данные домиков живут в двух местах, и это осознанное разделение:
- **`src/lib/cabins.ts`** — статический контент (описания, галереи, правила, удобства, тексты для страниц бронирования). Экспортирует `CABINS` и `getCabinById(id)`. Используется страницами `src/pages/booking/*` и `BookingDialog` для отрисовки контента.
- **Backend БД (таблица `cottages`)** — «живые» данные: цены, доступность, расчёт стоимости, создание броней. Фронт получает их через хуки (`useCottages`, `useAvailability`, `useCalendarPrices`, `useAggregateCalendarPrices`) поверх `src/lib/api.ts`.

При добавлении домика или изменении его контента нужно синхронизировать оба источника: `cabins.ts` (контент) и сид/БД бэкенда (цена, slug, `mapId`). `mapId` (`Домик1|2|3`) связывает статические данные с записью в БД и точками на карте (`SiteMap`).

### Маршрутизация (`src/App.tsx`)

- `/` — лендинг: `SnapScroll` оборачивает секции (Navigation → Hero → Cabins → Services → About → Amenities → Reviews → ContactUsLanding), поверх — `StickyFooter` (виджет поиска/бронирования).
- `/booking/:cabinId` — страница бронирования конкретного домика (`src/pages/booking/`).
- `/search` — результаты поиска свободных домиков по датам (`SearchResultsPage`).
- `/seo/:slug` — публичная SEO-страница (`src/pages/seo/SeoPage.tsx`), рендерит body из БД с Schema.org JSON-LD.
- `/blog` — индекс блога с фильтром категорий и пагинацией (`src/pages/blog/BlogIndex.tsx`).
- `/blog/:slug` — статья блога (`src/pages/blog/BlogPost.tsx`).
- `/admin/login` — страница входа в админку (`src/pages/admin/AdminLogin.tsx`).
- `/admin` — дашборд админки, за `RequireAdmin` (`src/pages/admin/AdminDashboard.tsx`, без `StickyFooter` и навигации лендинга).

`SnapScroll` (`src/components/SnapScroll/`) — кастомная snap-прокрутка по секциям через `wheel`-события. `Hero` использует `HeroCarousel` (Embla, autoplay 6с, пауза при `visibilitychange`).

### Бэкенд (`backend/src/`)

- `server.ts` — сборка Express-приложения, монтирование роутов, `errorHandler`/`notFoundHandler`, порт 3001 (`PORT`).
- `db/client.ts` — better-sqlite3 + Drizzle. Путь БД — `DATABASE_PATH` или `backend/data/zvuki-lesa.db`. Включены `journal_mode = WAL` и `foreign_keys = ON`.
- `db/schema.ts` — единственный источник истины по схеме БД (cottages, cottage_images, amenities, cottage_amenities, recreation_items, services, price_rules, bookings, booking_services, notifications, seo_pages, blog_posts, images_registry, reviews, max_subscribers).
- `routes/` — cottages, services, calendar, availability, bookings, seoPages, blogPosts, images, reviews. `availabilityRouter` монтируется на `/api` и обслуживает `/api/availability` и `/api/cottages/:id/availability`. `sitemapRouter` смонтирован на `/` и отдаёт `/sitemap.xml`.
- `services/imageProcessor.ts` — sharp-конвертация загружаемых картинок в WebP.
- `scripts/seedDrafts.ts` — заливает черновики SEO/blog из `backend/data/seo-drafts/` в БД с `isPublished=false`. Запуск: `npm run seed:drafts` из `backend/`.
- `services/pricing.ts` — `calculateStayPrice`: посуточный расчёт с применением ценовых правил. Правила выбираются по `priority` (выше — важнее), при равенстве правило для конкретного домика (`cottageId !== null`) побеждает глобальное; `weekendModifier` доначисляется в выходные. День выезда не тарифицируется (`perNight` = все ночи кроме последнего дня).
- `services/availability.ts` — `isDateRangeAvailable` (пересечение диапазонов; день выезда считается свободным, отменённые брони игнорируются) и `hasWeekendOrHoliday`.
- `services/notifications.ts` — `notifyNewBooking` пишет строку в таблицу `notifications` и логирует в консоль (внешней отправки, например Telegram, сейчас нет).

### Админка бронирований (с закрытым входом)

Отдельная зона, не входит в лендинг. Доступ — по общему паролю из `ADMIN_PASSWORD` в `.env`. Токен в `localStorage` под ключом `admin_token`. Сессия 30 дней.

**Эндпоинты `/api/admin/*` (за middleware `requireAdmin`, кроме `POST /login`):**
- `POST /login` — вход по паролю, выдаёт Bearer-токен (HMAC-SHA256 на `node:crypto`, без новых зависимостей).
- `GET /bookings?status=&from=&to=&cottageId=` — список с `cottageName`, сортировка по дате заезда.
- `GET /calendar?from=&to=` — занятые интервалы (без `cancelled`).
- `POST /bookings` — ручная бронь (`status='confirmed'`, `source='manual'`), без проверки занятости и минимума ночей, поддерживает `priceOverride`.
- `PATCH /bookings/:id` — частичное редактирование; смена дат пересчитывает `nights`, `totalPrice` сама не пересчитывается.
- `POST /bookings/:id/confirm`, `POST /bookings/:id/cancel` — смена статуса.

**Переменные окружения бэкенда**: `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET` (см. `backend/.env.example`).

**Закрытие дыр безопасности:** публичные `GET /api/bookings/:id` (отдавал телефон/данные гостя) и `POST /api/bookings/:id/cancel` (любой мог отменить чужую бронь по id) удалены в Task 7. Публичное создание `POST /api/bookings` остаётся; теперь проставляет `source='site'`.

**Колонка `bookings.source`** (`text`, enum `'site' | 'manual'`, NOT NULL DEFAULT 'site') добавлена миграцией `0001_parallel_wallow.sql`.

**Маршруты фронта:** `/admin/login` (страница входа), `/admin` (дашборд за `RequireAdmin`). Папка `src/pages/admin/`: `AdminLogin`, `AdminDashboard` (содержит `OccupancyCalendar` + `BookingsList` + `BookingFormDialog`), `RequireAdmin` (гвард, редиректит на `/admin/login` без токена). API-клиент — `src/lib/adminApi.ts`, токен хранится в `localStorage` под ключом `admin_token`, автоматически подставляется в `Authorization: Bearer <token>`; при 401 — токен очищается.

Админка рендерится **вне** лендинга со `SnapScroll` — обычный прокручиваемый экран, без `StickyFooter` и навигации сайта.

### Уведомления MAX (бот для владельца и жены)

При новой брони с сайта (`source='site'`, `status='new'`) бэкенд шлёт сообщение в MAX всем, кто подписался командой `/join 1501` боту.

**Переменные окружения бэкенда:**
- `MAX_BOT_TOKEN` — токен бота MAX (https://dev.max.ru).
- `MAX_JOIN_CODE` — кодовое слово для команды `/join` (по умолчанию `1501`).

**Таблица `max_subscribers`** (`backend/src/db/schema.ts`): `user_id` (unique), `chat_id`, `join_code`, `joined_at`, `last_notified_at`, `is_active`. Миграция `0002_bent_franklin_storm.sql`.

**Как это работает:**
- `services/maxPoller.ts` — long polling `GET /updates` каждые 2с, обрабатывает `/start`, `/join <code>`, `/leave`. Запускается автоматически после `app.listen`. Без `MAX_BOT_TOKEN` поллер не запускается.
- `services/maxBot.ts:sendMessage` — `POST https://platform-api2.max.ru/messages`, заголовок `Authorization: <token>` (без Bearer).
- `services/notifications.ts:notifyNewBooking` — после записи в таблицу `notifications` вызывает `broadcastBookingToMax` — рассылает `formatBookingMessage` всем активным подписчикам через `Promise.allSettled` (ошибка на одном не роняет остальные).

**Формат сообщения:**
```
🏡 Новая бронь #443

🏠 Шале Уют
👤 Влад Владимирович
📞 +79009892410

📅 Заезд: 12.07.2026
📅 Выезд: 14.07.2026
🌙 2 ночи

🛎 Услуги:
  • Банный чан × 2
  • Рафтинг

💰 Итого: 12 500 ₽
```

Если услуг нет — секция `🛎 Услуги` пропускается. Слово «ночь» склоняется: 1 ночь / 2 ночи / 5 ночей. **Цены услуг в сообщении не показываются** — стоимость обсуждается с гостем при подтверждении брони.

**Структура данных:** `BookingSummary.services?: ServiceLine[]` в `backend/src/services/maxBot.ts`. Список собирается в `backend/src/routes/bookings.ts` при создании брони через JOIN `booking_services` + `services`.

**Подключение владельца:**
1. Создать бота в MAX, получить токен.
2. Положить `MAX_BOT_TOKEN=<token>` в `backend/.env`.
3. Перезапустить `npm run backend:dev`.
4. Владелец и жена пишут боту `/start`, затем `/join 1501` — получают «Готово!».

**Чеклист для разработчика:**
- Если меняешь `MAX_JOIN_CODE` в `.env` — старые подписчики остаются (`join_code` хранится в БД для аудита), но новые должны использовать новый код.
- Polling останавливается по SIGTERM/SIGINT (graceful shutdown).

### Дублирование бизнес-правил (следить за синхронностью)

Праздники РФ и правило «минимум 2 ночи на выходных/праздниках» продублированы на фронте и на бэке:
- Фронт: `src/lib/bookingRules.ts` (`calculateNights`, `hasWeekendOrHoliday`, `getMinNightsError`) — валидация в UI.
- Бэк: `backend/src/services/availability.ts` (`hasWeekendOrHoliday`, список `HOLIDAYS`) — авторитетная проверка.

Логика заезд/выезд: заезд 14:00, выезд 12:00 → день выезда свободен для нового заезда. Это отражено и в календаре (`src/components/CustomCalendar/`), и в `isDateRangeAvailable`, и в расчёте ночей.

## UI компоненты и стили

- `src/components/ui/` — сгенерированные shadcn/ui (Radix). Не редактировать вручную — обновлять через CLI shadcn.
- Tailwind для большинства компонентов; CSS Modules (`*.module.css`) для сложных: `HeroCarousel`, `SnapScroll`, `StickyFooter`, `CustomCalendar`.
- `src/index.css` — глобальные стили, CSS-переменные темы (`:root` / `.dark`), кастомные анимации. Базовый фон body — `#141414` (тёмная тема).

## Изображения и ассеты

- `public/` — статика по абсолютному пути (`/images/...`).
- При добавлении фото домиков обновлять `gallery`/`mainImage` в `src/lib/cabins.ts`.

## SEO и метаданные

`index.html`: Yandex Maps API (с ключом), Schema.org JSON-LD (LodgingBusiness, BreadcrumbList, FAQPage, ImageObject), Open Graph, Twitter Cards, геотеги Даховской.

### SEO-страницы и блог

БД хранит 4 таблицы для контентного SEO: `seo_pages` (посадочные страницы под интенты), `blog_posts` (статьи блога), `images_registry` (реестр загруженных картинок с alt), `reviews` (отзывы для Schema.org Review-разметки). Миграция `0004_seo_blog_images.sql` создаёт первые три, `0006_reviews.sql` — таблицу отзывов.

**Контент:**
- Черновики лежат в `backend/data/seo-drafts/{seo,blog}/*.json` (40 SEO + 15 blog).
- `npm run seed:drafts` (из `backend/`) заливает их в БД с `isPublished=false` — владелец публикует через `/admin/seo-pages` и `/admin/blog-posts` (или `ReviewsList`).
- `npm run seed:publish` (из `backend/`) — массовая публикация: заливает черновики с `isPublished=true` и `publishedAt=now()` идемпотентно (через `onConflictDoUpdate`). Использовать для первичного наполнения или когда хочется разом опубликовать всё. Не нужные можно снять через `/admin`.
- Поля валидируются zod-схемами в `backend/src/validation/seo.ts` (slug regex, длины title/description/h1/body/excerpt, перечисление `intent`/`category`, валидный JSON в `schemaJson`).
- `intent` для SEO: `горы-адыгеи`, `термальные-источники`, `лагонаки`, `даховская`, `домики`, `активности`, `сезоны`.
- `category` для блога: `гид`, `маршруты`, `сезоны`, `лагонаки`, `достопримечательности`, `развлечения`, `практика`.

**Schema.org:**
- В каждом черновике хранится `schemaJson` (stringified JSON-LD). Типы: `TouristAttraction`, `LodgingBusiness`, `Article`, `FAQPage`.
- На лендинге `/` расширенный `LodgingBusiness` (petsAllowed, checkinTime, checkoutTime, numberOfRooms) + динамический `aggregateRating` и `review[]` из таблицы `reviews` через `useReviews()`.
- На странице домика и SEO-страницах JSON-LD инжектится через хук `useDocumentHead()` из `src/lib/seo.ts`.

**Pre-render для поисковиков:**
- `scripts/fetch-slugs.mjs` — pre-build скрипт, читает SQLite напрямую и собирает массив маршрутов (`/`, `/blog`, `/search`, `/seo/:slug`, `/blog/:slug`) для всех `isPublished=1`.
- `scripts/prerender.mjs` — рендерит каждый маршрут через Puppeteer 25 + Chromium, сохраняет в `dist/<route>/index.html`.
- `npm run build` запускает `prebuild` (fetch-slugs) → `vite build` (с пре-рендером) → `prerender` финальный проход.
- ВАЖНО: новые страницы, добавленные через `/admin` после публикации, попадут в sitemap и pre-render только после следующего `npm run build`.

**Sitemap и robots:**
- `GET /sitemap.xml` — динамическая генерация из всех таблиц (статика + домики + seo_pages + blog_posts). Mounted at `/`.
- `public/robots.txt` — Disallow `/admin` и `/api`. Sitemap URL указан.
- `useDocumentHead({ canonical })` проставляет canonical URL на публичных страницах.

**Перелинковка:**
- `src/sections/Footer.tsx` — блок «Популярные направления» (6-8 топ-SEO-страниц по `priority >= 0.8`).
- `src/pages/booking/NearbyAttractions.tsx` — карточки на 3 SEO-страницы (Лагонаки, Руфабго, термы) на странице домика.
- `src/pages/seo/SeoPage.tsx` — 3-4 связанные страницы по `intent` + блок «Наши домики».
- `src/pages/blog/BlogPost.tsx` — 3 связанные статьи по категории + CTA бронирования.

## Контакты

Телефон +7 (928) 211-02-49 · Email booking@zvuki-lesa.ru · Telegram @ZVUKILESA01 · WhatsApp wa.me/79282110249 · Instagram @zvukilesa01 · Координаты 44.223140, 40.199615.

## Чего избегать

- Не менять `base: './'` в `vite.config.ts` — сайт деплоится в поддиректорию.
- Не редактировать `src/components/ui/` напрямую — это сгенерированный код shadcn.
- Не менять схему БД правкой SQL в `backend/drizzle/` — источник истины `backend/src/db/schema.ts`, миграции генерируются через `drizzle-kit generate`.
- Не удалять блокировку масштабирования в `src/main.tsx` (gesturestart/gesturechange/touchmove) — это для мобильной версии.
- При изменении данных домиков не забывать про оба источника (`cabins.ts` + БД/сид) и общий `mapId`.
- Не хардкодить `MAX_BOT_TOKEN` — только через переменную окружения, токен нигде не должен попасть в git/логи.
