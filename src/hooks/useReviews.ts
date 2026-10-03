import { useMemo } from 'react';
import { REVIEWS } from '@/types/content';
import type { Review, ReviewsResponse } from '@/lib/api';

/**
 * Источник правды: src/data/reviews.json (сгенерирован scripts/export-data.mjs).
 * После удаления backend (Phase 2) — синхронный import вместо fetch('/api/reviews').
 *
 * Фильтрует is_published, сортирует по дате (свежие первые), считает средний рейтинг.
 * Возвращает ту же форму, что и раньше (ReviewsResponse), чтобы тесты
 * (structuredData.test.ts, HomePage.test.tsx) и потребители не переписывать.
 */
export interface UseReviewsResult {
  data: ReviewsResponse | null;
  loading: boolean;
  error: string | null;
}

/** Fallback ссылка на страницу бизнеса на Яндекс.Картах. Используется, когда
 *  у отзыва нет author_url — отдаём общую страницу, чтобы Schema.org review[]
 *  имел author.url где возможно. */
const YANDEX_REVIEWS_URL = 'https://yandex.ru/maps/org/zvuki_lesa/';

export function useReviews(): UseReviewsResult {
  const data = useMemo<ReviewsResponse>(() => {
    const published = REVIEWS.filter((r) => r.is_published);
    const items: Review[] = published
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map((r) => ({
        id: r.id,
        authorName: r.author_name,
        rating: r.rating,
        text: r.text,
        date: r.date,
        source: r.source,
        isPublished: r.is_published,
        avatarUrl: r.avatar_url,
        authorUrl: r.author_url,
      }));

    const total = items.length;
    const averageRating =
      total > 0
        ? Math.round(
            (items.reduce((sum, r) => sum + r.rating, 0) / total) * 10,
          ) / 10
        : 0;

    return {
      items,
      averageRating,
      total,
      yandexReviewsUrl: YANDEX_REVIEWS_URL,
    };
  }, []);

  // Синхронный источник — loading всегда false, error всегда null.
  return { data, loading: false, error: null };
}
