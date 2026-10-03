### Task 9: Выполнить сквозную локальную проверку

**Files:**
- Verify: `.prerender-routes.json`
- Verify: `dist/**/index.html`
- Verify: `docs/superpowers/specs/2026-07-20-seo-production-readiness-design.md`

- [ ] **Step 1: Запустить весь frontend test suite**

Run:

```bash
npm run test
```

Expected: PASS, включая `fetch-slugs`, `useDocumentHead`, structured data, HomePage, BookingPage и content Schema regression tests.

- [ ] **Step 2: Запустить статические проверки**

Run:

```bash
npm run lint && npx tsc -b --pretty false
```

Expected: PASS без новых lint/type ошибок. Если уже существующая несвязанная ошибка блокирует команду, зафиксировать её точный файл и сообщение; не расширять SEO-задачу несвязанным рефакторингом.

- [ ] **Step 3: Безопасно проверить backend sitemap test**

Сначала убедиться, что `TEST_DATABASE_URL` указывает на отдельную тестовую БД, а не на production/dev. Не печатать пароль. Если отдельная БД не подтверждена, не запускать тест: `sitemap.test.ts` вызывает `resetDb` и очищает таблицы.

При подтверждённой test DB выполнить:

```bash
npm --prefix backend exec -- vitest run src/routes/sitemap.test.ts
```

Expected: 3 tests PASS — static URLs присутствуют, опубликованный контент включён, неопубликованный исключён.

- [ ] **Step 4: Собрать production HTML с отдельно запущенным backend**

Terminal A:

```bash
npm run backend:dev
```

Terminal B:

```bash
npm run build
```

Expected: `prebuild` читает PostgreSQL, Vite собирает frontend, Puppeteer API probe проходит и `dist/` содержит HTML всех маршрутов. Миграции, seed и публикационные операции не запускать.

- [ ] **Step 5: Проверить route manifest программно**

Run:

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; const routes = JSON.parse(readFileSync('.prerender-routes.json', 'utf8')); if (!Array.isArray(routes) || !routes.includes('/') || !routes.includes('/blog') || !routes.includes('/search')) process.exit(1); const counts = { booking: routes.filter(r => r.startsWith('/booking/')).length, seo: routes.filter(r => r.startsWith('/seo/')).length, posts: routes.filter(r => r.startsWith('/blog/')).length }; console.log(JSON.stringify(counts));"
```

Expected: валидный JSON и ненулевой `booking`. `seo/posts` могут быть нулевыми только если в подключённой БД действительно нет опубликованных записей; это не заменяет ручную публикацию.

- [ ] **Step 6: Проверить каждый сгенерированный data route**

Run:

```bash
node --input-type=module -e "import { readFileSync, existsSync } from 'node:fs'; const routes = JSON.parse(readFileSync('.prerender-routes.json', 'utf8')); const dynamic = routes.filter(r => r.startsWith('/booking/') || r.startsWith('/seo/') || (r.startsWith('/blog/') && r !== '/blog')); const bad = []; for (const route of dynamic) { const file = 'dist' + route + '/index.html'; if (!existsSync(file)) { bad.push(route + ': missing HTML'); continue; } const html = readFileSync(file, 'utf8'); if (!html.includes('<link rel=\"canonical\"') || !html.includes('type=\"application/ld+json\"')) bad.push(route + ': missing canonical/schema'); if (/Домик не найден|Страница не найдена|Статья не найдена|Загружаем страницу|Загружаем…|>Загрузка\.\.\.</.test(html)) bad.push(route + ': invalid state'); if (route.startsWith('/booking/') && !html.includes('Accommodation')) bad.push(route + ': missing Accommodation'); } if (bad.length) { console.error(bad.join('\n')); process.exit(1); } console.log('validated', dynamic.length, 'dynamic routes');"
```

Expected: `validated N dynamic routes`, exit code 0.

- [ ] **Step 7: Проверить главную и отсутствие утечки её Schema**

Run:

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; const home = readFileSync('dist/index.html', 'utf8'); const businessCount = (home.match(/LodgingBusiness/g) ?? []).length; if (businessCount !== 1 || home.includes('\"reviewCount\":\"50\"')) process.exit(1); const article = JSON.parse(readFileSync('.prerender-routes.json', 'utf8')).find(r => r.startsWith('/blog/')); if (article) { const html = readFileSync('dist' + article + '/index.html', 'utf8'); if (html.includes('FAQPage') || html.includes('\"@id\":\"https://zvuki-lesa.ru/#lodging\"')) process.exit(1); } console.log('home schema is isolated');"
```

Expected: `home schema is isolated`.

- [ ] **Step 8: Проверить sitemap через работающий backend**

Run:

```bash
curl -fsS "http://localhost:3001/sitemap.xml" -o /tmp/zvuki-lesa-sitemap.xml && node --input-type=module -e "import { readFileSync } from 'node:fs'; const xml = readFileSync('/tmp/zvuki-lesa-sitemap.xml', 'utf8'); if (!xml.includes('<urlset') || !xml.includes('https://zvuki-lesa.ru/')) process.exit(1); console.log('sitemap XML is reachable');"
```

Expected: HTTP 200 и `sitemap XML is reachable`. Production reverse proxy `/sitemap.xml` остаётся ручным пунктом из Section 7 спецификации.

- [ ] **Step 9: Проверить рабочее дерево без изменения shared state**

Run:

```bash
git status --short
```

Expected: только согласованные source/test/docs/package/asset изменения плюс ранее существовавшие пользовательские правки. Не добавлять `.env`, `dist/`, временные файлы и секреты; не создавать commit без отдельной команды.

---
