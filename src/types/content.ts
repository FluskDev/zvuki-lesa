// src/types/content.ts
//
// Единая точка входа для всего статического контента сайта «Звуки леса».
// После удаления backend (Phase 2) данные домиков, услуг, отзывов, SEO-страниц
// и блога читаются напрямую из src/data/*.json (сгенерированы scripts/export-data.mjs,
// см. .superpowers/sdd/2026-09-19-realtycalendar-replacement/task-2.0-report.md).
//
// Правила:
//   1. Все типы повторяют snake_case форму JSON-файлов (1-к-1 с колонками БД).
//      Это упрощает импорт: фронт работает с тем же shape, что был в API.
//   2. camelCase-обёртки (mapId, cottageId, checkInTime, …) делаются в
//      хуках (Task 2.2), а не на уровне типов — иначе будет рассинхрон
//      между JSON и типами.
//   3. Enum-значения выписаны литералами (не string) — TS сужает type-check
//      и подсказывает автокомплит в IDE.
//   4. Nullable поля помечены `T | null` явно. Там, где в БД было `text NULL`,
//      JSON даёт `null` (а не `undefined`), и тип это отражает.

import amenities from '@/data/amenities.json';
import recreationItems from '@/data/recreation-items.json';
import services from '@/data/services.json';
import cottages from '@/data/cottages.json';
import cottageImages from '@/data/cottage-images.json';
import cottageAmenities from '@/data/cottage-amenities.json';
import seoPages from '@/data/seo-pages.json';
import blogPosts from '@/data/blog-posts.json';
import siteMapElements from '@/data/site-map-elements.json';
import reviews from '@/data/reviews.json';
import manifest from '@/data/manifest.json';

// ───────────────────────────── Amenities ─────────────────────────────

export interface Amenity {
  id: number;
  name: string;
  /** У всех текущих записей = null (icon пока не используется). Поле сохранено,
   *  чтобы фронт мог отрисовать fallback-эмодзи или подгрузить icon позже. */
  icon: string | null;
}

export type Amenities = Amenity[];

// ─────────────────────────── Recreation items ────────────────────────

export interface RecreationItem {
  id: number;
  /** FK → cottages.id (нет в новом экспорте, т.к. recreation_items привязан
   *  к статическому CABINS, а не к cottages.json; поле оставлено для совместимости). */
  cottage_id: number;
  title: string;
  description: string;
  photo: string;
  position: number;
}

export type RecreationItems = RecreationItem[];

// ───────────────────────────── Services ──────────────────────────────

export interface Service {
  id: number;
  slug: string;
  name: string;
  description: string;
  base_price: number;
  icon: string;
  is_active: boolean;
  position: number;
}

export type Services = Service[];

// ───────────────────────────── Cottages ──────────────────────────────

export interface Cottage {
  id: number;
  slug: string;
  /** Связь с точкой на SiteMap: «Домик1» | «Домик2».
   *  До удаления backend был ещё «Домик3» — откатили в commit c05f195. */
  map_id: string;
  name: string;
  short_description: string;
  long_description: string;
  description: string;
  house_rules: string;
  base_price: number;
  area: number;
  guests: number;
  bedrooms: number;
  beds_double: number;
  beds_single: number;
  /** Время в формате «HH:MM» либо диапазон («14:00 – 23:00»). */
  check_in_time: string;
  /** Аналогично, часто «до 12:00». */
  check_out_time: string;
  main_image: string;
  is_active: boolean;
  created_at: string;
}

export type Cottages = Cottage[];

// ─────────────────────────── Cottage images ──────────────────────────

export type CottageImageSection =
  | 'main'
  | 'interior'
  | 'kitchen'
  | 'bathroom'
  | 'amenities';

export interface CottageImage {
  id: number;
  cottage_id: number;
  url: string;
  section: CottageImageSection;
  position: number;
}

export type CottageImages = CottageImage[];

// ───────────────────────── Cottage amenities ─────────────────────────

export interface CottageAmenity {
  cottage_id: number;
  amenity_id: number;
}

export type CottageAmenities = CottageAmenity[];

// ───────────────────────────── SEO pages ─────────────────────────────

export type SeoIntent =
  | 'горы-адыгеи'
  | 'термальные-источники'
  | 'лагонаки'
  | 'даховская'
  | 'домики'
  | 'активности'
  | 'сезоны';

