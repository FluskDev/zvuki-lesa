import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { seoApi, type BlogListItem } from '@/lib/seoApi';
import { useDocumentHead } from '@/lib/seo';
import { SeoImage } from '@/components/SeoImage';

interface LoadResult {
  slug: string;
  post: import('@/lib/seoApi').BlogPost | null;
}

interface TocItem {
  id: string;
  text: string;
}

function parseSchema(schemaJson: string | undefined): object | object[] | undefined {
  if (!schemaJson) return undefined;
  try {
    return JSON.parse(schemaJson);
  } catch {
    return undefined;
  }
}

function slugify(text: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: 'y', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const lower = text.toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (map[ch] !== undefined) out += map[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/[а-яё]/.test(ch)) {
      // пропускаем русские буквы без транслитерации — выше мы их уже покрыли map
    } else {
      out += '-';
    }
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
}

function buildToc(body: string): TocItem[] {
  const matches = body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  const items: TocItem[] = [];
  let i = 0;
  for (const m of matches) {
    const raw = m[1].replace(/<[^>]+>/g, '').trim();
    if (!raw) continue;
    i += 1;
    items.push({ id: `section-${i}-${slugify(raw)}`, text: raw });
  }
  return items;
}

function injectAnchors(body: string, items: TocItem[]): string {
  if (items.length === 0) return body;
  let i = 0;
  return body.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs, inner) => {
    i += 1;
    const item = items[i - 1];
    if (!item) return _m;
    const anchor = `<a href="#${item.id}" class="anchor-link" aria-label="Ссылка на раздел">#</a>`;
    return `<h2 id="${item.id}"${attrs}>${inner}${anchor}</h2>`;
  });
}

