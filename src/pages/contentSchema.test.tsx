import { afterEach, expect, it, vi } from 'vitest';
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