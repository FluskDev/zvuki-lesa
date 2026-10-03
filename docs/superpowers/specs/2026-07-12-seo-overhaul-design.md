# SEO-апгрейд «Звуки Леса» — дизайн

Дата: 2026-07-12
Проект: «Звуки леса» — гостевой дом (React + Vite фронт, Express + SQLite/Drizzle бэк)

## Цель

Поднять органический трафик из Яндекса/Google по запросам про отдых в Адыгее/Даховской и обойти конкурента `dah-sl.ru`. Сейчас сайт — SPA без посадочных страниц под интенты, sitemap почти пустой (5 URL лендинга), Schema.org для домиков не детализирована, нет блога.

После релиза должны быть:
- 40 SEO-страниц под реальные интенты из wordstat (выгрузка в `seo/wordstat_top_queries.csv`, 369 релевантных из 1999 запросов)
- 15 статей блога под информационные запросы
- Полная Schema.org разметка для лендинга, домиков, SEO-страниц, блога, отзывов
- Динамический sitemap.xml, закрытые `/admin` и `/api` в robots.txt
- Админка для редактирования всего контента без программиста
- Pre-rendered HTML для всех маршрутов → поисковики видят готовый контент

## Ключевые решения (из брейншторминга)

1. **Контент в SQLite + редактирование через `/admin`** — владелец сам правит тексты без программиста. Таблицы `seo_pages`, `blog_posts`, `images_registry`.
2. **Pre-render при сборке** через `vite-plugin-prerender-spa` — генерируются `.html` для всех маршрутов. Список slug'ов для рендера собирается pre-build шагом из БД.
3. **Контент генерирую я (Claude) как черновики** — 40 SEO + 15 блог. Владелец редактирует/публикует через админку.
4. **Schema.org разметка** для каждой страницы (Article, FAQPage, TouristAttraction, LodgingBusiness + Room, BreadcrumbList, Review).
5. **Один большой проект, 6 фаз**, каждая — отдельный коммит. После фазы 6 — релиз.

## 1. Архитектура верхнего уровня

```
Браузер/Поисковик
        │
        ├─→ статика HTML (pre-rendered) ── /, /booking/:id, /blog, /blog/:slug, /seo/:slug, /search
        │
        └─→ JS-бандл (React SPA) ────────→ /api/*  (бэкенд Express)
                                              ├─ /api/cottages, /api/availability (есть)
                                              ├─ /api/seo, /api/seo/:slug (публичные, новые)
                                              ├─ /api/blog, /api/blog/:slug (публичные, новые)
                                              ├─ /api/admin/seo-pages, /api/admin/blog-posts (за requireAdmin, новые)
                                              ├─ /api/admin/images (за requireAdmin, новые)
                                              ├─ /sitemap.xml (новый)
                                              └─ /robots.txt (статика, новый)
                                              │
                                              ▼
                                        SQLite (Drizzle)
                                        ├─ cottages, bookings (есть)
                                        ├─ seo_pages (новая)
                                        ├─ blog_posts (новая)
                                        └─ images_registry (новая)
```

**Решение по динамике**: pre-render для **известных slug'ов** (генерируются при билде через запрос к бэку «дай все `published=true` slug'ы»). Новые страницы, добавленные через админку, попадут в pre-render только после следующего билда. Альтернатива (SSR) отвергнута — большой рефактор.

## 2. Бэкенд — таблицы и API

### 2.1 Новые таблицы (Drizzle, SQLite)

```ts
// seo_pages — посадочные страницы под интент-запросы
seo_pages: {
  id: integer PK auto
  slug: text unique not null          // 'otdih-v-gorah-adygei' (regex /^[a-z0-9-]+$/)
  title: text not null                // 50-70 символов
  description: text not null          // 150-160 символов (meta description)
  h1: text not null
  body: text not null                 // HTML (500-8000 символов, рендерится через sanitization)
  meta_image: text                    // og:image URL (опционально)
  intent: text                        // 'горы-адыгеи', 'термальные-источники' — для группировки
  schema_json: text                   // JSON-LD для страницы (Article/FAQPage/TouristAttraction)
  is_published: integer (boolean) default 0
  priority: real default 0.7          // sitemap priority 0.0-1.0
  created_at, updated_at: timestamps
}

// blog_posts — статьи блога
blog_posts: {
  id: integer PK auto
  slug: text unique not null
  title: text not null                // 50-70 символов
  excerpt: text not null              // 200-250 символов
  body: text not null                 // HTML (1000-10000 символов)
  cover_image: text
  author: text default 'Команда Звуки Леса'
  category: text                      // 'гид', 'маршруты', 'сезоны', 'лагонаки'
  reading_time_min: integer           // авто: words / 200
  schema_json: text                   // Article JSON-LD
  is_published: integer default 0
  published_at: timestamp
  created_at, updated_at: timestamps
}

// images_registry — реестр загружаемых картинок с alt-тегами
images_registry: {
  id: integer PK auto
  path: text unique not null          // '/uploads/adygea-mountains-01.webp'
  alt: text not null
  caption: text
  width: integer, height: integer
  uploaded_by: text default 'admin'
  created_at: timestamp
}
```

