## Self-Review

### 1. Покрытие спецификации

- [x] PostgreSQL route manifest: Tasks 1A–1B заменяют SQLite, проверяют boolean-фильтры, fallback без URL, ошибку настроенного подключения и закрытие клиента.
- [x] Доступ Puppeteer к backend: Task 8 добавляет health probe, `/api`/`/uploads` proxy, блокировку analytics POST и отбраковку loading/404 HTML.
- [x] SEO домиков: Tasks 3A–3C формируют связанный `LodgingBusiness`/`Accommodation`/`Offer`/`BreadcrumbList`; Tasks 5A–5B подключают metadata и 404 `noindex`.
- [x] Единая Schema главной: Tasks 3B и 4A–4B переносят JSON-LD из `index.html`, используют реальные отзывы одним запросом и исключают фиктивный рейтинг.
- [x] Общие metadata: Task 2 добавляет robots, Open Graph, Twitter и fallback-контракт.
- [x] Существующие SEO/blog Schema: Task 7 удаляет эффекты, которые сразу уничтожали JSON-LD после загрузки.
- [x] Open Graph asset: Task 6 создаёт и программно проверяет JPEG 1200×630.
- [x] Локальная и production-oriented проверка: Task 9 покрывает tests, lint, TypeScript, manifest, итоговый HTML и sitemap.
- [x] Границы shared state: миграции, seed, публикация и reverse proxy не выполняются; backend test запускается только на подтверждённой отдельной test DB.

### 2. Проверка placeholders

Поиск по всем section-файлам не обнаружил запрещённых маркеров незавершённого или расплывчатого плана. Все code-changing steps содержат точные сигнатуры, snippets, команды и ожидаемые результаты.

### 3. Согласованность типов и имён

- [x] `DocumentHead` во всех задачах использует одинаковые поля: `robots`, `ogTitle`, `ogDescription`, `ogUrl`, `twitterTitle`, `twitterDescription`, `twitterUrl`, `twitterImage`.
- [x] Builders имеют единые сигнатуры `buildHomeStructuredData(ReviewsResponse | null): JsonLdGraph` и `buildCottageStructuredData(Cottage): JsonLdGraph`.
- [x] `Reviews` получает `data: ReviewsResponse | null` и `loading: boolean`; `HomePage` передаёт ровно эти props.
- [x] PostgreSQL использует реальные snake_case колонки `is_active` и `is_published` с boolean `true`.
- [x] Маршруты согласованы: `/booking/:slug`, `/seo/:slug`, `/blog/:slug`.
- [x] `sharp` импортируется из подтверждённого `backend/node_modules/sharp/dist/index.cjs`; команды работают из корня.

### Исправления, внесённые во время review

1. Добавлен отсутствовавший API proxy для data-driven prerender; без него Puppeteer сохранял бы loading/404 страницы.
2. Добавлено подавление `POST /api/analytics/event`, чтобы локальная сборка оставалась read-only относительно БД.
3. Добавлены regression tests для `SeoPage` и `BlogPost`: найденные эффекты удаляли собственную Schema.
4. Уточнено безопасное размещение API health check до инициализации временного сервера.
5. Уточнены точные dependency arrays, явные Vitest mocks и команды проверки binary asset.

Неразрешённых противоречий или пропущенных требований нет.

---
