import { Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail } from 'lucide-react';
import { useDocumentHead } from '@/lib/seo';
import { Button } from '@/components/ui/button';

/**
 * 404 — отдаётся на любой URL, который не сматчился ни с одним роутом
 * (React Router catch-all `*`) и реально не существующий на сервере
 * (Apache ErrorDocument 404 → /404/index.html).
 *
 * Страница noindex/nofollow — её не должно быть в индексе. canonical
 * ведёт на главную, чтобы Яндекс понимал, к чему относится этот noindex.
 *
 * Намеренно без snap-scroll лендинга и StickyFooter: посетитель
 * пришёл по битой ссылке, его задача — вернуться в рабочую часть
 * сайта, а не прокручивать 8 секций маркетинга.
 */
export function NotFoundPage() {
  useDocumentHead({
    title: 'Страница не найдена | Звуки Леса',
    description:
      'Запрашиваемая страница не найдена. Вернитесь на главную или посмотрите наши домики и гиды по Адыгее.',
    canonical: 'https://zvuki-lesa.ru/',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold text-lg">
            <span className="text-2xl">🏡</span>
            <span>Звуки Леса</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p
              aria-hidden="true"
              className="text-7xl md:text-9xl font-bold tracking-tight text-muted-foreground/40 select-none"
            >
              404
            </p>

            <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">
              Страница не найдена
            </h1>

            <p className="mt-4 text-lg text-muted-foreground">
              Возможно, она переехала или была удалена.
              <br className="hidden md:inline" />
              Вернитесь на главную или посмотрите популярные разделы ниже.
            </p>

            <div className="mt-8">
              <Button asChild size="lg">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  На главную
                </Link>
              </Button>
            </div>

            <nav aria-label="Популярные разделы" className="mt-12">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Популярные разделы
              </h2>
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
                <li>
                  <Link to="/#cabins" className="text-foreground hover:text-primary underline-offset-4 hover:underline">
                    Домики
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="text-foreground hover:text-primary underline-offset-4 hover:underline">
                    Блог
                  </Link>
                </li>
                <li>
                  <Link to="/seo/zhivotnye-adygeya-fauna/" className="text-foreground hover:text-primary underline-offset-4 hover:underline">
                    Животные Адыгеи
                  </Link>
                </li>
                <li>
                  <Link to="/seo/lagonaki-otdih/" className="text-foreground hover:text-primary underline-offset-4 hover:underline">
                    Лагонаки
                  </Link>
                </li>
                <li>
                  <Link to="/seo/termalnye-istochniki-adygeya/" className="text-foreground hover:text-primary underline-offset-4 hover:underline">
                    Термальные источники
                  </Link>
                </li>
                <li>
                  <Link to="/search" className="text-foreground hover:text-primary underline-offset-4 hover:underline">
                    Поиск свободных дат
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <a href="tel:+79282110249" className="inline-flex items-center gap-2 hover:text-foreground">
            <Phone className="h-4 w-4" aria-hidden="true" />
            +7 (928) 211-02-49
          </a>
          <a href="mailto:booking@zvuki-lesa.ru" className="inline-flex items-center gap-2 hover:text-foreground">
            <Mail className="h-4 w-4" aria-hidden="true" />
            booking@zvuki-lesa.ru
          </a>
        </div>
      </footer>
    </div>
  );
}
