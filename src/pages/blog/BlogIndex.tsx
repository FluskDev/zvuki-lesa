import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { seoApi, type BlogListItem } from '@/lib/seoApi';
import { SeoImage } from '@/components/SeoImage';
import { useDocumentHead } from '@/lib/seo';

/**
 * Категории блога. Значения `value` должны совпадать с zod-enum
 * `backend/src/validation/seo.ts:blogPostInputSchema.category`,
 * иначе фильтрация на бэкенде вернёт 400.
 */
const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'гид', label: 'Гид' },
  { value: 'маршруты', label: 'Маршруты' },
  { value: 'сезоны', label: 'Сезоны' },
  { value: 'лагонаки', label: 'Лагонаки' },
  { value: 'достопримечательности', label: 'Достопримечательности' },
  { value: 'развлечения', label: 'Развлечения' },
  { value: 'практика', label: 'Практика' },
];

const PAGE_SIZE = 12;

const CATEGORY_LABEL: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<string, string>,
);

export default function BlogIndex() {
  const [params, setParams] = useSearchParams();
  const pageParam = params.get('page');
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const categoryParam = params.get('category') ?? '';
  const category = categoryParam || undefined;

  const [items, setItems] = useState<BlogListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentHead({
    title: category
      ? `Блог · ${CATEGORY_LABEL[category] ?? category} | Звуки Леса`
      : 'Журнал · гиды и истории Адыгеи | Звуки Леса',
    description:
      'Полевой журнал гостевого дома «Звуки Леса»: гиды, маршруты, истории из Даховской и всей Адыгеи.',
    canonical: `https://zvuki-lesa.ru/blog/${category ? `?category=${encodeURIComponent(category)}` : ''}`,
  });

  // Загружаем основной список + общие количества по категориям без смены страницы.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    seoApi
      .blog(page, category)
      .then(async (r) => {
        if (cancelled) return;
        if (r.success) {
          const data: any = r.data;
          const list = data?.data?.items ?? [];
          setItems(list);
          setTotal(data?.data?.total ?? 0);
          setError(null);

          // Считаем «Все» — догружаем без фильтра на странице 1, чтобы получить общий счётчик
          if (Object.keys(counts).length === 0) {
            const all = await seoApi.blog(1);
            if (!cancelled && all.success) {
              const totalAll = (all.data as any)?.data?.total ?? 0;
              setCounts((prev) => ({ ...prev, '': totalAll }));
            }
          }
        } else {
          setItems([]);
          setTotal(0);
          setError(r.error);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, category]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showPagination = total > PAGE_SIZE;
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;

  const goToCategory = (value: string) => {
    if (value) {
      setParams({ category: value });
    } else {
      setParams({});
    }
  };

  const goToPage = (p: number) => {
    const next = new URLSearchParams();
    if (category) next.set('category', category);
    if (p > 1) next.set('page', String(p));
    setParams(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // На главной странице журнала (без фильтра) показываем первую статью как «обложку».
  const isCover = !category && page === 1;
  const featured = isCover ? items[0] : null;
  const rest = isCover ? items.slice(1) : items;

  return (
    <div className="min-h-screen bg-alpine-ink text-alpine-paper selectable">
      {/* МАСТЕР-ХЕДЕР */}
      <header className="relative overflow-hidden border-b border-alpine-edge">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #F2EDE3 1px, transparent 1px), linear-gradient(to bottom, #F2EDE3 1px, transparent 1px)',
            backgroundSize: '90px 90px',
            maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-40 -right-32 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #C97B4B 0%, transparent 70%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, #7A8F6C 0%, transparent 70%)' }}
        />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="flex items-baseline justify-between gap-6 mb-6">
            <div className="kicker text-alpine-ember flex items-center gap-3">
              <span className="inline-block w-10 h-px bg-alpine-ember" />
              Полевой журнал · 2026
            </div>
            <Link
              to="/"
              className="kicker text-alpine-smoke hover:text-alpine-paper transition-colors"
            >
              ← Звуки Леса
            </Link>
          </div>

          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[0.95] tracking-tight text-glow-warm"
            style={{ animation: 'rise-in 0.9s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            Горный{' '}
            <em className="italic text-alpine-vellum">дневник</em>
            <br />
            <span className="text-alpine-ember">Звуков Леса</span>
          </h1>

          <p
            className="mt-8 max-w-2xl text-lg text-alpine-vellum/90 leading-relaxed"
            style={{ animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}
          >
            Гиды, маршруты и истории Даховской. Без шума — только то, что мы сами показываем
            гостям: горные тропы, тёплые источники, советы, как добраться, где ночевать и что
            попробовать.
          </p>
        </div>
      </header>

      {/* КАТЕГОРИИ */}
      <nav
        aria-label="Категории"
        className="sticky top-0 z-30 bg-alpine-ink/85 backdrop-blur-md border-b border-alpine-edge"
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex gap-2 overflow-x-auto">
          {CATEGORIES.map((c) => {
            const isActive = (category ?? '') === c.value;
            const total = counts[c.value];
            return (
              <button
                key={c.value}
                onClick={() => goToCategory(c.value)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm transition-all border ${
                  isActive
                    ? 'bg-alpine-ember border-alpine-ember text-alpine-ink font-medium'
                    : 'bg-transparent border-alpine-edge text-alpine-smoke hover:border-alpine-line hover:text-alpine-paper'
                }`}
              >
                <span>{c.label}</span>
                {typeof total === 'number' ? (
                  <span
                    className={`ml-2 kicker ${
                      isActive ? 'text-alpine-ink/70' : 'text-alpine-ash'
                    }`}
                  >
                    {total}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ОСНОВНАЯ ЧАСТЬ */}
      <main className="max-w-6xl mx-auto px-5 sm:px-6 py-12 md:py-20">
        {loading ? (
          <div className="text-center py-24">
            <div className="kicker text-alpine-ember mb-3">Загрузка</div>
            <div className="font-display italic text-3xl text-alpine-vellum">Собираем страницу…</div>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <div className="kicker text-red-400 mb-3">Ошибка</div>
            <div className="font-display italic text-2xl text-alpine-vellum">
              Не удалось загрузить статьи: {error}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <div className="kicker text-alpine-ember mb-3">Пусто</div>
            <div className="font-display italic text-3xl text-alpine-vellum">
              {category
                ? `В рубрике «${CATEGORY_LABEL[category]}» пока нет материалов.`
                : 'В журнале пока нет статей.'}
            </div>
          </div>
        ) : (
          <>
            {/* ОБЛОЖКА ВЫПУСКА */}
            {featured ? (
              <section className="mb-16 md:mb-20">
                <FeaturedCard post={featured} />
              </section>
            ) : null}

            {/* СЕТКА */}
            {rest.length > 0 ? (
              <section>
                <div className="flex items-end justify-between gap-6 mb-8">
                  <h2 className="font-display italic text-2xl text-alpine-paper">
                    {isCover ? 'Свежие материалы' : CATEGORY_LABEL[category ?? ''] ?? 'Материалы'}
                  </h2>
                  <span className="kicker text-alpine-ash">
                    {rest.length} {rest.length === 1 ? 'статья' : rest.length < 5 ? 'статьи' : 'статей'}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((p) => (
                    <Card key={p.slug} post={p} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* ПАГИНАЦИЯ */}
            {showPagination ? (
              <nav
                className="mt-20 flex items-center justify-center gap-2"
                aria-label="Пагинация"
              >
                <button
                  onClick={() => goToPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="kicker px-4 py-2 rounded-full border border-alpine-edge text-alpine-smoke hover:border-alpine-line hover:text-alpine-paper disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Назад
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`kicker w-10 h-10 rounded-full transition-colors ${
                      p === safePage
                        ? 'bg-alpine-ember text-alpine-ink'
                        : 'border border-alpine-edge text-alpine-smoke hover:border-alpine-line hover:text-alpine-paper'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  className="kicker px-4 py-2 rounded-full border border-alpine-edge text-alpine-smoke hover:border-alpine-line hover:text-alpine-paper disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Вперёд →
                </button>
              </nav>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function Card({ post }: { post: BlogListItem }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block cover-zoom rounded-sm border border-alpine-edge bg-alpine-card hover:border-alpine-ember/40 transition-colors"
    >
      <div className="aspect-[5/3] relative overflow-hidden">
        {post.coverImage ? (
          <SeoImage
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <CoverGradient slug={post.slug} />
        )}
        <span className="absolute top-3 left-3 kicker px-2 py-1 rounded-sm bg-alpine-ink/70 backdrop-blur-sm text-alpine-paper">
          {CATEGORY_LABEL[post.category] ?? post.category}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-display text-2xl leading-tight text-alpine-paper group-hover:text-alpine-ember transition-colors">
          {post.title}
        </h3>
        <p className="mt-3 text-sm text-alpine-smoke line-clamp-3 leading-relaxed">
          {post.excerpt}
        </p>
        <div className="mt-4 kicker text-alpine-ash flex items-center gap-3">
          <span>{post.readingTimeMin} мин чтения</span>
          <span className="text-alpine-line">·</span>
          <span className="text-alpine-ember group-hover:translate-x-0.5 transition-transform">
            Читать →
          </span>
        </div>
      </div>
    </Link>
  );
}

function FeaturedCard({ post }: { post: BlogListItem }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block relative overflow-hidden rounded-sm border border-alpine-edge bg-alpine-card hover:border-alpine-ember/40 transition-colors"
    >
      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        <div className="cover-zoom aspect-[16/10] lg:aspect-auto lg:min-h-[420px] relative overflow-hidden">
          {post.coverImage ? (
            <SeoImage
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <CoverGradient slug={post.slug} variant="large" />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 lg:bg-gradient-to-r lg:from-transparent lg:to-alpine-card/95"
          />
          <span className="absolute top-5 left-5 kicker px-3 py-1.5 rounded-sm bg-alpine-ember text-alpine-ink">
            Главное в номере
          </span>
        </div>
        <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-center">
          <div className="kicker text-alpine-ember mb-5 flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-alpine-ember" />
            {CATEGORY_LABEL[post.category] ?? post.category}
          </div>
          <h3 className="font-display italic text-3xl md:text-4xl lg:text-[2.6rem] leading-[1.1] text-alpine-paper text-glow-warm group-hover:text-alpine-vellum transition-colors">
            {post.title}
          </h3>
          <p className="mt-5 text-alpine-smoke leading-relaxed line-clamp-4">
            {post.excerpt}
          </p>
          <div className="mt-7 flex items-center gap-4 text-sm">
            <span className="kicker text-alpine-vellum">{post.readingTimeMin} мин чтения</span>
            <span className="text-alpine-line">·</span>
            <span className="kicker text-alpine-ember group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
              Открыть материал →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Атмосферный placeholder под обложку, когда у поста нет картинки.
 * Различается по slug, чтобы карточки не сливались.
 */
function CoverGradient({ slug, variant = 'default' }: { slug: string; variant?: 'default' | 'large' }) {
  const hash = Array.from(slug).reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes = [
    ['#3A2418', '#7A4A2B', '#C97B4B'],
    ['#1E2A24', '#3D5A47', '#7A8F6C'],
    ['#2A2418', '#5A4A2B', '#D4A857'],
    ['#241A28', '#4A2B57', '#9C7AB7'],
    ['#1F2A2C', '#3D5A5E', '#7BA8B7'],
    ['#2B1F1A', '#5A3D2B', '#B78A5C'],
  ];
  const [a, b, c] = palettes[hash % palettes.length];
  const initials = (() => {
    const words = slug.split('-').filter(Boolean);
    const first = words[0]?.[0]?.toUpperCase() ?? '·';
    const second = words[1]?.[0]?.toUpperCase();
    return second ? `${first}${second}` : first;
  })();
  const size = variant === 'large' ? 'text-[12rem]' : 'text-7xl';
  return (
    <div
      className="cover-grad w-full h-full flex items-center justify-center"
      style={{
        background: `radial-gradient(ellipse at 30% 20%, ${c}55, transparent 60%), radial-gradient(ellipse at 80% 80%, ${b}66, transparent 50%), linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
      }}
    >
      <div className={`font-display italic text-alpine-paper/80 ${size} tracking-tighter select-none`}>
        {initials}
      </div>
    </div>
  );
}
