## Scope Check

Работа образует один связанный SEO-поток: PostgreSQL определяет набор prerender-маршрутов, React формирует route-specific `<head>`, а Puppeteer сохраняет результат в HTML. Разбивать это на независимые планы не нужно, потому что критерий готовности проверяется только сквозной production-сборкой.

План не изменяет данные PostgreSQL, миграции, публикационный статус контента, reverse proxy и внешние панели вебмастеров. Запросы prebuild только читают `cottages`, `seo_pages` и `blog_posts`. Коммиты не входят в шаги: их можно создать только по отдельной явной команде пользователя.

## File Structure

### Создать

- `scripts/fetch-slugs-core.mjs` — тестируемая read-only логика PostgreSQL-запросов, нормализации маршрутов и закрытия клиента.
- `scripts/fetch-slugs.test.mjs` — unit-тесты формирования route manifest без подключения к реальной БД.
- `src/lib/structuredData.ts` — чистые builders главной и cottage JSON-LD; общие константы организации и абсолютных URL.
- `src/lib/structuredData.test.ts` — проверка Schema.org с отзывами, без отзывов и с неполными cottage-данными.
- `src/pages/HomePage.tsx` — домашний маршрут, единичная загрузка отзывов, metadata, Schema и композиция существующих секций.
- `src/pages/HomePage.test.tsx` — интеграция данных отзывов с UI и `<head>` без повторного запроса.
- `src/pages/booking/BookingPage.test.tsx` — metadata, JSON-LD и `noindex` для 404.
- `public/og-image.jpg` — статический social preview 1200×630.

### Изменить

- `package.json` — заменить root build-зависимости SQLite на `postgres`.
- `package-lock.json` — зафиксировать обновлённое дерево root-зависимостей.
- `scripts/fetch-slugs.mjs` — загрузка окружения, read-only PostgreSQL-запросы, строгая обработка ошибок и закрытие соединения.
- `scripts/prerender.mjs` — proxy `/api` и `/uploads` к отдельно запущенному backend, блокировка analytics POST и проверка data-driven HTML.
- `src/lib/seo.ts` — robots, Open Graph и Twitter metadata с предсказуемыми fallback-значениями.
- `src/lib/seo.test.ts` — TDD-покрытие расширенного `useDocumentHead`.
- `src/App.tsx` — заменить inline-разметку `/` на `HomePage`.
- `src/sections/Reviews.tsx` — принимать уже загруженные данные и больше не владеть Schema или `useReviews`.
- `src/pages/booking/BookingPage.tsx` — route-specific metadata, `Accommodation` graph и 404 robots.
- `src/pages/seo/SeoPage.tsx` — убрать эффект, удаляющий собственную JSON-LD после загрузки.
- `src/pages/blog/BlogPost.tsx` — убрать эффект, удаляющий собственную Article JSON-LD после загрузки.
- `index.html` — удалить JSON-LD главной, сохранив базовые fallback meta-теги.

### Генерируемые, не редактировать вручную

- `.prerender-routes.json` — stdout `fetch-slugs.mjs`.
- `dist/**/index.html` — результат Vite + Puppeteer prerender.

## Порядок задач

1. PostgreSQL route manifest.
2. Расширение `useDocumentHead`.
3. Чистые JSON-LD builders.
4. Главная страница и удаление глобальной Schema.
5. SEO страницы домика.
6. Open Graph asset.
7. API-aware prerender без аналитических записей.
8. Сквозная локальная проверка и production-чек-лист.

---