### 2.2 API

**Публичные (без авторизации):**
- `GET /api/seo` — список `published=true` (без body, для sitemap/pre-render)
- `GET /api/seo/:slug` — одна страница с body
- `GET /api/blog?page=&category=` — список с пагинацией (без body)
- `GET /api/blog/:slug` — одна статья с body
- `GET /api/images` — реестр (для админки и alt-тегов)
- `GET /sitemap.xml` — генерация из всех таблиц
- `GET /robots.txt` — статика

**За `requireAdmin` (Bearer token):**
- `GET /api/admin/seo-pages` (фильтры: `?published=`)
- `POST /api/admin/seo-pages`
- `PATCH /api/admin/seo-pages/:id`
- `DELETE /api/admin/seo-pages/:id`
- Аналогично `blog-posts`
- `GET/POST/PATCH/DELETE /api/admin/reviews[/:id]` (добавлено в Фазе 5 вместе с таблицей `reviews`)
- `POST /api/admin/images` (multipart, поле `file`)
- `PATCH /api/admin/images/:id` (обновить alt/caption)
- `DELETE /api/admin/images/:id`

### 2.3 Валидация (zod)

В `backend/src/validation/`:
- `seoPageSchema` — slug regex, title 50-70, description 150-160, body 500-8000, priority 0-1
- `blogPostSchema` — slug regex, title 50-70, excerpt 200-250, body 1000-10000
- `imageSchema` — alt 5-200, mime whitelist (jpeg/png/webp/avif), max 5MB

### 2.4 Миграция

Одна миграция `0003_seo_blog_images.sql` (генерируется через `drizzle-kit generate` после изменения `schema.ts`).

### 2.5 Загрузка и обработка картинок

- `POST /api/admin/images` принимает multipart
- Сохраняется в `public/uploads/YYYY-MM/`
- **Конвертация в WebP/AVIF** через `sharp` (новая зависимость) при загрузке
- Оригинал сохраняется рядом для скачивания, основной — `.webp` 80% качества
- Alt и caption обязательны при загрузке (валидация zod)

### 2.6 Error handling

- 404 для несуществующих/неопубликованных slug'ов на публичных endpoint'ах
- 409 при дубликате slug
- 400 с `details` от zod
- 401 при отсутствии/просрочке admin-токена
- Глобальный `errorHandler` (уже есть) применяется ко всем роутам

### 2.7 Тесты (Vitest + supertest)

- `seo.test.ts`: создание, редактирование, публикация, снятие, валидация slug/title/body
- `blog.test.ts`: аналогично + пагинация + категории
- `images.test.ts`: загрузка, конвертация, обновление alt, дубликаты
- `reviews.test.ts`: CRUD, валидация rating 1-5, агрегация для Schema.org (добавлено в Фазе 5)
- `sitemap.test.ts`: проверка наличия всех типов URL (лендинг, домики, seo-pages, blog, reviews)
- `robots.test.ts`: закрыты `/admin` и `/api`

## 3. Фронтенд

### 3.1 Новые страницы (`src/pages/`)

```
src/pages/
├── seo/SeoPage.tsx              # /seo/:slug — рендер body + Schema.org
├── blog/BlogIndex.tsx           # /blog — список + пагинация + фильтр категорий
├── blog/BlogPost.tsx            # /blog/:slug — статья + Schema.org
└── admin/
    ├── SeoPagesList.tsx
    ├── SeoPageEditor.tsx        # Tiptap WYSIWYG + meta preview + slug-генератор
    ├── BlogList.tsx
    ├── BlogEditor.tsx
    └── ImageRegistry.tsx        # загрузка + редактирование alt
```

### 3.2 Маршруты (`src/App.tsx`)