// Безопасный список категорий — см. seoApi/BlogIndex
const CATEGORY_LABEL: Record<string, string> = {
  '': 'Все',
  гид: 'Гид',
  маршруты: 'Маршруты',
  сезоны: 'Сезоны',
  лагонаки: 'Лагонаки',
  достопримечательности: 'Достопримечательности',
  развлечения: 'Развлечения',
  практика: 'Практика',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogPostView() {
  const { slug } = useParams();
  const [result, setResult] = useState<LoadResult | null>(null);
  const [related, setRelated] = useState<BlogListItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const requestedSlug = slug;

    seoApi
      .blogPost(requestedSlug)
      .then((r) => {
        if (cancelled) return;
        if (!r.success || !r.data.post) {
          setResult({ slug: requestedSlug, post: null });
          setRelated([]);
          return;
        }
        setResult({ slug: requestedSlug, post: r.data.post });

        seoApi.blog(1, r.data.post.category).then((list) => {
          if (cancelled) return;
          if (list.success) {
            const items = (list.data as any)?.data?.items ?? [];
            setRelated(
              items
                .filter((p: BlogListItem) => p.slug !== requestedSlug)
                .slice(0, 3),
            );
          }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ slug: requestedSlug, post: null });
        setRelated([]);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const current = result && result.slug === slug ? result : null;
  const post = current?.post ?? null;

  const toc = useMemo(() => (post ? buildToc(post.body) : []), [post]);
  const bodyWithAnchors = useMemo(
    () => (post ? injectAnchors(post.body, toc) : ''),
    [post, toc],
  );
  const sanitizedBody = useMemo(
    () => DOMPurify.sanitize(bodyWithAnchors, { ADD_ATTR: ['id'] }),
    [bodyWithAnchors],
  );

  useDocumentHead({
    title: post?.title,
    description: post?.excerpt,
    canonical: post ? `https://zvuki-lesa.ru/blog/${post.slug}/` : undefined,
    ogImage: post?.coverImage ?? undefined,
    schema: post ? parseSchema(post.schemaJson) : undefined,
  });

  // Прогресс чтения и активный раздел в TOC
  useEffect(() => {
    if (!post || toc.length === 0) {
      setProgress(0);
      setActiveSection(null);
      return;
    }
    const handle = () => {
      const articleEl = document.getElementById('journal-article');
      if (!articleEl) return;
      const rect = articleEl.getBoundingClientRect();
      const total = articleEl.scrollHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      const pct = total > 0 ? scrolled / total : 0;
      setProgress(Math.min(1, Math.max(0, pct)));

      // Активный раздел
      let currentId: string | null = null;
      const headings = toc
        .map((t) => ({ id: t.id, top: document.getElementById(t.id)?.getBoundingClientRect().top ?? Infinity }))
        .filter((h) => h.top !== Infinity);
      for (const h of headings) {
        if (h.top <= 140) currentId = h.id;
      }
      setActiveSection(currentId ?? headings[0]?.id ?? null);
    };
    handle();
    window.addEventListener('scroll', handle, { passive: true });
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle);
      window.removeEventListener('resize', handle);
    };
  }, [post, toc]);

  if (!current) {
    return (
      <div className="min-h-screen bg-alpine-ink text-alpine-paper selectable">
        <div className="max-w-3xl mx-auto px-4 py-24 text-alpine-smoke">
          <div className="kicker text-alpine-ember mb-2">Блог · Звуки Леса</div>
          <div className="text-alpine-vellum font-display italic text-2xl">Загружаем страницу…</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-alpine-ink text-alpine-paper selectable flex items-center justify-center px-4 py-20">
        <div className="max-w-xl text-center">
          <div className="kicker text-alpine-ember mb-4">404 · Не найдено</div>
          <h1 className="font-display italic text-5xl md:text-6xl mb-6 text-glow-warm">Статья не найдена</h1>
          <p className="text-alpine-smoke mb-10 leading-relaxed">
            Возможно, она была удалена, переименована или ещё не опубликована в открытом доступе.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-alpine-ember/90 hover:bg-alpine-ember text-alpine-ink font-medium transition-colors"
          >
            ← Вернуться к журналу
          </Link>
        </div>
      </div>
    );
  }

  const publishedAt = formatDate(post.publishedAt);
  const categoryLabel = CATEGORY_LABEL[post.category] ?? post.category;
  const heroGradient =
    'radial-gradient(ellipse at 20% 0%, rgba(201,123,75,0.16), transparent 55%), radial-gradient(ellipse at 90% 30%, rgba(212,168,87,0.10), transparent 50%), linear-gradient(180deg, #0F0F0E 0%, #171714 70%, #0F0F0E 100%)';

  return (
    <div className="min-h-screen bg-alpine-ink text-alpine-paper selectable">
      {/* Прогресс чтения */}
      <div className="reading-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <article id="journal-article">
        {/* HERO */}
        <header className="relative overflow-hidden grain" style={{ background: heroGradient }}>
          {/* Координатная сетка-намёк (декоративная) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #F2EDE3 1px, transparent 1px), linear-gradient(to bottom, #F2EDE3 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
            {/* Хлебные крошки */}
            <nav className="kicker text-alpine-smoke mb-10 flex items-center gap-2 select-none">
              <Link to="/" className="hover:text-alpine-paper transition-colors">Звуки Леса</Link>
              <span className="text-alpine-line">/</span>
              <Link to="/blog" className="hover:text-alpine-paper transition-colors">Журнал</Link>
              <span className="text-alpine-line">/</span>
              <span className="text-alpine-vellum">{categoryLabel}</span>
            </nav>

            {post.coverImage ? (
              <div className="mb-10 overflow-hidden rounded-sm border border-alpine-edge">
                <SeoImage
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-64 md:h-80 object-cover"
                  loading="eager"
                />
              </div>
            ) : null}

            <div
              className="kicker text-alpine-ember mb-5 inline-flex items-center gap-3"
              style={{ animation: 'fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}
            >
              <span className="inline-block w-8 h-px bg-alpine-ember" />
              {categoryLabel}
            </div>

            <h1
              className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-alpine-paper text-glow-warm"
              style={{ animation: 'rise-in 1s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}
            >
              {post.title}
            </h1>

            <div
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-alpine-smoke border-t border-alpine-edge pt-6"
              style={{ animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both' }}
            >
              <span className="flex items-center gap-2">
                <span className="font-display italic text-alpine-vellum">{post.author}</span>
              </span>
              <span className="hidden sm:inline text-alpine-line">·</span>
              <span className="kicker">
                <span className="text-alpine-ember mr-2">⏱</span>
                {post.readingTimeMin} мин чтения
              </span>
              {publishedAt ? (
                <>
                  <span className="hidden sm:inline text-alpine-line">·</span>
                  <time className="kicker">{publishedAt}</time>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {/* ОСНОВНАЯ КОЛОНКА */}
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-14 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_16rem] gap-10 lg:gap-16">
            {/* ТЕЛО СТАТЬИ */}
            <div className="min-w-0">
              {/* Короткое предисловие/лид (первый параграф выделим через prose first:p) */}
              <div
                className="prose prose-invert journal-prose max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizedBody }}
                style={{ animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}
              />

              {/* Завершающая черта + подпись */}
              <div className="journal-rule my-16" />
              <div className="flex items-center justify-between gap-4 text-alpine-smoke text-sm">
                <span className="font-display italic">Конец статьи · {post.readingTimeMin} мин</span>
                <Link
                  to="/blog"
                  className="kicker text-alpine-ember hover:text-alpine-gold transition-colors flex items-center gap-2"
                >
                  Все материалы журнала →
                </Link>
              </div>
            </div>

            {/* БОКОВАЯ КОЛОНКА — TOC + CTA */}
            <aside className="hidden lg:block">
              <div className="sticky top-10 space-y-10">
                {toc.length > 1 ? (
                  <div>
                    <div className="kicker text-alpine-smoke mb-4 flex items-center gap-2">
                      <span className="text-alpine-ember">◆</span>
                      Содержание
                    </div>
                    <nav className="border-l border-alpine-edge">
                      {toc.map((t) => (
                        <a
                          key={t.id}
                          href={`#${t.id}`}
                          className={`toc-link ${activeSection === t.id ? 'active' : ''}`}
                        >
                          {t.text}
                        </a>
                      ))}
                    </nav>
                  </div>
                ) : null}

                <div className="rounded-sm border border-alpine-edge bg-alpine-card/60 p-6">
                  <div className="kicker text-alpine-ember mb-3">Прямой эфир</div>
                  <p className="font-display italic text-2xl leading-snug text-alpine-vellum mb-4">
                    Подберём маршрут под ваши даты
                  </p>
                  <a
                    href="tel:+79282110249"
                    className="block font-display text-3xl text-alpine-paper hover:text-alpine-gold transition-colors mb-4"
                  >
                    +7 (928) 211-02-49
                  </a>
                  <Link
                    to="/"
                    className="inline-block w-full text-center px-4 py-2.5 rounded-full bg-alpine-ember/90 hover:bg-alpine-ember text-alpine-ink text-sm font-medium transition-colors"
                  >
                    На главную →
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* ПОХОЖИЕ СТАТЬИ */}
        {related.length > 0 ? (
          <section className="border-t border-alpine-edge bg-alpine-night">
            <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
              <div className="flex items-end justify-between gap-6 mb-10">
                <div>
                  <div className="kicker text-alpine-ember mb-3 flex items-center gap-2">
                    <span className="inline-block w-6 h-px bg-alpine-ember" />
                    Из того же раздела
                  </div>
                  <h2 className="font-display italic text-3xl md:text-4xl text-alpine-paper">
                    Похожие материалы
                  </h2>
                </div>
                <Link
                  to="/blog"
                  className="hidden sm:inline-flex kicker text-alpine-smoke hover:text-alpine-paper transition-colors"
                >
                  Весь журнал →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {related.map((r) => (
                  <RelatedCard key={r.slug} post={r} />
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
              Готовы приехать в Адыгею?
            </h2>
            <p className="text-alpine-vellum mb-10 leading-relaxed max-w-xl mx-auto">
              Подберите свободные даты и домик под вашу компанию — менеджер соберёт маршрут под статьёй,
              которую вы только что прочитали.
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
                Позвонить менеджеру
              </a>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}

function RelatedCard({ post }: { post: BlogListItem }) {
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
        <p className="mt-3 text-sm text-alpine-smoke line-clamp-3 leading-relaxed">{post.excerpt}</p>
        <div className="mt-4 kicker text-alpine-ash flex items-center gap-3">
          <span>{post.readingTimeMin} мин чтения</span>
          <span className="text-alpine-line">·</span>
          <span className="text-alpine-ember group-hover:translate-x-0.5 transition-transform">Читать →</span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Атмосферный placeholder для обложки, когда у поста нет изображения.
 * Использует два слоя мягких градиентов и крупную монограмму из инициалов.
 * Различается по slug, чтобы карточки смотрелись разнообразно.
 */
function CoverGradient({ slug }: { slug: string }) {
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
  const initials = slug
    .split('-')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '·')
    .join('');
  return (
    <div
      className="cover-grad w-full h-full flex items-center justify-center"
      style={{
        background: `radial-gradient(ellipse at 30% 20%, ${c}55, transparent 60%), radial-gradient(ellipse at 80% 80%, ${b}66, transparent 50%), linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
      }}
    >
      <div className="font-display italic text-alpine-paper/80 text-7xl tracking-tighter select-none">
        {initials}
      </div>
    </div>
  );
}
