import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { slugify, countWords, readingTimeMin, useDocumentHead } from './seo';

describe('seo utils', () => {
  describe('slugify', () => {
    it('transliterates Russian', () => {
      expect(slugify('Даховская Адыгея')).toBe('dahovskaya-adygeya');
      expect(slugify('Отдых в горах!')).toBe('otdyh-v-gorah');
    });

    it('collapses multiple spaces and trims', () => {
      expect(slugify('  Много   пробелов  ')).toBe('mnogo-probelov');
    });

    it('strips special characters', () => {
      // С-п-е-ц → spec (е транслитерируется в 'e'), символы !@#$% выкидываются
      expect(slugify('Спец!@#$%символы')).toBe('specsimvoly');
    });

    it('handles edge characters (е, ё, й, ъ, ы, ь)', () => {
      // ё → e, й → i, ъ и ь выкидываются, ы → y, ю → yu, я → ya
      expect(slugify('Ёжик')).toBe('ezhik');
      expect(slugify('Йогурт')).toBe('iogurt');
      expect(slugify('Подъезд')).toBe('podezd');
      expect(slugify('Сыр')).toBe('syr');
      expect(slugify('Юла')).toBe('yula');
      expect(slugify('Яблоко')).toBe('yabloko');
      // комбинация: «ъ» и «ь» в середине должны исчезнуть без лишних дефисов
      expect(slugify('Объявление')).toBe('obyavlenie');
      expect(slugify('Большой')).toBe('bolshoi');
    });

    it('handles already-Latin input', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('  Mixed 123  ')).toBe('mixed-123');
    });

    it('strips leading/trailing dashes and returns empty for non-letters', () => {
      expect(slugify('!!!')).toBe('');
      expect(slugify('---abc---')).toBe('abc');
    });
  });

  describe('countWords', () => {
    it('counts plain text', () => {
      expect(countWords('Привет мир')).toBe(2);
    });

    it('ignores HTML tags', () => {
      expect(countWords('<p>Привет мир</p>')).toBe(2);
      expect(countWords('<h2>Заголовок</h2><p>Текст текст текст</p>')).toBe(4);
    });

    it('handles nested tags and whitespace inside HTML', () => {
      expect(countWords('<div><p> один  два </p><span>три</span></div>')).toBe(3);
    });

    it('returns 0 for empty or tags-only input', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('<p></p>')).toBe(0);
    });
  });

  describe('readingTimeMin', () => {
    it('divides by 200 words per minute and rounds', () => {
      // 800 слов через пробелы → 4 мин
      expect(readingTimeMin('word '.repeat(800).trim())).toBe(4);
      expect(readingTimeMin('word '.repeat(1000).trim())).toBe(5);
    });

    it('returns minimum 1 for empty or very short input', () => {
      expect(readingTimeMin('')).toBe(1);
      expect(readingTimeMin('одно слово')).toBe(1);
    });

    it('uses word count from HTML', () => {
      // 400 слов → 2 мин
      const html = `<p>${'слово '.repeat(400).trim()}</p>`;
      expect(readingTimeMin(html)).toBe(2);
    });
  });

  describe('useDocumentHead', () => {
    afterEach(() => {
      document.head.innerHTML = '';
      document.title = '';
    });

    it('sets canonical, robots and social fallbacks', () => {
      const { unmount } = renderHook(() => useDocumentHead({
        title: 'Шале Уют',
        description: 'Домик в Даховской',
        canonical: 'https://zvuki-lesa.ru/booking/shale-uyut/',
        ogImage: 'https://zvuki-lesa.ru/cabin.jpg',
      }));

      expect(document.title).toBe('Шале Уют');
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href', 'https://zvuki-lesa.ru/booking/shale-uyut/',
      );
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content', 'index, follow, max-snippet:-1, max-image-preview:large',
      );
      expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'Шале Уют');
      expect(document.querySelector('meta[property="og:description"]')).toHaveAttribute('content', 'Домик в Даховской');
      expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute('content', 'https://zvuki-lesa.ru/booking/shale-uyut/');
      expect(document.querySelector('meta[name="twitter:image"]')).toHaveAttribute('content', 'https://zvuki-lesa.ru/cabin.jpg');
      expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
      unmount();
    });

    it('supports explicit social values and noindex', () => {
      renderHook(() => useDocumentHead({
        title: 'Не найдено',
        robots: 'noindex, nofollow',
        ogTitle: 'OG title',
        ogDescription: 'OG description',
        ogUrl: 'https://zvuki-lesa.ru/missing',
        twitterTitle: 'Twitter title',
        twitterDescription: 'Twitter description',
        twitterUrl: 'https://zvuki-lesa.ru/missing',
        twitterImage: 'https://zvuki-lesa.ru/twitter.jpg',
      }));
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
      expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'OG title');
      expect(document.querySelector('meta[name="twitter:title"]')).toHaveAttribute('content', 'Twitter title');
    });

    it('removes managed schema on unmount', () => {
      const unmanaged = document.createElement('script');
      unmanaged.type = 'application/ld+json';
      document.head.appendChild(unmanaged);
      const { unmount } = renderHook(() => useDocumentHead({ schema: { '@type': 'Thing' } }));
      expect(document.querySelectorAll('script[data-seo-schema]')).toHaveLength(1);
      unmount();
      expect(document.querySelectorAll('script[data-seo-schema]')).toHaveLength(0);
      expect(document.head).toContainElement(unmanaged);
    });
  });
});
