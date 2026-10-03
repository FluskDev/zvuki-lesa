interface Props {
  title: string;
  description: string;
  slug: string;
  /** Домен для превью; по умолчанию zvuki-lesa.ru. */
  baseUrl?: string;
}

/**
 * Визуальное превью сниппета поисковой выдачи (Google).
 * Помогает админу оценить, как страница будет выглядеть в поиске до публикации.
 */
export function MetaPreview({ title, description, slug, baseUrl = 'https://zvuki-lesa.ru' }: Props) {
  const url = slug ? `${baseUrl}/${slug}` : baseUrl;
  const displayTitle = title?.trim() || 'Заголовок страницы';
  const displayDescription = description?.trim() || 'Описание страницы появится здесь…';

  return (
    <div className="rounded-md border border-neutral-800 bg-white dark:bg-neutral-900 p-3 max-w-2xl text-left">
      <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-1 truncate">{url}</div>
      <div className="text-[#1a0dab] dark:text-blue-400 text-lg leading-snug hover:underline cursor-pointer truncate">
        {displayTitle}
      </div>
      <div className="text-neutral-700 dark:text-neutral-300 text-sm leading-snug line-clamp-2">
        {displayDescription}
      </div>
    </div>
  );
}
