// Генерация dist/sitemap.xml из scripts/routes.manifest.json.
//
// Раньше это был хвост scripts/prerender.mjs — после рендера через Puppeteer
// sitemap.xml писался на основе отрендеренных routes. Теперь, когда build идёт
// без пререндера (см. CLAUDE.md / change «убираем пререндер из build»), sitemap
// генерируется отдельным шагом — без браузера, чистая работа с JSON-манифестом.
//
// /404 исключаем: это служебный маршрут для Apache ErrorDocument, в публичный
// sitemap его класть не нужно. Точно так же делал прежний prerender.mjs (там был
// `.filter((r) => r !== '/404/')`).

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateRoutesFromManifest } from './fetch-slugs-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const manifestPath = resolve(__dirname, 'routes.manifest.json');
const distDir = resolve(repoRoot, 'dist');

if (!existsSync(distDir)) {
  console.error(`[sitemap] dist/ not found at ${distDir} — run \`vite build\` first.`);
  process.exit(1);
}

const routes = generateRoutesFromManifest(manifestPath);

const STATIC_SITEMAP_ROUTES = ['/', '/blog/'];
const sitemapRoutes = [...new Set([...STATIC_SITEMAP_ROUTES, ...routes])]
  .filter((r) => r !== '/404/')
  // Нормализуем: все route-ы в sitemap должны заканчиваться на / (кроме /).
  .map((r) => (r === '/' || r === '' ? '/' : r.endsWith('/') ? r : `${r}/`))
  .sort();

const sitemapBody = [
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

writeFileSync(join(distDir, 'sitemap.xml'), sitemapBody, 'utf-8');

console.log(`[sitemap] wrote ${sitemapRoutes.length} route(s) to dist/sitemap.xml.`);