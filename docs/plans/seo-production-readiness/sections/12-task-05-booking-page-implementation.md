### Task 5B: Реализовать metadata и Schema страницы домика

**Files:**
- Modify: `src/pages/booking/BookingPage.tsx`
- Test: `src/pages/booking/BookingPage.test.tsx`

- [ ] **Step 1: Подключить SEO-зависимости**

В `src/pages/booking/BookingPage.tsx` добавить:

```ts
import { useDocumentHead, type DocumentHead } from '@/lib/seo';
import {
  absoluteSiteUrl,
  buildCottageStructuredData,
} from '@/lib/structuredData';
```

- [ ] **Step 2: Вычислять head до всех ранних return**

Сразу после effect загрузки и до `if (loading)` добавить:

```ts
  const requestedCanonical = `https://zvuki-lesa.ru/booking/${cabinId ?? ''}`;
  let head: DocumentHead;

  if (cottage) {
    const canonical = `https://zvuki-lesa.ru/booking/${cottage.slug}`;
    const description = [
      cottage.shortDescription,
      `${cottage.area} м², до ${cottage.guests} гостей`,
      `от ${cottage.basePrice.toLocaleString('ru-RU')} ₽ за ночь`,
    ].join('. ');

    head = {
      title: `${cottage.name} — аренда домика в Даховской | Звуки Леса`,
      description,
      canonical,
      ogImage: absoluteSiteUrl(cottage.mainImage || '/og-image.jpg'),
      robots: 'index, follow, max-snippet:-1, max-image-preview:large',
      schema: buildCottageStructuredData(cottage),
    };
  } else if (notFound) {
    head = {
      title: 'Домик не найден | Звуки Леса',
      description: 'Запрошенный домик не найден.',
      canonical: requestedCanonical,
      robots: 'noindex, nofollow',
    };
  } else {
    head = {
      title: 'Загрузка домика | Звуки Леса',
      canonical: requestedCanonical,
      robots: 'noindex, follow',
    };
  }

  useDocumentHead(head);
```

Хук вызывается ровно один раз на каждый render независимо от `loading/notFound`, поэтому Rules of Hooks не нарушаются. Social metadata автоматически берутся из title/description/canonical/ogImage через Task 2.

- [ ] **Step 3: Запустить focused tests**

Run:

```bash
npx vitest run src/pages/booking/BookingPage.test.tsx
```

Expected: 2 tests PASS; successful cottage получает `LodgingBusiness`, `Accommodation`, `Offer`, `BreadcrumbList`; 404 получает `noindex, nofollow` без Schema.

- [ ] **Step 4: Запустить связанные SEO-тесты вместе**

Run:

```bash
npx vitest run src/lib/seo.test.ts src/lib/structuredData.test.ts src/pages/HomePage.test.tsx src/pages/booking/BookingPage.test.tsx
```

Expected: все четыре файла PASS, DOM cleanup между тестами не оставляет старых `data-seo-schema` scripts.

---
