/**
 * Типы для контента, который раньше приходил из backend API,
 * а теперь читается синхронно из src/data/*.json (см. src/types/content.ts).
 *
 * Эти интерфейсы — **обратно-совместимый мост** между snake_case JSON
 * и camelCase кодом потребителей (Cabins, BookingPage, SeoPage, SiteMap,
 * structuredData). Преобразование делают хуки useCottages / useReviews.
 *
 * API_SHIM (apiFetch + getCottages/getCottage/getReviews):
 *   Исторически эти функции делали fetch на /api/cottages, /api/cottages/:id,
 *   /api/reviews. После удаления backend (Task 2.5) они перенаправлены на
 *   синхронное чтение из src/data/*.json (тот же ApiResult<T> shape).
 *   Полный рефакторинг потребителей на sync импорты — Task 2.7 (prerender).
 */

import {
  COTTAGES,
  SEO_PAGES,
  BLOG_POSTS,
  REVIEWS,
} from '@/types/content';

const API_BASE = '/api';

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; details?: unknown };

// ───────────────────────── API shim (JSON-backed) ────────────────────

/** Простейший JSON-router: сопоставляет path → соответствующий JSON.
 *  Используется ТОЛЬКО переходным shim'ом для legacy вызовов; новый код
 *  должен импортировать напрямую из @/types/content. */
function routeFromJson<T>(path: string): Promise<ApiResult<T>> {
  // Нормализуем: shim принимает и старый "/api/blog/..." и новый "/blog/...".
  // В Task 2.7 (prerender rewrite) seoApi.ts будет переписан на sync-импорты,
  // и "/api" префикс исчезнет. Пока — мягкая совместимость.
  const normalized = path.startsWith('/api/') ? path.slice(4) : path;
  const cottagesList = COTTAGES.map((c) => ({
    id: c.id,
    slug: c.slug,
    mapId: c.map_id,
    name: c.name,
    shortDescription: c.short_description,
    longDescription: c.long_description,
    description: c.description,
    houseRules: c.house_rules,
    basePrice: c.base_price,
    area: c.area,
    guests: c.guests,
    bedrooms: c.bedrooms,
    beds: { double: c.beds_double, single: c.beds_single },
    checkInTime: c.check_in_time,
    checkOutTime: c.check_out_time,
    mainImage: c.main_image,
    amenities: [] as string[],
    gallery: [] as string[],
    images: [] as Array<{ id: number; url: string; section: string; position: number }>,
    recreation: [] as Array<{ id: number; title: string; description: string; photo: string }>,
  }));

  if (normalized === '/cottages') {
    return Promise.resolve({ success: true, data: { cottages: cottagesList } as unknown as T });
  }
  const cottageMatch = normalized.match(/^\/cottages\/([^/]+)$/);
  if (cottageMatch) {
    const idOrSlug = cottageMatch[1];
    const found = COTTAGES.find(
      (c) => String(c.id) === idOrSlug || c.slug === idOrSlug,
    );
    if (!found) {
      return Promise.resolve({
        success: false,
        error: 'Cottage not found',
        code: 'NOT_FOUND',
      });
    }
    const cottage = cottagesList.find((c) => c.id === found.id)!;
    return Promise.resolve({ success: true, data: { cottage } as unknown as T });
  }

  if (normalized === '/reviews') {
    return Promise.resolve({ success: true, data: { data: REVIEWS } as unknown as T });
  }

  if (normalized === '/seo') {
    const list = SEO_PAGES.filter((p) => p.is_published).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      h1: p.h1,
      metaImage: p.meta_image,
      intent: p.intent,
      priority: p.priority,
    }));
    return Promise.resolve({ success: true, data: { pages: list } as unknown as T });
  }
  const seoMatch = normalized.match(/^\/seo\/([^/]+)$/);
  if (seoMatch) {
    const found = SEO_PAGES.find((p) => p.slug === seoMatch[1] && p.is_published);
    if (!found) return Promise.resolve({ success: false, error: 'Page not found', code: 'NOT_FOUND' });
    return Promise.resolve({
      success: true,
      data: {
        page: {
          id: found.id,
          slug: found.slug,
          title: found.title,
          description: found.description,
          h1: found.h1,
          metaImage: found.meta_image,
          intent: found.intent,
          priority: found.priority,
          body: found.body,
          schemaJson: found.schema_json,
        },
      } as unknown as T,
    });
  }

  if (normalized === '/blog' || normalized.startsWith('/blog?')) {
    const all = BLOG_POSTS.filter((p) => p.is_published);
    return Promise.resolve({
      success: true,
      data: {
        data: { items: all, total: all.length, page: 1, pageSize: all.length },
      } as unknown as T,
    });
  }
  const blogMatch = normalized.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const found = BLOG_POSTS.find((p) => p.slug === blogMatch[1] && p.is_published);
    if (!found) return Promise.resolve({ success: false, error: 'Post not found', code: 'NOT_FOUND' });
    return Promise.resolve({
      success: true,
      data: {
        post: {
          id: found.id,
          slug: found.slug,
          title: found.title,
          excerpt: found.excerpt,
          coverImage: found.cover_image,
          category: found.category,
          readingTimeMin: found.reading_time_min,
          publishedAt: found.published_at,
          body: found.body,
          author: found.author,
          schemaJson: found.schema_json,
        },
      } as unknown as T,
    });
  }

  if (normalized === '/images') {
    // images-registry.json удалён вместе с backend (Task 2.5). SeoImage.tsx
    // всё ещё дёргает /images для alt-фоллбэка, но apiFetch отдаёт пустой
    // массив — SeoImage просто ничего не найдёт и оставит дефолтный alt.
    return Promise.resolve({ success: true, data: [] as unknown as T });
  }

  return Promise.resolve({
    success: false,
    error: `No shim route for ${normalized}`,
    code: 'NOT_FOUND',
  });
}

