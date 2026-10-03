### Task 4A: Зафиксировать интеграцию главной страницы тестом

**Files:**
- Create: `src/pages/HomePage.test.tsx`
- Create later: `src/pages/HomePage.tsx`
- Modify later: `src/sections/Reviews.tsx`
- Modify later: `src/App.tsx`
- Modify later: `index.html`

- [ ] **Step 1: Написать isolated route test**

Создать `src/pages/HomePage.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import type { ReviewsResponse } from '@/lib/api';
import { HomePage } from './HomePage';

const mocks = vi.hoisted(() => ({
  useReviews: vi.fn(),
  reviewsSection: vi.fn(),
}));

vi.mock('@/hooks/useReviews', () => ({ useReviews: mocks.useReviews }));
vi.mock('@/sections/Navigation', () => ({ Navigation: () => <div /> }));
vi.mock('@/sections/Hero', () => ({ Hero: () => <div /> }));
vi.mock('@/sections/Cabins', () => ({ Cabins: () => <div /> }));
vi.mock('@/sections/Services', () => ({ Services: () => <div /> }));
vi.mock('@/sections/About', () => ({ About: () => <div /> }));
vi.mock('@/sections/Amenities', () => ({ Amenities: () => <div /> }));
vi.mock('@/sections/ContactUsLanding', () => ({ ContactUsLanding: () => <div /> }));
vi.mock('@/sections/Reviews', () => ({
  Reviews: (props: unknown) => {
    mocks.reviewsSection(props);
    return <div data-testid="reviews" />;
  },
}));
vi.mock('@/components/SnapScroll/SnapScroll', () => ({
  SnapScroll: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/SectionNav/SectionNav', () => ({ SectionNav: () => <div /> }));
vi.mock('@/components/StickyFooter/StickyFooter', () => ({ StickyFooter: () => <div /> }));

const reviews: ReviewsResponse = {
  averageRating: 4.9,
  total: 1,
  yandexReviewsUrl: null,
  items: [{
    id: 1,
    authorName: 'Анна',
    rating: 5,
    text: 'Прекрасный отдых',
    date: '2026-07-01',
    source: 'yandex',
    isPublished: true,
    avatarUrl: null,
    authorUrl: null,
  }],
};

afterEach(() => {
  document.head.innerHTML = '';
  mocks.useReviews.mockReset();
  mocks.reviewsSection.mockReset();
});

describe('HomePage SEO', () => {
  it('loads reviews once and shares them with UI and one LodgingBusiness schema', () => {
    mocks.useReviews.mockReturnValue({ data: reviews, loading: false, error: null });
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(mocks.useReviews).toHaveBeenCalledTimes(1);
    expect(mocks.reviewsSection).toHaveBeenCalledWith(
      expect.objectContaining({ data: reviews, loading: false }),
    );
    const scripts = [...document.querySelectorAll('script[data-seo-schema]')];
    const schemas = scripts.map((script) => JSON.parse(script.textContent ?? '{}'));
    const businesses = schemas.flatMap((schema) => schema['@graph'] ?? [])
      .filter((node) => node['@type'] === 'LodgingBusiness');
    expect(businesses).toHaveLength(1);
    expect(businesses[0].aggregateRating.reviewCount).toBe(1);
    expect(document.title).toContain('Звуки Леса');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://zvuki-lesa.ru/',
    );
  });

  it('keeps route-specific JSON-LD out of the SPA shell', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).not.toContain('type="application/ld+json"');
  });
});
```

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/pages/HomePage.test.tsx`

Expected: FAIL с `Cannot find module './HomePage'`.

---
