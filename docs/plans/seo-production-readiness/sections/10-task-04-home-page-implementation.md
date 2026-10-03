### Task 4B: Реализовать владельца SEO главного маршрута

**Files:**
- Create: `src/pages/HomePage.tsx`
- Modify: `src/sections/Reviews.tsx`
- Modify: `src/App.tsx`
- Modify: `index.html`
- Test: `src/pages/HomePage.test.tsx`

- [ ] **Step 1: Создать `HomePage` и загрузить отзывы один раз**

Создать `src/pages/HomePage.tsx`:

```tsx
import { Navigation } from '@/sections/Navigation';
import { Hero } from '@/sections/Hero';
import { Cabins } from '@/sections/Cabins';
import { Services } from '@/sections/Services';
import { About } from '@/sections/About';
import { Amenities } from '@/sections/Amenities';
import { Reviews } from '@/sections/Reviews';
import { ContactUsLanding } from '@/sections/ContactUsLanding';
import { SnapScroll } from '@/components/SnapScroll/SnapScroll';
import { SectionNav } from '@/components/SectionNav/SectionNav';
import { StickyFooter } from '@/components/StickyFooter/StickyFooter';
import { useReviews } from '@/hooks/useReviews';
import { useDocumentHead } from '@/lib/seo';
import { buildHomeStructuredData } from '@/lib/structuredData';

const title = 'Звуки Леса — Аренда домиков в станице Даховская | Адыгея';
const description = 'Уютные домики в станице Даховская: горный отдых, рафтинг, джиппинг и банный чан. Бронирование гостевого дома «Звуки Леса».';
const canonical = 'https://zvuki-lesa.ru/';
const ogImage = 'https://zvuki-lesa.ru/og-image.jpg';

export function HomePage() {
  const { data, loading } = useReviews();

  useDocumentHead({
    title,
    description,
    canonical,
    ogImage,
    robots: 'index, follow, max-snippet:-1, max-image-preview:large',
    schema: buildHomeStructuredData(data),
  });

  return (
    <>
      <div className="snap-scroll-wrapper">
        <SnapScroll>
          <Navigation />
          <main>
            <Hero />
            <Cabins />
            <Services />
            <About />
            <Amenities />
            <Reviews data={data} loading={loading} />
            <ContactUsLanding />
          </main>
        </SnapScroll>
      </div>
      <SectionNav />
      <StickyFooter />
    </>
  );
}
```

- [ ] **Step 2: Сделать `Reviews` презентационной секцией**

В `src/sections/Reviews.tsx` удалить импорты `useReviews` и `useDocumentHead`, а также блок построения Schema строк 22–55. Добавить:

```ts
import type { ReviewsResponse } from '@/lib/api';

interface ReviewsProps {
  data: ReviewsResponse | null;
  loading: boolean;
}

export function Reviews({ data, loading }: ReviewsProps) {
```

Существующие вычисления `reviews`, `totalPages`, пагинация и JSX оставить без изменений.

- [ ] **Step 3: Подключить `HomePage` в маршрутизатор**

В `src/App.tsx` удалить импорты секций главной, `SnapScroll`, `SectionNav` и `StickyFooter`; добавить:

```ts
import { HomePage } from '@/pages/HomePage';
```

Заменить весь inline `<Route path="/" ... />` на:

```tsx
<Route path="/" element={<HomePage />} />
```

Остальные маршруты не менять.

- [ ] **Step 4: Удалить route-specific Schema из SPA shell**

Из `index.html` удалить целиком четыре блока от комментария `<!-- Structured Data: Organization -->` до закрывающего `</script>` блока `ImageObject` включительно. Не удалять title, description, canonical, Open Graph, Twitter, geo tags, шрифты и Yandex Maps script.

После изменения в `index.html` не должно остаться ни одного `script[type="application/ld+json"]`.

- [ ] **Step 5: Запустить focused test и TypeScript**

Run:

```bash
npx vitest run src/pages/HomePage.test.tsx && npx tsc -b --pretty false
```

Expected: 2 tests PASS; TypeScript PASS; `Reviews` больше не выполняет второй запрос и не создаёт отдельную Schema.

---
