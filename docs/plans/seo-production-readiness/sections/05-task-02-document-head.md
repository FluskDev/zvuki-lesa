### Task 2: Расширить `useDocumentHead` для route-specific metadata

**Files:**
- Modify: `src/lib/seo.ts`
- Modify: `src/lib/seo.test.ts`

- [ ] **Step 1: Добавить failing-тесты хука**

В `src/lib/seo.test.ts` добавить импорты `afterEach` из `vitest` и `renderHook` из `@testing-library/react`, затем тесты:

```ts
describe('useDocumentHead', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('sets canonical, robots and social fallbacks', () => {
    const { unmount } = renderHook(() => useDocumentHead({
      title: 'Шале Уют',
      description: 'Домик в Даховской',
      canonical: 'https://zvuki-lesa.ru/booking/shale-uyut',
      ogImage: 'https://zvuki-lesa.ru/cabin.jpg',
    }));

    expect(document.title).toBe('Шале Уют');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://zvuki-lesa.ru/booking/shale-uyut',
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content', 'index, follow, max-snippet:-1, max-image-preview:large',
    );
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'Шале Уют');
    expect(document.querySelector('meta[property="og:description"]')).toHaveAttribute('content', 'Домик в Даховской');
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute('content', 'https://zvuki-lesa.ru/booking/shale-uyut');
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
```

Импортировать `useDocumentHead` вместе с существующими функциями из `./seo`.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/lib/seo.test.ts`

Expected: FAIL — social/robots поля отсутствуют в `DocumentHead` и DOM.

- [ ] **Step 3: Реализовать минимальное расширение**

В `DocumentHead` добавить:

```ts
robots?: string;
ogTitle?: string;
ogDescription?: string;
ogUrl?: string;
twitterTitle?: string;
twitterDescription?: string;
twitterUrl?: string;
twitterImage?: string;
```

В effect вычислить fallback-значения и установить metadata:

```ts
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
if (head.ogImage) setMeta('og:image', head.ogImage, 'property');
if (twitterTitle) setMeta('twitter:title', twitterTitle);
if (twitterDescription) setMeta('twitter:description', twitterDescription);
if (twitterUrl) setMeta('twitter:url', twitterUrl);
if (twitterImage) {
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:image', twitterImage);
}
```

Заменить dependency array effect на точный список:

```ts
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
```

- [ ] **Step 4: Подтвердить GREEN**

Run: `npx vitest run src/lib/seo.test.ts`

Expected: все старые pure-function тесты и новые тесты `useDocumentHead` PASS.

---