export async function apiFetch<T>(path: string, _init?: RequestInit): Promise<ApiResult<T>> {
  try {
    return await routeFromJson<T>(path);
  } catch (err) {
    console.error('[api]', err);
    return { success: false, error: 'Нет связи с источником данных' };
  }
}

// ─────────────────────────── Public types ────────────────────────────

export type CottageSection = 'main' | 'interior' | 'kitchen' | 'bathroom' | 'amenities';

export interface CottageImage {
  id: number;
  url: string;
  section: CottageSection;
  position: number;
}

export interface Cottage {
  id: number;
  slug: string;
  mapId: string | null;
  name: string;
  shortDescription: string;
  longDescription: string;
  description: string;
  houseRules: string;
  basePrice: number;
  area: number;
  guests: number;
  bedrooms: number;
  beds: { double: number; single: number };
  checkInTime: string;
  checkOutTime: string;
  mainImage: string;
  amenities: string[];
  gallery: string[];
  images: CottageImage[];
  recreation: { id: number; title: string; description: string; photo: string }[];
}

export interface Service {
  id: number;
  slug: string;
  name: string;
  description: string;
  basePrice: number | null;
  icon: string;
}

export interface Review {
  id: number;
  authorName: string;
  rating: number;
  text: string;
  date: string;
  source: '2gis' | 'yandex' | 'google' | 'manual';
  isPublished: boolean;
  /** Локальный URL аватара (/uploads/reviews/avatars/<hash>.webp). null = рисуем инициалы. */
  avatarUrl: string | null;
  /** Прямая ссылка на отзыв/профиль во внешнем источнике (Яндекс.Карты и т.п.). null = не импортировано. */
  authorUrl: string | null;
}

export interface ReviewsResponse {
  items: Review[];
  averageRating: number;
  total: number;
  /** Fallback на страницу отзывов бизнеса на Яндекс.Картах (если у отзыва нет authorUrl). */
  yandexReviewsUrl: string | null;
}

// ─────────────────────────── Legacy getters (shims) ─────────────────

export async function getCottages() {
  return apiFetch<{ cottages: Cottage[] }>('/cottages');
}

export async function getCottage(idOrSlug: string | number) {
  return apiFetch<{ cottage: Cottage }>(`/cottages/${idOrSlug}`);
}

export async function getReviews() {
  return apiFetch<{ data: ReviewsResponse }>('/reviews');
}
