// Pre-renders the built SPA into static HTML files for each route listed in
// `.prerender-routes.json`. Runs AFTER `vite build` has produced dist/.
//
// We invoke the underlying `@prerenderer/prerenderer` engine with a Puppeteer
// renderer directly instead of going through the webpack-only
// `@weweb/prerender-spa-plugin`. The plugin's `compiler.hooks.afterEmit` hook
// doesn't exist in Vite, so the plugin itself can't be used as a Vite plugin.
//
// JSON-only model (Task 2.7): backend/ удалён. Все данные читаются из
// src/data/*.json через sync-импорты (см. src/lib/api.ts shim). Prerender
// НЕ делает health-probe localhost:3001 (backend нет), НЕ фильтрует routes
// — все маршруты из `.prerender-routes.json` рендерятся одинаково.
//
// Sitemap generation: после рендера создаётся `dist/sitemap.xml` на основе
// всех отрендеренных routes + статических URL (`/`, `/blog`).
//
// Routes file location: `<repo-root>/.prerender-routes.json` (written by
// `scripts/fetch-slugs.mjs` via the `prebuild` npm script).

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const distDir = resolve(repoRoot, 'dist');
const routesFile = resolve(repoRoot, '.prerender-routes.json');

if (!existsSync(distDir)) {
  console.error(`[prerender] dist/ not found at ${distDir} — run \`vite build\` first.`);
  process.exit(1);
}

// Inject a `<base href="/">` so the prerendered routes can resolve asset
// URLs (e.g. `./assets/index-*.js`) from their deep path. Without this, a
// route like /booking/foo sends the browser looking for /booking/assets/...
// which 404s.
//
// We do this by serving a temp index.html that has the base tag, instead of
// patching every output file. (See customStaticDir below.)
const tempDistDir = resolve(repoRoot, '.prerender-dist');
{
  // Re-create the temp dir from dist on every prerender.
  const { rmSync, cpSync } = await import('node:fs');
  rmSync(tempDistDir, { recursive: true, force: true });
  cpSync(distDir, tempDistDir, { recursive: true });
  const indexPath = join(tempDistDir, 'index.html');
  const original = readFileSync(indexPath, 'utf-8');
  // Insert <base href="/"> right after <head>
  const withBase = original.replace(/<head>([\s\S]*?)<\/head>/i, (m) =>
    m.includes('<base ')
      ? m
      : m.replace(/<head>/i, '<head>\n    <base href="/">')
  );
  writeFileSync(indexPath, withBase, 'utf-8');
}

let routes = [];
if (existsSync(routesFile)) {
  routes = JSON.parse(readFileSync(routesFile, 'utf-8'));
}
if (!Array.isArray(routes) || routes.length === 0) {
  console.log('[prerender] no routes to render, exiting.');
  process.exit(0);
}

console.log(`[prerender] ${routes.length} route(s) to render.`);

const Prerenderer = (await import('@prerenderer/prerenderer')).default;

// We use the modern puppeteer (top-level dep) directly instead of the
// ancient puppeteer 1.20 that ships nested inside
// `@prerenderer/renderer-puppeteer` — that version's bundled Chromium can't
// reliably execute modern ES modules emitted by Vite + React 19.
const puppeteer = (await import('puppeteer')).default;

class PuppeteerRenderer {
  constructor (rendererOptions) {
    this._puppeteer = null
    this._rendererOptions = rendererOptions || {}
    if (this._rendererOptions.maxConcurrentRoutes == null) this._rendererOptions.maxConcurrentRoutes = 0
  }

  async initialize () {
    this._puppeteer = await puppeteer.launch(this._rendererOptions)
    return this._puppeteer
  }

  async renderRoutes (routes, Prerenderer) {
    const rootOptions = Prerenderer.getOptions()
    const options = this._rendererOptions
    const limiter = (await import('promise-limit')).default(options.maxConcurrentRoutes)

    const pagePromises = Promise.all(
      routes.map((route, index) => limiter(async () => {
        const page = await this._puppeteer.newPage()
        await page.setRequestInterception(true)
        page.on('request', (request) => {
          const requestUrl = new URL(request.url())
          if (request.method() === 'POST' && requestUrl.pathname === '/api/analytics/event') {
            void request.respond({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: null }),
            })
            return
          }
          // JSON-only: блокируем любые обращения к /api/* — shim в api.ts
          // отвечает синхронно через in-memory data, реального HTTP не нужно.
          if (requestUrl.pathname.startsWith('/api/')) {
            void request.respond({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: null }),
            })
            return
          }
          void request.continue()
        })
        if (options.consoleHandler) {
          page.on('console', message => options.consoleHandler(route, message))
        }
        const baseURL = `http://localhost:${rootOptions.server.port}`
        if (options.viewport) await page.setViewport(options.viewport)

        const navigationOptions = options.navigationOptions
          ? { waitUntil: 'networkidle0', ...options.navigationOptions }
          : { waitUntil: 'networkidle0' }
        await page.goto(`${baseURL}${route}`, navigationOptions)

        const { renderAfterElementExists } = options
        if (renderAfterElementExists && typeof renderAfterElementExists === 'string') {
          await page.waitForSelector(renderAfterElementExists)
        }
        const waitMs = options.renderAfterTime
        if (waitMs && typeof waitMs === 'number') {
          await new Promise(r => setTimeout(r, waitMs))
        }

        const result = {
          originalRoute: route,
          route: await page.evaluate('window.location.pathname'),
          html: await page.content(),
        }
        const bodyText = await page.evaluate(() => document.body.innerText);
        const invalidMarkers = route.startsWith('/booking/')
          ? ['Загрузка...', 'Домик не найден']
          : route.startsWith('/seo/')
            ? ['Загружаем…', 'Страница не найдена']
            : route.startsWith('/blog/')
              ? ['Загружаем страницу…', 'Статья не найдена']
              : [];
        const marker = invalidMarkers.find((text) => bodyText.includes(text));
        if (marker) {
          await page.close();
          throw new Error(`[prerender] route ${route} captured invalid state: ${marker}`);
        }
        await page.close()
        return result
      }))
    )
    return pagePromises
  }

  destroy () {
    if (this._puppeteer) this._puppeteer.close()
  }
}