```tsx
<Route path="/" element={<Landing />} />
<Route path="/booking/:cabinId" element={<BookingPage />} />
<Route path="/search" element={<SearchResultsPage />} />
<Route path="/blog" element={<BlogIndex />} />
<Route path="/blog/:slug" element={<BlogPost />} />
<Route path="/seo/:slug" element={<SeoPage />} />
<Route path="/admin/login" element={<AdminLogin />} />
<Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
```

### 3.3 SEO-страница (`SeoPage.tsx`)

- Хук `useSeoPage(slug)` поверх `apiFetch`
- `body` хранится как HTML (рендерится через Tiptap в админке), на публичной странице — `dangerouslySetInnerHTML` после sanitization через DOMPurify (новая зависимость)
- В `<head>` через React 19 `useDocumentHead` (см. 3.8) инжектит: title, description, OG/Twitter, canonical, JSON-LD из `schema_json`
- Рендер: hero (картинка + H1), body, блок «Наши домики» (3 карточки из API), блок «FAQ» (если есть), CTA бронирования
- Перелинковка внизу — 3-4 связанные SEO-страницы + 2-3 статьи блога (по `intent`/`category`)

### 3.4 Блог

- `BlogIndex` — карточки (cover, title, excerpt, reading_time, category), фильтр по `category`, пагинация
- `BlogPost` — body, блок «Похожие статьи» (3-4 по `category`), CTA бронирования
- Schema.org `Article` с `author`, `datePublished`, `dateModified`, `image`, `articleBody`, `keywords`

### 3.5 Админка — WYSIWYG

- **Tiptap** (новая зависимость): базовая сборка + extensions (Heading, Bold, Italic, Link, Image, BulletList, OrderedList, Blockquote, Code)
- Мета-preview: «Google Snippet Preview» — title синий, description серый
- Slug-генератор: авто из title (транслит + lowercase), можно править
- Кнопка «Предпросмотр» — открывает публичную страницу в новой вкладке
- Image picker: drag-n-drop или выбор из `images_registry` (модалка с поиском)
- Поле `intent` для SEO-страниц + `category` для блога — выпадающий список (определяем из контент-плана)

### 3.6 Компонент `<SeoImage>`

- Обязательный `alt` пропс
- Если `src` начинается с `/uploads/` — fallback alt из `images_registry`
- `loading="lazy"` по умолчанию (опционально `eager` для hero)
- Логирует warning в dev при пустом alt
- ESLint правило `jsx-a11y/alt-text` уже есть — оставляем

### 3.7 Перелинковка

- **Футер** (новый блок «Популярные направления»): 6-8 ссылок на топ-SEO-страницы (priority ≥ 0.8)
- **Страница домика** (`/booking/:cabinId`): блок «Что посмотреть рядом» — 3 ссылки на достопримечательности (SEO-страницы про Лагонаки, Руфабго, термы)
- **Блог** внизу статьи: 3-4 связанные статьи + 2-3 на домики
- **SEO-страницы**: внизу 4 связанные страницы (по `intent`) + 3 домика

### 3.8 Хук `useDocumentHead`

Утилита в `src/lib/seo.ts` — принимает `{ title, description, canonical, schema }`, через `useEffect` инжектит/обновляет теги в `<head>`. Cleanup при размонтировании.

### 3.9 Pre-render

- `vite-plugin-prerender-spa` (новая dev-зависимость)
- Конфиг: список маршрутов = статика + slug'ы из БД
- Pre-build шаг (Node-скрипт `scripts/fetch-slugs.mjs`): читает напрямую из SQLite через Drizzle ORM (тот же `schema.ts`), собирает массив `/seo/:slug` и `/blog/:slug` где `is_published=1`
- Запускается в `npm run prebuild` перед `npm run build`
- Не требует запущенного бэкенда — работает с файлом БД напрямую
- Стоимость: ~30-60 секунд на билд для 55 страниц

## 4. Schema.org разметка (JSON-LD)

### 4.1 Лендинг `/`

Расширяем существующий `LodgingBusiness`:
- `numberOfRooms` (из БД — `SELECT COUNT(*) FROM cottages`)
- `petsAllowed: true`
- `checkinTime: "14:00"`, `checkoutTime: "12:00"`
- `image` — массив 5-10 URL из `images_registry`
- `hasOfferCatalog` — отдельные `Offer` на каждый домик (`name`, `price`, `priceCurrency: RUB`)
- `aggregateRating` — реальные цифры из таблицы `reviews` (новая таблица для отзывов, см. 4.6)