export interface SeoPage {
  id: number;
  slug: string;
  title: string;
  description: string;
  h1: string;
  /** Markdown-подобный body (хранится как text в БД). */
  body: string;
  meta_image: string | null;
  intent: SeoIntent;
  /** JSON-LD в виде строки (валидируется zod-схемой на этапе импорта). */
  schema_json: string;
  is_published: boolean;
  /** Используется в Footer «Популярные направления» (priority >= 0.8). */
  priority: number;
  created_at: string;
  updated_at: string;
}

export type SeoPages = SeoPage[];

// ───────────────────────────── Blog posts ────────────────────────────

export type BlogCategory =
  | 'гид'
  | 'маршруты'
  | 'сезоны'
  | 'лагонаки'
  | 'достопримечательности'
  | 'развлечения'
  | 'практика';

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image: string | null;
  author: string;
  category: BlogCategory;
  reading_time_min: number;
  schema_json: string;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export type BlogPosts = BlogPost[];

// ─────────────────────────── Images registry ─────────────────────────

// images-registry.json удалён вместе с backend (Task 2.5). Тип
// оставлен на случай будущего восстановления реестра (SEO alt-фоллбэк
// в SeoImage.tsx), но JSON-импорт и константа убраны — admin UI,
// который реестр наполнял, больше не существует.
export interface ImagesRegistryEntry {
  id: number;
  /** Публичный путь от корня: '/uploads/...', '/Galary/...' и т.п. */
  path: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
  uploaded_by: string;
  created_at: string;
}

export type ImagesRegistry = ImagesRegistryEntry[];

// ───────────────────────── Site map elements ─────────────────────────

/** Произвольная метка из БД (Парковка / Лес1 / Лес2 / чан / …).
 *  Для домиков (Домик1 / Домик2) site_map_elements НЕ используется —
 *  их контент идёт напрямую из cottages.json. */
export interface SiteMapElement {
  map_id: string;
  title: string;
  description: string;
  photo_url: string;
  has_button: boolean;
  updated_at: string;
}

export type SiteMapElements = SiteMapElement[];

// ───────────────────────────── Reviews ───────────────────────────────

/** В текущем экспорте все отзывы = yandex. Тип оставлен extensible. */
export type ReviewSource = 'yandex' | '2gis' | 'google' | 'manual';

export interface Review {
  id: number;
  author_name: string;
  /** Целое 1..5. */
  rating: number;
  text: string;
  /** ISO 8601. */
  date: string;
  source: ReviewSource;
  is_published: boolean;
  /** Хеш отзыва от источника (для дедупликации). */
  external_id: string;
  /** Пусто, если аватарка у автора отсутствует (Костя Лебедев, id=47). */
  avatar_url: string | null;
  /** Ссылка на профиль автора у источника. null, если профиля нет. */
  author_url: string | null;
}

export type Reviews = Review[];

// ──────────────────────────── Manifest ───────────────────────────────

export interface ContentManifest {
  /** ISO 8601 момент экспорта. */
  exportedAt: string;
  tables: Record<string, number>;
}

// ───────────────────── Typed re-exports (compile-time safe) ──────────

/** ВАЖНО: эти константы — массивы с зафиксированным типом на этапе компиляции.
 *  Vite на этапе бандла инлайнит JSON, так что рантайм-стоимость нулевая.
 *  Использовать в хуках/компонентах вместо прямого импорта из '@/data/*'. */

/** JSON-импорты дают широкий `string` для enum-полей (CottageImageSection,
 *  SeoIntent, BlogCategory, ReviewSource). Cast'ы внизу сужают их до
 *  compile-time-литералов: схема валидируется zod'ом в scripts/export-data.mjs,
 *  а здесь мы доверяем runtime-данным (см. content-types.test.ts). */

export const AMENITIES: Amenities = amenities;
export const RECREATION_ITEMS: RecreationItems = recreationItems;
export const SERVICES: Services = services;
export const COTTAGES: Cottages = cottages;
export const COTTAGE_IMAGES: CottageImages = cottageImages as unknown as CottageImages;
export const COTTAGE_AMENITIES: CottageAmenities = cottageAmenities;
export const SEO_PAGES: SeoPages = seoPages as unknown as SeoPages;
export const BLOG_POSTS: BlogPosts = blogPosts as unknown as BlogPosts;
export const SITE_MAP_ELEMENTS: SiteMapElements = siteMapElements;
export const REVIEWS: Reviews = reviews as unknown as Reviews;

export const CONTENT_MANIFEST: ContentManifest = manifest;