const renderer = new PuppeteerRenderer({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  // Capture the page after React has had time to render. The `#root` div
  // exists in the empty HTML shell, so `renderAfterElementExists` would
  // resolve before the SPA mounts. A short time-based wait gives React
  // (and route-bound data fetches) time to populate the DOM.
  renderAfterTime: 3000,
});

// JSON-only model: ВСЕ routes рендерятся. Нет proxy (нет backend). api.ts shim
// отвечает синхронно через in-memory JSON, реальный HTTP не нужен —
// request interceptor выше отдаёт пустой success для любых случайных
// /api/* запросов (например, если какой-то компонент всё ещё дёргает
// fetch('/api/...') напрямую).
const prerenderer = new Prerenderer({
  staticDir: tempDistDir,
  renderer,
  server: {},
});

let renderedRoutes;
try {
  await prerenderer.initialize();
  renderedRoutes = await prerenderer.renderRoutes(routes);
} catch (e) {
  console.error('[prerender] failed:', e?.stack || e);
  process.exit(1);
} finally {
  prerenderer.destroy();
}

let written = 0;
const renderedRoutesForSitemap = [];
for (const { route, html } of renderedRoutes) {
  // ВАЖНО: dist/index.html — это пустая Vite-оболочка для SPA-fallback
  // (когда Apache не нашёл пререндер для подмаршрута и возвращает /index.html,
  // React Router должен отрендерить нужную страницу). Если затереть его
  // полным пререндером главной — пользователь, открыв /blog/foo без слэша,
  // увидит статичную главную поверх которой React пытается гидрироваться.
  // Поэтому пререндер / кладём в __home/, а не в корень.
  const isHome = route === '/' || route === '';
  const normalizedRoute = route.endsWith('/') && route !== '/' ? route : `${route}/`;
  const outDir = isHome ? join(distDir, '__home') : join(distDir, normalizedRoute);
  const outFile = join(outDir, 'index.html');
  mkdirSync(outDir, { recursive: true });
  // Strip the injected <base href="/"> tag back out, and rewrite any
  // relative `./assets/...` URLs to absolute `/assets/...`. The temporary
  // <base> tag was added so the headless browser could resolve assets from
  // deep routes during capture; once we're writing the file to its real
  // location (a subdirectory deploy) we need absolute asset URLs.
  const cleaned = html
    .replace(/\n?\s*<base href="\/">\s*/i, '')
    .replace(/(?:src|href)="\.\/assets\//g, (m) => m.replace('="./', '="/'));
  writeFileSync(outFile, cleaned, 'utf-8');
  written += 1;
  if (!isHome) {
    renderedRoutesForSitemap.push(normalizedRoute);
  }
}

// Sitemap generation (Task 2.7): статический sitemap.xml из отрендеренных routes.
// Раньше это делал backend/src/routes/sitemap.ts динамически; теперь sitemap
// генерируется на этапе build и кладётся в dist/ для раздачи Apache.
const STATIC_SITEMAP_ROUTES = ['/', '/blog/'];
const sitemapRoutes = [...new Set([...STATIC_SITEMAP_ROUTES, ...renderedRoutesForSitemap])]
  .filter((r) => r !== '/404/')
  .sort();
const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapRoutes.flatMap((route) => [
    '  <url>',
    `    <loc>${route}</loc>`,
    '    <changefreq>weekly</changefreq>',
    '  </url>',
  ]),
  '</urlset>',
  '',
].join('\n');
writeFileSync(join(distDir, 'sitemap.xml'), sitemapXml, 'utf-8');

console.log(`[prerender] wrote ${written}/${renderedRoutes.length} HTML file(s) to dist/.`);
console.log(`[prerender] wrote sitemap.xml with ${sitemapRoutes.length} route(s).`);
