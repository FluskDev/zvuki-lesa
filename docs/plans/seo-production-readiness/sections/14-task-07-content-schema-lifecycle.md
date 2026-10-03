### Task 7: Исправить жизненный цикл Schema SEO-страниц и статей

**Files:**
- Create: `src/pages/contentSchema.test.tsx`
- Modify: `src/pages/seo/SeoPage.tsx`
- Modify: `src/pages/blog/BlogPost.tsx`

- [ ] **Step 1: Написать regression tests для существующих content routes**

Создать `src/pages/contentSchema.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SeoPage from './seo/SeoPage';
import BlogPost from './blog/BlogPost';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  blog: vi.fn(),
  blogPost: vi.fn(),
}));

vi.mock('@/lib/seoApi', () => ({ seoApi: mocks }));
vi.mock('@/hooks/useCottages', () => ({
  useCottages: () => ({ data: [], loading: false, error: null }),
}));
vi.mock('@/components/SeoImage', () => ({ SeoImage: () => <div /> }));

afterEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  document.head.innerHTML = '';
  document.title = '';
});

it('keeps SEO page JSON-LD after async content loads', async () => {
  mocks.get.mockResolvedValue({
    success: true,
    data: {
      page: {
        id: 1,
        slug: 'dahovskaya',
        title: 'Отдых в Даховской',
        description: 'Гид по Даховской',
        h1: 'Даховская',
        body: '<p>Текст страницы</p>',
        metaImage: null,
        intent: 'даховская',
        priority: 0.9,
        schemaJson: JSON.stringify({ '@context': 'https://schema.org', '@type': 'TouristAttraction' }),
      },
    },
  });
  mocks.list.mockResolvedValue({ success: true, data: { pages: [] } });

  render(
    <MemoryRouter initialEntries={['/seo/dahovskaya']}>
      <Routes><Route path="/seo/:slug" element={<SeoPage />} /></Routes>
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Даховская' });
  expect(document.querySelector('script[data-seo-schema]')?.textContent)
    .toContain('TouristAttraction');
});

it('keeps Article JSON-LD after async blog post loads', async () => {
  mocks.blogPost.mockResolvedValue({
    success: true,
    data: {
      post: {
        id: 2,
        slug: 'rufabgo',
        title: 'Маршрут на Руфабго',
        excerpt: 'Практический маршрут',
        body: '<p>Текст статьи</p>',
        coverImage: null,
        category: 'маршруты',
        readingTimeMin: 5,
        publishedAt: '2026-07-01T00:00:00.000Z',
        author: 'Команда Звуки Леса',
        schemaJson: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article' }),
      },
    },
  });
  mocks.blog.mockResolvedValue({ success: true, data: { data: { items: [], total: 0 } } });

  render(
    <MemoryRouter initialEntries={['/blog/rufabgo']}>
      <Routes><Route path="/blog/:slug" element={<BlogPost />} /></Routes>
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Маршрут на Руфабго' });
  expect(document.querySelector('script[data-seo-schema]')?.textContent).toContain('Article');
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npx vitest run src/pages/contentSchema.test.tsx`

Expected: оба теста FAIL, потому что отдельные effects удаляют `script[data-seo-schema]` сразу после `useDocumentHead`.

- [ ] **Step 3: Удалить конфликтующие effects**

Из `src/pages/seo/SeoPage.tsx` удалить effect, который вручную выставляет `document.title` и удаляет `[data-seo-schema]` (текущие строки 80–87). Из `src/pages/blog/BlogPost.tsx` удалить аналогичный effect (текущие строки 159–166). Импорт `useEffect` оставить: оба компонента используют его для загрузки и UI-поведения.

Владельцем title, metadata и Schema остаётся только `useDocumentHead`.

- [ ] **Step 4: Подтвердить GREEN**

Run: `npx vitest run src/pages/contentSchema.test.tsx`

Expected: 2 tests PASS, `TouristAttraction` и `Article` остаются в document head после загрузки.

---
