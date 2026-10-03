import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { seoApi, type SeoPage, type SeoPageListItem } from '@/lib/seoApi';
import { useDocumentHead } from '@/lib/seo';
import { SeoImage } from '@/components/SeoImage';
import { useCottages } from '@/hooks/useCottages';

interface LoadResult {
  slug: string;
  page: SeoPage | null;
}

function parseSchema(schemaJson: string | undefined): object | object[] | undefined {
  if (!schemaJson) return undefined;
  try {
    return JSON.parse(schemaJson);
  } catch {
    return undefined;
  }
}

const INTENT_LABEL: Record<string, string> = {
  'горы-адыгеи': 'Горы Адыгеи',
  'термальные-источники': 'Термальные источники',
  лагонаки: 'Лагонаки',
  даховская: 'Даховская',
  домики: 'Домики',
  активности: 'Активности',
  сезоны: 'Сезоны',
};

export default function SeoPageView() {
  const { slug } = useParams();
  const [result, setResult] = useState<LoadResult | null>(null);
  const [related, setRelated] = useState<SeoPageListItem[]>([]);
  const { data: cottages } = useCottages();

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const requestedSlug = slug;

    seoApi.get(requestedSlug).then((r) => {
      if (cancelled) return;
      if (!r.success || !r.data.page) {
        setResult({ slug: requestedSlug, page: null });
        setRelated([]);
        return;
      }
      const loaded = r.data.page;
      setResult({ slug: requestedSlug, page: loaded });
      seoApi.list().then((list) => {
        if (cancelled || !list.success) return;
        const pages = (list.data as any)?.pages ?? [];
        setRelated(
          pages
            .filter((p: SeoPageListItem) => p.intent === loaded.intent && p.slug !== requestedSlug)
            .slice(0, 4),
        );
      });
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const current = result && result.slug === slug ? result : null;
  const page = current?.page ?? null;

  useDocumentHead({
    title: page?.title,
    description: page?.description,
    canonical: page ? `https://zvuki-lesa.ru/seo/${page.slug}/` : undefined,
    ogImage: page?.metaImage ?? undefined,
    schema: page ? parseSchema(page.schemaJson) : undefined,
  });

  if (!current) {
    return (
      <div className="min-h-screen bg-alpine-ink text-alpine-paper selectable">
        <div className="max-w-3xl mx-auto px-4 py-24 text-alpine-smoke">
          <div className="kicker text-alpine-ember mb-2">Страница · Звуки Леса</div>
          <div className="font-display italic text-2xl">Загружаем…</div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-alpine-ink text-alpine-paper selectable flex items-center justify-center px-4 py-20">
        <div className="max-w-xl text-center">
          <div className="kicker text-alpine-ember mb-4">404 · Не найдено</div>
          <h1 className="font-display italic text-5xl md:text-6xl mb-6 text-glow-warm">
            Страница не найдена
          </h1>
          <p className="text-alpine-smoke mb-10 leading-relaxed">
            Возможно, она была удалена или ещё не опубликована.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-alpine-ember/90 hover:bg-alpine-ember text-alpine-ink font-medium transition-colors"
          >
            ← На главную
          </Link>
        </div>
      </div>
    );
  }

  const intentLabel = INTENT_LABEL[page.intent] ?? page.intent;
  const sanitizedBody = DOMPurify.sanitize(page.body);
  const topCottages = cottages?.slice(0, 3) ?? [];

  return (
    <div className="min-h-screen bg-alpine-ink text-alpine-paper selectable">
      <article>
        {/* HERO */}
        <header
          className="relative overflow-hidden border-b border-alpine-edge"
          style={{
            background:
              'radial-gradient(ellipse at 20% 0%, rgba(201,123,75,0.18), transparent 55%), radial-gradient(ellipse at 90% 30%, rgba(212,168,87,0.10), transparent 50%), linear-gradient(180deg, #0F0F0E 0%, #1F1D1A 100%)',
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #F2EDE3 1px, transparent 1px), linear-gradient(to bottom, #F2EDE3 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-16 pb-16 md:pt-24 md:pb-24">
            <nav className="kicker text-alpine-smoke mb-8 flex items-center gap-2 select-none">
              <Link to="/" className="hover:text-alpine-paper transition-colors">Звуки Леса</Link>
              <span className="text-alpine-line">/</span>
              <span className="text-alpine-vellum">{intentLabel}</span>
            </nav>

            <div
              className="kicker text-alpine-ember mb-5 inline-flex items-center gap-3"
              style={{ animation: 'fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}
            >
              <span className="inline-block w-8 h-px bg-alpine-ember" />
              {intentLabel}
            </div>

            <h1
              className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight text-glow-warm"
              style={{ animation: 'rise-in 1s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}
            >
              {page.h1}
            </h1>

            {page.description ? (
              <p
                className="mt-6 text-lg text-alpine-vellum/90 leading-relaxed max-w-2xl"
                style={{ animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both' }}
              >
                {page.description}
              </p>
            ) : null}
          </div>
        </header>

        {/* ОБЛОЖКА */}
        {page.metaImage ? (
          <div className="max-w-5xl mx-auto px-5 sm:px-6 -mt-6 md:-mt-10 relative z-10">
            <div className="overflow-hidden rounded-sm border border-alpine-edge aspect-[21/9]">
              <SeoImage
                src={page.metaImage}
                alt={page.h1}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        ) : null}

        {/* ТЕЛО */}
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 md:py-20">
          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
            style={{ animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}
          />
          <div className="journal-rule my-16" />
        </div>

        {/* ДОМИКИ */}
        {topCottages.length > 0 ? (
          <section className="border-t border-alpine-edge bg-alpine-night">
            <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
              <div className="mb-10">
                <div className="kicker text-alpine-ember mb-3 flex items-center gap-2">
                  <span className="inline-block w-6 h-px bg-alpine-ember" />
                  Где остановиться
                </div>
                <h2 className="font-display italic text-3xl md:text-4xl text-alpine-paper">
                  Наши домики
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {topCottages.map((c) => (
                  <Link
                    key={c.id}
                    to={`/booking/${c.slug}`}
                    className="group block cover-zoom rounded-sm border border-alpine-edge bg-alpine-card hover:border-alpine-ember/40 transition-colors"
                  >
                    <div className="aspect-[5/3] overflow-hidden">
                      <SeoImage
                        src={c.mainImage}
                        alt={c.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-5">
                      <div className="font-display text-2xl text-alpine-paper group-hover:text-alpine-ember transition-colors">
                        {c.name}
                      </div>
                      <div className="mt-2 kicker text-alpine-smoke flex items-center justify-between">
                        <span>от {c.basePrice} ₽/ночь</span>
                        <span className="text-alpine-ember group-hover:translate-x-0.5 transition-transform">Бронь →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ПОХОЖИЕ */}
        {related.length > 0 ? (
          <section className="border-t border-alpine-edge">
            <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
              <div className="flex items-end justify-between gap-6 mb-10">
                <div>
                  <div className="kicker text-alpine-ember mb-3 flex items-center gap-2">
                    <span className="inline-block w-6 h-px bg-alpine-ember" />
                    Соседние направления
                  </div>
                  <h2 className="font-display italic text-3xl md:text-4xl text-alpine-paper">
                    Смотрите также
                  </h2>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/seo/${r.slug}`}
                    className="group block rounded-sm border border-alpine-edge bg-alpine-card hover:border-alpine-ember/40 p-6 transition-colors"
                  >
                    {r.metaImage ? (
                      <div className="aspect-[16/9] overflow-hidden rounded-sm mb-4">
                        <SeoImage
                          src={r.metaImage}
                          alt={r.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    <h3 className="font-display text-2xl text-alpine-paper group-hover:text-alpine-ember transition-colors leading-tight">
                      {r.title}
                    </h3>
                    <p className="mt-3 text-sm text-alpine-smoke line-clamp-2 leading-relaxed">
                      {r.description}
                    </p>
                    <div className="mt-3 kicker text-alpine-ember group-hover:translate-x-0.5 transition-transform">
                      Открыть →
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* CTA */}
        <section className="relative grain overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 30% 50%, rgba(201,123,75,0.18), transparent 60%), radial-gradient(circle at 80% 80%, rgba(122,143,108,0.12), transparent 55%)',
            }}
          />
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6 py-20 md:py-28 text-center">
            <div className="kicker text-alpine-ember mb-5">Следующий шаг</div>
            <h2 className="font-display italic text-4xl md:text-5xl text-alpine-paper text-glow-warm mb-6 leading-tight">
              Забронировать домик
            </h2>
            <p className="text-alpine-vellum mb-10 leading-relaxed max-w-xl mx-auto">
              Менеджер подберёт даты и маршрут, поможет с дорогой и ответит на все вопросы.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/"
                className="px-6 py-3 rounded-full bg-alpine-ember hover:bg-alpine-ember/90 text-alpine-ink font-medium transition-colors"
              >
                На главную
              </Link>
              <a
                href="tel:+79282110249"
                className="px-6 py-3 rounded-full border border-alpine-line hover:border-alpine-ember text-alpine-paper transition-colors"
              >
                +7 (928) 211-02-49
              </a>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