### 4.2 Страница домика `/booking/:cabinId`

- `LodgingBusiness` + `Room`:
  - `bed`: количество спальных мест
  - `occupancy`: max гостей
  - `floorSize`: площадь из `cottages.area`
  - `amenities`: кондиционер, Wi-Fi, мангал и т.д. (из `cabin.amenities`)
- `Product` с `Offer` (цена из `cottages.basePrice`)
- `BreadcrumbList`: Главная → Домики → название

### 4.3 SEO-страница `/seo/:slug`

`schema_json` хранится в БД. Типы:
- `Article` — для контентных страниц («Как выбрать домик в Адыгее»)
- `FAQPage` — для страниц с вопросами-ответами («Часто задаваемые вопросы об отдыхе в Даховской»)
- `TouristAttraction` — для страниц о достопримечательностях («Водопады Руфабго», «Плато Лагонаки»)

Генерируется автоматически при сохранении в админке по типу поля `intent`.

### 4.4 Статья блога `/blog/:slug`

`Article`:
- `headline`, `description`
- `image`: `cover_image`
- `datePublished`, `dateModified`
- `author`: `{ @type: Person, name: author }`
- `publisher`: `{ @type: Organization, name: "Звуки Леса", logo: ... }`
- `mainEntityOfPage`: канонический URL
- `articleBody`: текст статьи
- `keywords`: массив ключей из `category`

### 4.5 BreadcrumbList

На всех страницах кроме лендинга — `{position, name, item}` для каждого уровня вложенности.

### 4.6 Отзывы с микроразметкой

Новая таблица `reviews`:
```ts
reviews: {
  id: integer PK auto
  author_name: text not null
  rating: integer not null    // 1-5
  text: text not null
  date: timestamp
  source: text                // '2gis', 'yandex', 'google', 'manual'
  is_published: integer default 0
}
```

- Миграция `0004_reviews.sql`
- CRUD в `/api/admin/reviews`
- На лендинге `/` и страницах домиков — массив `Review` в JSON-LD → `LodgingBusiness.aggregateRating` + `review`
- `Review.reviewRating` (Rating 1-5), `Review.author`, `Review.datePublished`, `Review.reviewBody`
- Владелец наполняет отзывы через админку (можно копировать с Яндекс.Карт/2ГИС)

## 5. Sitemap.xml

`backend/src/routes/sitemap.ts`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Статика -->
  <url><loc>https://zvuki-lesa.ru/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>
  <url><loc>https://zvuki-lesa.ru/blog</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
  <url><loc>https://zvuki-lesa.ru/search</loc><priority>0.6</priority><changefreq>monthly</changefreq></url>

  <!-- Домики из БД -->
  <url><loc>https://zvuki-lesa.ru/booking/shale-uyut</loc><priority>0.9</priority><changefreq>daily</changefreq></url>
  ...

  <!-- SEO-страницы (published=true, sorted by priority desc) -->
  <url><loc>https://zvuki-lesa.ru/seo/otdih-v-gorah-adygei</loc><priority>0.85</priority><changefreq>monthly</changefreq></url>
  ...

  <!-- Статьи блога -->
  <url><loc>https://zvuki-lesa.ru/blog/chto-posmotret-letom</loc><priority>0.7</priority><changefreq>monthly</changefreq></url>
  ...
</urlset>
```

Источник: Drizzle запросы ко всем таблицам. Кэш в памяти на 5 минут (опционально).

## 6. Robots.txt

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: https://zvuki-lesa.ru/sitemap.xml
```

Статический файл в `backend/public/robots.txt` (Express раздаёт).

## 7. Контент-план

### 7.1 SEO-страницы (40 штук) — генерирую я как черновики

**По локации (10):**
1. `/seo/dahovskaya-adygeya-otdih` — Даховская Адыгея: отдых в гостевом доме
2. `/seo/adygeya-maykop-otdih` — Майкоп и Адыгея: где остановиться
3. `/seo/stanica-dahovskaya-otdih` — Станица Даховская: гостевые дома
4. `/seo/maykopskiy-rayon-otdih` — Майкопский район: базы отдыха
5. `/seo/kamenomostskiy-otdih` — Каменномостский: отдых у гор
6. `/seo/poselok-dahovskaya` — Посёлок Даховская: гостевые дома
7. `/seo/turgenevo-novaya-adygeya` — Тургеневское шоссе: домики
8. `/seo/granica-adygeya-krasnodar` — Граница Адыгея-Краснодар: где остановиться
9. `/seo/selo-dahovskoe-otdih` — Даховское сельское поселение
10. `/seo/pogoda-dahovskaya-2026` — Погода в Даховской 2026

