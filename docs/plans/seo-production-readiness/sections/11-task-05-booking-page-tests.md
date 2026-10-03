### Task 5A: Зафиксировать SEO страницы домика тестами

**Files:**
- Create: `src/pages/booking/BookingPage.test.tsx`
- Modify later: `src/pages/booking/BookingPage.tsx`

- [ ] **Step 1: Создать isolated tests успешной загрузки и 404**

Создать `src/pages/booking/BookingPage.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Cottage } from '@/lib/api';
import { getCottage } from '@/lib/api';
import { BookingPage } from './BookingPage';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, getCottage: vi.fn() };
});
vi.mock('./TopBar', () => ({ TopBar: () => <div /> }));
vi.mock('./BookingHero', () => ({ BookingHero: () => <div /> }));
vi.mock('./BookingInfo', () => ({ BookingInfo: () => <div /> }));
vi.mock('./BookingAmenities', () => ({ BookingAmenities: () => <div /> }));
vi.mock('./BookingRecreation', () => ({ BookingRecreation: () => <div /> }));
vi.mock('./BookingAbout', () => ({ BookingAbout: () => <div /> }));
vi.mock('./BookingMap', () => ({ BookingMap: () => <div /> }));
vi.mock('./NearbyAttractions', () => ({ NearbyAttractions: () => <div /> }));

const mockGetCottage = vi.mocked(getCottage);
const cottage: Cottage = {
  id: 7,
  slug: 'shale-uyut',
  mapId: 'Домик1',
  name: 'Шале Уют',
  shortDescription: 'Уютный домик у леса',
  longDescription: 'Семейный отдых в станице Даховская',
  description: '',
  houseRules: '',
  basePrice: 6500,
  area: 42,
  guests: 4,
  bedrooms: 1,
  beds: { double: 1, single: 2 },
  checkInTime: '14:00',
  checkOutTime: '12:00',
  mainImage: '/cabin-1-enhanced.jpg',
  amenities: ['Wi-Fi'],
  gallery: [],
  images: [],
  recreation: [],
};

function renderPage(slug = 'shale-uyut') {
  return render(
    <MemoryRouter initialEntries={[`/booking/${slug}`]}>
      <Routes><Route path="/booking/:cabinId" element={<BookingPage />} /></Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  mockGetCottage.mockReset();
  document.head.innerHTML = '';
  document.title = '';
});

describe('BookingPage SEO', () => {
  it('sets unique metadata and linked cottage JSON-LD', async () => {
    mockGetCottage.mockResolvedValue({ success: true, data: { cottage } });
    renderPage();

    await waitFor(() => expect(document.title).toContain('Шале Уют'));
    expect(document.title).toContain('Даховская');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://zvuki-lesa.ru/booking/shale-uyut',
    );
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content', 'https://zvuki-lesa.ru/cabin-1-enhanced.jpg',
    );
    const schema = JSON.parse(
      document.querySelector('script[data-seo-schema]')?.textContent ?? '{}',
    );
    expect(schema['@graph'].map((node: { '@type': string }) => node['@type']))
      .toEqual(expect.arrayContaining([
        'LodgingBusiness', 'Accommodation', 'Offer', 'BreadcrumbList',
      ]));
  });

  it('marks a missing cottage noindex and publishes no schema', async () => {
    mockGetCottage.mockResolvedValue({ success: false, error: 'Not found' });
    renderPage('missing');

    await screen.findByRole('heading', { name: 'Домик не найден' });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content', 'noindex, nofollow',
    );
    expect(document.querySelector('script[data-seo-schema]')).not.toBeInTheDocument();
  });
});
```

Реальные Yandex Map и календарные компоненты здесь намеренно замоканы: тест проверяет только контракт SEO маршрута.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/pages/booking/BookingPage.test.tsx`

Expected: FAIL — `BookingPage` пока не устанавливает route-specific metadata и JSON-LD.

---
