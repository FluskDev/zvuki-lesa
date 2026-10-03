import { describe, expect, it } from 'vitest';
import type { Cottage, ReviewsResponse } from './api';
import { buildCottageStructuredData, buildHomeStructuredData } from './structuredData';

const reviews: ReviewsResponse = {
  averageRating: 4.8,
  total: 1,
  yandexReviewsUrl: 'https://yandex.ru/maps/example',
  items: [{
    id: 1,
    authorName: 'Анна',
    rating: 5,
    text: 'Очень уютно',
    date: '2026-07-01',
    source: 'yandex',
    isPublished: true,
    avatarUrl: null,
    authorUrl: null,
  }],
};

const cottage: Cottage = {
  id: 7,
  slug: 'shale-uyut',
  mapId: 'Домик1',
  name: 'Шале Уют',
  shortDescription: 'Уютный домик у леса',
  longDescription: 'Домик для семейного отдыха в Даховской',
  description: '',
  houseRules: '',
  basePrice: 6500,
  area: 42,
  guests: 4,
  bedrooms: 1,
  beds: { double: 1, single: 2 },
  checkInTime: '14:00',
  checkOutTime: '12:00',
  mainImage: '/Домик 1/Главная.jpg',
  amenities: ['Wi-Fi', 'Парковка'],
  gallery: ['/Домик 1/Главная.jpg', '/Домик 1/Кухня.jpg'],
  images: [],
  recreation: [],
};

describe('buildHomeStructuredData', () => {
  it('publishes one complete LodgingBusiness with real reviews', () => {
    const schema = buildHomeStructuredData(reviews);
    const businesses = schema['@graph'].filter((node) => node['@type'] === 'LodgingBusiness');
    expect(businesses).toHaveLength(1);
    expect(businesses[0]).toMatchObject({
      name: 'Звуки Леса',
      aggregateRating: { ratingValue: 4.8, reviewCount: 1 },
      review: [{ author: { name: 'Анна' }, reviewBody: 'Очень уютно' }],
    });
    expect(schema['@graph'].map((node) => node['@type'])).toEqual(
      expect.arrayContaining(['BreadcrumbList', 'FAQPage', 'ImageObject']),
    );
  });

  it('omits fictitious ratings when reviews are unavailable', () => {
    const schema = buildHomeStructuredData(null);
    const business = schema['@graph'].find((node) => node['@type'] === 'LodgingBusiness');
    expect(business).not.toHaveProperty('aggregateRating');
    expect(business).not.toHaveProperty('review');
    expect(JSON.stringify(schema)).not.toContain('"reviewCount":50');
  });
});

describe('buildCottageStructuredData', () => {
  it('links LodgingBusiness, Accommodation, Offer and breadcrumbs', () => {
    const schema = buildCottageStructuredData(cottage);
    const types = schema['@graph'].map((node) => node['@type']);
    expect(types).toEqual(expect.arrayContaining([
      'LodgingBusiness', 'Accommodation', 'Offer', 'BreadcrumbList',
    ]));
    const accommodation = schema['@graph'].find((node) => node['@type'] === 'Accommodation');
    expect(accommodation).toMatchObject({
      name: 'Шале Уют',
      url: 'https://zvuki-lesa.ru/booking/shale-uyut/',
      occupancy: { maxValue: 4 },
      floorSize: { value: 42, unitCode: 'MTK' },
    });
    expect(accommodation?.image?.[0]).toContain('%D0%94%D0%BE%D0%BC%D0%B8%D0%BA');
    expect(accommodation?.amenityFeature).toHaveLength(2);
  });

  it('omits empty image and amenity collections', () => {
    const schema = buildCottageStructuredData({
      ...cottage,
      mainImage: '',
      gallery: [],
      images: [],
      amenities: [],
    });
    const accommodation = schema['@graph'].find((node) => node['@type'] === 'Accommodation');
    expect(accommodation).not.toHaveProperty('image');
    expect(accommodation).not.toHaveProperty('amenityFeature');
  });
});