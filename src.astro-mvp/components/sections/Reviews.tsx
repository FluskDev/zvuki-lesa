import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReviewAvatar } from '@/components/ReviewAvatar';
import { Star, ChevronLeft, ChevronRight, Quote, ExternalLink } from 'lucide-react';
import type { ReviewsResponse } from '@/lib/api';

interface ReviewsProps {
  data: ReviewsResponse | null;
  loading: boolean;
}

export function Reviews({ data, loading }: ReviewsProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const reviewsPerPage = 3;

  const reviews = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(reviews.length / reviewsPerPage));

  const currentReviews = reviews.slice(
    currentPage * reviewsPerPage,
    (currentPage + 1) * reviewsPerPage,
  );

  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  useEffect(() => {
    if (reviews.length === 0) return;
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 5000);
    return () => clearInterval(interval);
  }, [totalPages, reviews.length]);

  return (
    <section id="reviews" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Отзывы наших гостей
          </h2>
          <p className="text-lg text-stone-400 max-w-2xl mx-auto">
            {data && data.total > 0
              ? `${data.total} ${
                  data.total === 1
                    ? 'довольный гость'
                    : data.total < 5
                      ? 'довольных гостя'
                      : 'довольных гостей'
                } оставили свои впечатления о пребывании в нашем домике`
              : 'Более 50 довольных гостей оставили свои впечатления о пребывании в нашем домике'}
          </p>
          {data && data.total > 0 && (
            <div className="flex items-center justify-center gap-1 mt-3 text-sm text-stone-300">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{data.averageRating.toFixed(1)}</span>
              <span className="text-stone-500">/ 5</span>
              <span className="text-stone-500 ml-2">({data.total})</span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="text-center text-stone-500 py-12">
            {loading ? 'Загружаем отзывы...' : 'Отзывы скоро появятся.'}
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {currentReviews.map((review) => {
                // Ссылка на Яндекс.Карты: профиль автора (точнее) или общая страница отзывов.
                const yandexHref = review.authorUrl ?? data?.yandexReviewsUrl ?? null;
                const cardInner = (
                  <CardContent className="p-6 flex flex-col h-full">
                    <Quote className="w-8 h-8 text-emerald-400 mb-4" />

                    <div className="flex items-center gap-1 mb-3">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>

                    <p className="text-stone-200 text-sm leading-relaxed flex-grow mb-4 line-clamp-6">
                      {review.text}
                    </p>

                    <div className="pt-4 border-t border-stone-600">
                      <div className="flex items-center gap-2.5">
                        <ReviewAvatar src={review.avatarUrl} name={review.authorName} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white leading-tight">{review.authorName}</p>
                          <p className="text-xs text-stone-400 leading-tight">
                            {new Date(review.date).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        {yandexHref && (
                          <span
                            aria-hidden="true"
                            className="text-stone-500 group-hover:text-emerald-400 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                );
                const cardClass =
                  'h-full bg-stone-800 border-stone-700 transition-shadow duration-300 group ' +
                  (yandexHref ? 'hover:shadow-lg hover:border-emerald-700/50 cursor-pointer' : '');
                if (yandexHref) {
                  return (
                    <a
                      key={review.id}
                      href={yandexHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Открыть отзыв ${review.authorName} на Яндекс.Картах`}
                      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-xl"
                    >
                      <Card className={cardClass}>{cardInner}</Card>
                    </a>
                  );
                }
                return (
                  <Card key={review.id} className={cardClass}>
                    {cardInner}
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-center items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={prevPage}
                className="rounded-full w-10 h-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <div className="flex gap-2">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === currentPage ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={nextPage}
                className="rounded-full w-10 h-10"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
