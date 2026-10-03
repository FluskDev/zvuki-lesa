import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface Props {
  title: string;
  /** Куда ведёт "Назад". По умолчанию — главная админки. */
  backTo?: string;
  /** Текст ссылки "Назад". */
  backLabel?: string;
  /** Справа — слот для action-кнопок. */
  right?: React.ReactNode;
}

/**
 * Лёгкий хедер для подстраниц админки: кнопка "Назад" слева, заголовок по центру, опциональные действия справа.
 * Используется на /admin/seo-pages, /admin/blog-posts, /admin/images, /admin/reviews и их редакторах.
 */
export default function AdminSubpageHeader({ title, backTo = '/admin', backLabel = 'Назад в админку', right }: Props) {
  return (
    <header className="dark bg-[#141414] text-white border-b border-neutral-800 px-4 py-3 flex items-center gap-3">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1 text-sm text-neutral-300 hover:text-white transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <h2 className="text-base font-semibold flex-1 truncate">{title}</h2>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}