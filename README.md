# Звуки Леса — Туристический сайт гостевого дома

Сайт гостевого дома «Звуки леса» в станице Даховская, Республика Адыгея.
**Astro 5 SSG** (статический фронт) + **Express API** (бэкенд в `backend/`) + **React 19** для админ-SPA и интерактивных островов.

> Подробности для разработчика — в [CLAUDE.md](./CLAUDE.md).

## Стек

- **Фронт:** Astro 5 (SSG) + React 19 islands, Tailwind 3, Radix UI, Embla Carousel, date-fns (ru), react-hook-form + zod
- **Админка:** React 19 + Vite 7 + React Router 6 (отдельный `admin-src/`), shadcn/ui (53 компонента)
- **Бэкенд:** Express 4 + Postgres 18 + Drizzle ORM + sharp + multer + puppeteer (для pre-render)
- **Тесты:** Vitest + @testing-library/react + supertest + jsdom

## Команды (из корня)

```bash
npm run dev              # Astro dev + прокси на backend (3001)
npm run build            # build:admin + astro build (с pre-render)
npm run preview          # просмотр production сборки

npm run backend:dev      # API на http://localhost:3001
npm run backend:migrate  # Drizzle-миграции
npm run backend:seed     # сидинг демо-данными
npm run backend:test     # Vitest бэкенда

npm run test             # Vitest фронта
```

## Структура репозитория

```
app/
├── src/                    # Astro-фронт + React-острова (текущая разработка)
│   ├── pages/              # Astro-страницы (/, /seo/[slug], /blog/[slug], ...)
│   ├── layouts/            # BaseLayout.astro (SEO, OG, JSON-LD)
│   ├── components/         # Astro-компоненты и React-острова
│   └── lib/                # api.ts, bookingRules, seo, cabins
├── src.legacy/             # Старая React/Vite SPA (для отката, не редактируется)
├── admin-src/              # React/Vite админка (SPA, отдельный npm-пакет)
│   ├── src/pages/admin/    # AdminLogin, AdminDashboard, ...
│   └── vite.config.ts      # base: '/admin/', outDir: ../dist/admin
├── backend/                # Express API (отдельный npm-пакет)
│   ├── src/                # routes, services, db, scripts
│   └── drizzle/            # SQL-миграции
├── public/                 # Статика для Astro (картинки, og-image, карты)
├── scripts/                # fetch-slugs.mjs, prerender.mjs (build pipeline)
├── deploy-package/         # Готовый к деплою архив (см. ниже)
└── astro.config.mjs        # output: 'static', integrations: react, tailwind, sitemap
```

## Production deploy

Артефакт для деплоя собирается в `deploy-package/`:

```
deploy-package/
├── dist/                    # Astro build: index.html, _astro/, admin/, sitemap.xml, ...
├── backend/                 # Express: dist/server.js + package.json + drizzle/
├── apache/zvukilesa.conf    # vhost с proxy /api/, /uploads/, /sitemap.xml
├── nssm/install-api.bat     # установка ZvukiLesaAPI как Windows-сервис
├── nssm/restart-api.bat     # рестарт сервиса
├── nssm/uninstall-api.bat   # удаление сервиса
├── api.env.example          # шаблон .env для backend
├── install.bat              # мастер-скрипт (всё одной командой)
└── DEPLOY.md                # краткая инструкция
```

### Сборка архива для деплоя

```bash
npm run build               # → dist/ в корне
```

Затем вручную упаковать:

```bash
# Windows PowerShell
Compress-Archive -Path deploy-package/* -DestinationPath deploy-package.zip -Force

# Или просто скопировать deploy-package/ на сервер
```

### Деплой на сервер (Windows)

Предварительно на сервере установить:

- **Node.js 22+** (`C:\Program Files\nodejs\`)
- **Apache 2.4** в `C:\Apache24\` (с подключёнными `mod_proxy`, `mod_rewrite`, `mod_deflate`, `mod_expires`, `mod_headers`)
- **NSSM** в `C:\nssm\` (https://nssm.cc/download)
- **Postgres 18** доступен по `192.168.1.103:5432` (или другой хост)

Шаги:

1. Скопировать `deploy-package/` (или распаковать `deploy-package.zip`) → `E:\ZvukiLesa-deploy\`
2. Открыть `cmd` **с правами администратора**, перейти в эту папку
3. Запустить `install.bat` — он:
   - скопирует `dist/` → `E:\ZvukiLesa\public\`
   - скопирует `backend/` → `E:\ZvukiLesa\api\` (с сохранением `.env` и `uploads/`)
   - запустит `npm install` в backend
   - применит миграции (`npm run migrate`)
   - установит сервис `ZvukiLesaAPI` через NSSM
   - скопирует `zvukilesa.conf` → `C:\Apache24\conf\vhosts\`
4. В `C:\Apache24\conf\httpd.conf` раскомментировать модули (см. `install.bat` финальный экран) и перезапустить Apache:
   ```cmd
   C:\Apache24\bin\httpd.exe -k restart
   ```

### Управление сервисом

```cmd
:: Старт / стоп / рестарт
nssm start   ZvukiLesaAPI
nssm stop    ZvukiLesaAPI
nssm\restart-api.bat

:: Логи
type E:\ZvukiLesa\api\logs\api-stdout.log
type E:\ZvukiLesa\api\logs\api-stderr.log

:: Удалить сервис
nssm\uninstall-api.bat
```

### Откат (rollback)

1. Остановить API:
   ```cmd
   nssm stop ZvukiLesaAPI
   ```
2. Восстановить `dist/` из бэкапа → `E:\ZvukiLesa\public\`
3. Восстановить `api/dist/` из бэкапа → `E:\ZvukiLesa\api\dist\`
4. Запустить API:
   ```cmd
   nssm start ZvukiLesaAPI
   ```
5. Если менялся Apache vhost — откатить `C:\Apache24\conf\vhosts\zvukilesa.conf` и перезапустить Apache.

### Проверки после деплоя

```cmd
curl -I http://localhost/                      REM 200, ~42 КБ HTML (Astro home)
curl -I http://localhost/admin/login           REM 200 (SPA shell)
curl -I http://localhost/api/availability      REM 200 (proxy на Node)
curl -I http://localhost/uploads/...test.webp  REM 200 image/webp
curl -I http://localhost/sitemap.xml            REM 200 (proxy на Node)
```

### Точки монтирования

| URL                  | Источник                                         |
|----------------------|--------------------------------------------------|
| `/`                  | `E:\ZvukiLesa\public\index.html` (Astro SSG)     |
| `/_astro/*`          | `E:\ZvukiLesa\public\_astro\*` (JS/CSS чанки)    |
| `/admin`, `/admin/*` | `E:\ZvukiLesa\public\admin\index.html` (SPA)     |
| `/api/*`             | proxy → `http://127.0.0.1:3001/api/` (Node)      |
| `/uploads/*`         | proxy → `http://127.0.0.1:3001/uploads/` (Node)  |
| `/sitemap.xml`       | proxy → `http://127.0.0.1:3001/sitemap.xml`      |

## БД

Продакшен: `postgres://postgres:***@192.168.1.103:5432/ZvukiLesa` (PG 18.3).
Тесты используют отдельную БД `zvuki-lesa-test`. **Никогда не переиспользовать `DATABASE_URL` для тестов** — `beforeEach` чистит таблицы.

## Секреты

Реальные секреты (`ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_RELAY_SECRET`, `MAX_BOT_TOKEN`, `DATABASE_URL`) — только в `backend/.env` на сервере. В репозитории хранится только `.env.example` с плейсхолдерами.
