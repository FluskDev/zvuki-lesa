// Билд фронта НЕ ходит в БД: список маршрутов для prerender живёт в
// `scripts/routes.manifest.json`. Этот файл поддерживается руками при
// публикации SEO/блога через /admin, либо обновляется через
// `npm run routes:sync` на машине с доступом к БД.
//
// /search намеренно исключён: кандидат в soft-404, уникального контента нет.
// /404 — системная страница для несуществующих URL (React Router catch-all).
// Пререндерится в dist/404/index.html, чтобы Apache мог отдавать её как
// ErrorDocument 404 с реальным HTTP-статусом.
import { readFileSync } from 'node:fs';

export const STATIC_ROUTES = ['/', '/blog', '/404'];

const DEFAULT_MANIFEST = {
  cottages: [],
  seoPages: [],
  blogPosts: [],
};

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function buildRoutes({ cottages, seoPages, blogPosts }) {
  return [...new Set([
    ...STATIC_ROUTES,
    ...cottages.map((slug) => `/booking/${slug}`),
    ...seoPages.map((slug) => `/seo/${slug}`),
    ...blogPosts.map((slug) => `/blog/${slug}`),
  ])];
}

export function loadManifest(manifestPath, readJson = defaultReadJson) {
  if (!manifestPath) return { ...DEFAULT_MANIFEST };
  let parsed;
  try {
    parsed = readJson(manifestPath);
  } catch (error) {
    throw new Error(`[fetch-slugs] не удалось прочитать manifest ${manifestPath}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[fetch-slugs] manifest должен быть JSON-объектом, получено ${typeof parsed}`);
  }
  const { cottages, seoPages, blogPosts } = parsed;
  if (cottages !== undefined && !isStringArray(cottages)) {
    throw new Error('[fetch-slugs] manifest.cottages должен быть массивом строк');
  }
  if (seoPages !== undefined && !isStringArray(seoPages)) {
    throw new Error('[fetch-slugs] manifest.seoPages должен быть массивом строк');
  }
  if (blogPosts !== undefined && !isStringArray(blogPosts)) {
    throw new Error('[fetch-slugs] manifest.blogPosts должен быть массивом строк');
  }
  return {
    cottages: cottages ?? [],
    seoPages: seoPages ?? [],
    blogPosts: blogPosts ?? [],
  };
}

export function generateRoutesFromManifest(manifestPath, readJson = defaultReadJson) {
  const manifest = loadManifest(manifestPath, readJson);
  return buildRoutes(manifest);
}

function defaultReadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}