**По типу жилья (8):**
11. `/seo/snyat-domik-v-adygee` — Снять домик в Адыгее
12. `/seo/bazy-otdyha-adygeya` — Базы отдыха в Адыгее
13. `/seo/gostyevye-doma-adygeya` — Гостевые дома Адыгеи
14. `/seo/glemping-adygeya` — Глэмпинг в Адыгее
15. `/seo/shale-adygeya` — Шале в Адыгее
16. `/seo/kottedzhi-adygeya-arenda` — Коттеджи в Адыгее: аренда
17. `/seo/domiki-s-basseynom-adygeya` — Домики с бассейном в Адыгее
18. `/seo/usadba-adygeya` — Усадьба в Адыгее

**По типу отдыха (10):**
19. `/seo/otdih-v-gorah-adygei` — Отдых в горах Адыгеи
20. `/seo/otdih-s-basseynom-adygeya` — Отдых с бассейном
21. `/seo/otdih-adygeya-letom` — Отдых в Адыгее летом 2026
22. `/seo/otdih-adygeya-osenyu` — Отдых в Адыгее осенью
23. `/seo/otdih-adygeya-zimoy` — Отдых в Адыгее зимой
24. `/seo/otdih-vyhodnye-adygeya` — Отдых на выходные
25. `/seo/semeynyy-otdih-adygeya` — Семейный отдых в Адыгее
26. `/seo/romanticheskiy-otdih-adygeya` — Романтический отдых
27. `/seo/otdih-s-detmi-adygeya` — Отдых с детьми
28. `/seo/otdih-bolshoy-kompaniey` — Отдых большой компанией

**По активностям (12):**
29. `/seo/dgipping-adygeya` — Джиппинг в Адыгее
30. `/seo/rafting-adygeya` — Рафтинг в Адыгее
31. `/seo/termalnye-istochniki-adygeya` — Термальные источники
32. `/seo/vodopady-adygeya` — Водопады Адыгеи
33. `/seo/lagonaki-otdih` — Лагонаки: отдых
34. `/seo/reka-belaya-adygeya` — Река Белая
35. `/seo/rufabgo-vodopady` — Водопады Руфабго
36. `/seo/konnye-marshruty-adygeya` — Конные маршруты
37. `/seo/banya-chan-adygeya` — Банный чан в Адыгее
38. `/seo/peshie-marshruty-adygeya` — Пешие маршруты
39. `/seo/rybalka-adygeya` — Рыбалка в Адыгее
40. `/seo/kak-dobratsya-do-dahovskoy` — Как добраться до Даховской

### 7.2 Блог (15 статей) — генерирую я

1. `/blog/chto-posmotret-v-adygee-letom` — ТОП-15 мест Адыгеи летом
2. `/blog/gde-kupatsya-v-adygee` — Где купаться: озёра, бассейны, термы
3. `/blog/lagonaki-gid` — Полный гид по плато Лагонаки
4. `/blog/vodopady-rufabgo-kak-dobratsya` — Водопады Руфабго: гид
5. `/blog/termalnye-istochniki-psygups` — Термальный источник Псыгупс
6. `/blog/kak-dobratsya-do-dahovskoy` — Как добраться из Москвы, Краснодара, Майкопа
7. `/blog/pogoda-adygeya-po-mesyatsam` — Погода по месяцам
8. `/blog/otdih-s-detmi-adygeya` — Отдых с детьми
9. `/blog/restoran-dahovskaya` — Рестораны и кафе Даховской
10. `/blog/velopokhod-adygeya` — Веломаршруты Адыгеи
11. `/blog/griby-yagody-adygeya` — Грибы и ягоды в лесах
12. `/blog/banya-chan-vs-sauna` — Банный чан vs финская сауна vs русская баня
13. `/blog/prazdniki-adygeya-2026` — Праздники и фестивали 2026
14. `/blog/svadba-v-gorah` — Свадьба в горах Адыгеи
15. `/blog/fotozony-adygeya` — Лучшие фотозоны Адыгеи

### 7.3 Генерация контента

