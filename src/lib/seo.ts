import { useEffect } from 'react';

/**
 * Описание данных, которые useDocumentHead проставит в <head> документа.
 * Все поля опциональны — указывайте только те, что меняются на текущей странице.
 */
export interface DocumentHead {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  schema?: object | object[];
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterUrl?: string;
  twitterImage?: string;
}

function setMeta(name: string, value: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function setSchema(schema: object | object[]) {
  const schemas = Array.isArray(schema) ? schema : [schema];
  document.head.querySelectorAll('script[data-seo-schema]').forEach(n => n.remove());
  for (const s of schemas) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seoSchema = 'true';
    script.text = JSON.stringify(s);
    document.head.appendChild(script);
  }
}

/**
 * Хук для SEO: обновляет <title>, meta description, og:image, canonical
 * и вставляет JSON-LD schema.org в <head>.
 *
 * При размонтировании компонента ранее вставленные schema-скрипты удаляются,
 * чтобы не «утекали» между страницами. Остальные meta-теги обновляются
 * на месте — это поведение совпадает с большинством SPA-роутеров.
 */
export function useDocumentHead(head: DocumentHead) {
  const schemaKey = head.schema ? JSON.stringify(head.schema) : undefined;
  useEffect(() => {
    if (head.title) document.title = head.title;
    if (head.description) setMeta('description', head.description);
    if (head.ogImage) setMeta('og:image', head.ogImage, 'property');
    if (head.canonical) setCanonical(head.canonical);
    if (head.schema) setSchema(head.schema);

    const robots = head.robots ?? 'index, follow, max-snippet:-1, max-image-preview:large';
    const ogTitle = head.ogTitle ?? head.title;
    const ogDescription = head.ogDescription ?? head.description;
    const ogUrl = head.ogUrl ?? head.canonical;
    const twitterTitle = head.twitterTitle ?? ogTitle;
    const twitterDescription = head.twitterDescription ?? ogDescription;
    const twitterUrl = head.twitterUrl ?? ogUrl;
    const twitterImage = head.twitterImage ?? head.ogImage;

    setMeta('robots', robots);
    if (ogTitle) setMeta('og:title', ogTitle, 'property');
    if (ogDescription) setMeta('og:description', ogDescription, 'property');
    if (ogUrl) setMeta('og:url', ogUrl, 'property');
    if (twitterTitle) setMeta('twitter:title', twitterTitle);
    if (twitterDescription) setMeta('twitter:description', twitterDescription);
    if (twitterUrl) setMeta('twitter:url', twitterUrl);
    if (twitterImage) {
      setMeta('twitter:card', 'summary_large_image');
      setMeta('twitter:image', twitterImage);
    }

    return () => {
      document.head.querySelectorAll('script[data-seo-schema]').forEach(n => n.remove());
    };
  }, [
    head.title,
    head.description,
    head.canonical,
    head.ogImage,
    head.robots,
    head.ogTitle,
    head.ogDescription,
    head.ogUrl,
    head.twitterTitle,
    head.twitterDescription,
    head.twitterUrl,
    head.twitterImage,
    schemaKey,
  ]);
}

/**
 * Карта транслитерации русского → латиница (простая, без диакритики).
 * Используется в slugify для генерации URL-фрагментов из русских заголовков.
 */
const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Превращает произвольную строку в URL-slug:
 * - нижний регистр + трим
 * - кириллица → латиница через translitMap
 * - всё, что не [a-z0-9\s-], выкидывается
 * - пробелы → дефисы, множественные дефисы схлопываются, ведущие/хвостовые отрезаются
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .split('')
    .map((c) => translitMap[c] ?? c)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Считает «слова» в HTML: сначала выкидывает все теги, потом разбивает по \S+.
 * Подходит для оценки объёма текста из Tiptap (HTML) или plain-строки.
 */
export function countWords(html: string): number {
  return (html.replace(/<[^>]+>/g, ' ').match(/\S+/g) ?? []).length;
}

/**
 * Примерное время чтения в минутах (200 слов/мин, минимум 1).
 * При пустом вводе возвращает 1, чтобы UI не показывал «0 мин».
 */
export function readingTimeMin(html: string): number {
  return Math.max(1, Math.round(countWords(html) / 200));
}