Для каждой страницы я подготовлю:
- `title` (50-70 символов, с ключом в начале)
- `description` (150-160 символов, с ключом и CTA)
- `h1` (с ключом, без переспама)
- `body` (HTML, 1500-3000 слов для SEO-страниц, 2500-5000 для блога) — через Tiptap-совместимый HTML (h2, h3, p, ul, blockquote, img)
- `schema_json` (соответствующий типу страницы)
- `excerpt` для блога
- `reading_time_min` авто

Все черновики кладутся в `backend/data/seo-drafts/` как `.json` файлы + скрипт `npm run seed:drafts` заливает их в БД (не публикуя — владелец публикует через админку после ревью).

## 8. Оптимизация скорости

- **Pre-render** = убирает CLS, ускоряет FCP/LCP
- Lazy-loading для всех картинок ниже fold (`loading="lazy"`)
- WebP/AVIF через `sharp` при загрузке
- Preconnect/dns-prefetch уже есть
- Inline critical CSS (Vite по умолчанию делает для production)
- Lighthouse-цели: Performance ≥ 90, SEO ≥ 95, Accessibility ≥ 95

## 9. Тестирование

**Unit/Integration (Vitest + supertest):**
- Все новые API endpoints (CRUD seo/blog/images/reviews)
- Валидация zod
- Sitemap генерирует все типы URL
- Robots закрывает нужные пути

**Component (Vitest + Testing Library):**
- `SeoPage` рендерит body + инжектит теги
- `BlogPost` рендерит статью
- `SeoPageEditor` валидирует slug/title
- `ImageRegistry` показывает загруженные

**E2E:** нет (не входит в скоуп). Playwright можно добавить отдельной задачей.

**Визуальная проверка (ручная):**
- Обход всех страниц после билда (через `npm run preview`)
- Проверка meta в DevTools
- Валидация Schema.org через [Google Rich Results Test](https://search.google.com/test/rich-results)
- Проверка sitemap.xml и robots.txt

## 10. Фазы реализации

1. **Фаза 1 (1-2 дня)**: БД + миграция `0003` + API seo/blog/images без UI + supertest тесты
2. **Фаза 2 (2-3 дня)**: Админка — CRUD для seo/blog/images + Tiptap-редактор + тесты
3. **Фаза 3 (3-4 дня)**: Публичные страницы + Schema.org (лендинг + домики + SEO + блог) + перелинковка
4. **Фаза 4 (2-3 дня)**: Pre-render + sitemap.xml + robots.txt + оптимизация скорости
5. **Фаза 5 (3-4 дня)**: Генерация 40 SEO-страниц + 15 статей блога (черновики в `backend/data/seo-drafts/*.json`) + сид-скрипт `npm run seed:drafts` (заливает черновики в БД с `is_published=0`) + миграция `0004_reviews.sql` + CRUD reviews в админке
6. **Фаза 6 (1 день)**: Прогон тестов, Lighthouse, ручной обход, фиксы, релиз

Каждая фаза — отдельный коммит. После фазы 6 — релиз (PR в main).

## 11. Зависимости (новые)

**Backend:**
- `sharp` — конвертация в WebP/AVIF
- `multer` или `busboy` — multipart-загрузка (выбрать на этапе реализации)

**Frontend:**
- `vite-plugin-prerender-spa` — pre-render
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`
- `dompurify` + `@types/dompurify` — sanitization HTML перед рендером `body`
- `react-markdown` — если body хранить в markdown (но выбрали HTML, поэтому не нужен)

## 12. Что НЕ входит

- SSR (отвергнут)
- AMP/Яндекс.Турбо (можно добавить отдельной задачей)
- Яндекс.Метрика / Google Analytics (есть ли — не входит в скоуп)
- Полная замена контента владельца (только черновики + редактирование через админку)
- Мультиязычность (hreflang только `ru`)

## 13. Риски и митигация

| Риск | Митигация |
|---|---|
| Pre-render не сможет подгрузить динамические slug'ы (бэкенд не запущен при билде) | Pre-build скрипт читает напрямую из SQLite через Drizzle — не нужен запущенный сервер |
| Sharp тяжёлый для бэкенда | Используем только при загрузке (не в hot path) |
| Владелец не отредактирует контент после генерации | Все черновики заливаются с `is_published=0`, владелец явно публикует |
| Schema.org не пройдёт Google Rich Results | Валидируем перед релизом, фиксы |
| Lighthouse Performance < 90 после pre-render | Изображения WebP, lazy-loading, минимум JS в критическом пути |