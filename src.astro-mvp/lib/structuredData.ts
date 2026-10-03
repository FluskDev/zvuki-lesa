import type { Cottage, ReviewsResponse } from './api';

export interface JsonLdNode {
  '@type': string;
  '@id'?: string;
  image?: string[];
  amenityFeature?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface JsonLdGraph {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
}

const BASE_URL = 'https://zvuki-lesa.ru';
const LODGING_ID = `${BASE_URL}/#lodging`;

export function absoluteSiteUrl(path: string): string {
  return new URL(path, `${BASE_URL}/`).href;
}

function lodgingBusiness(extra: Partial<JsonLdNode> = {}): JsonLdNode {
  return {
    '@type': 'LodgingBusiness',
    '@id': LODGING_ID,
    name: 'Звуки Леса',
    alternateName: 'Гостевой дом Звуки леса',
    description: 'Гостевой дом с уютными домиками в станице Даховская, Республика Адыгея.',
    url: BASE_URL,
    telephone: '+79282110249',
    email: 'booking@zvuki-lesa.ru',
    image: [`${BASE_URL}/og-image.jpg`],
    priceRange: '₽₽',
    petsAllowed: true,
    checkinTime: '14:00',
    checkoutTime: '12:00',
    numberOfRooms: 3,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Короткая улица, 17',
      addressLocality: 'станица Даховская',
      addressRegion: 'Республика Адыгея',
      postalCode: '385700',
      addressCountry: 'RU',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 44.22314,
      longitude: 40.199615,
    },
    sameAs: [
      'https://www.instagram.com/zvukilesa01/',
      'https://t.me/ZVUKILESA01',
    ],
    ...extra,
  };
}

export function buildHomeStructuredData(reviews: ReviewsResponse | null): JsonLdGraph {
  const rating = reviews && reviews.total > 0 && reviews.items.length > 0
    ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: reviews.averageRating,
          reviewCount: reviews.total,
          bestRating: 5,
          worstRating: 1,
        },
        review: reviews.items.map((review) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: review.authorName },
          datePublished: review.date,
          reviewBody: review.text,
          reviewRating: {
            '@type': 'Rating',
            ratingValue: review.rating,
            bestRating: 5,
            worstRating: 1,
          },
        })),
      }
    : {};

  return {
    '@context': 'https://schema.org',
    '@graph': [
      lodgingBusiness(rating),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Домики', item: `${BASE_URL}/#cabins` },
          { '@type': 'ListItem', position: 3, name: 'Услуги', item: `${BASE_URL}/#services` },
          { '@type': 'ListItem', position: 4, name: 'Контакты', item: `${BASE_URL}/#contacts` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          ['В какое время заезд и выезд?', 'Заезд в 14:00, выезд в 12:00.'],
          ['Можно ли отменить бронирование?', 'Отмена возможна за 3 дня до заезда. Подробности по телефону.'],
          ['Есть ли Wi-Fi?', 'Да, Wi-Fi есть во всех домиках.'],
          ['Можно ли с животными?', 'По предварительной договорённости. Свяжитесь с нами.'],
          ['Как добраться?', 'Станица Даховская, Короткая улица, 17. Координаты: 44.223140, 40.199615.'],
          ['Какие услуги включены?', 'Джиппинг, рафтинг и банный чан оплачиваются отдельно.'],
        ].map(([name, text]) => ({
          '@type': 'Question',
          name,
          acceptedAnswer: { '@type': 'Answer', text },
        })),
      },
      {
        '@type': 'ImageObject',
        name: 'Гостевой дом Звуки Леса',
        description: 'Домики в горах Адыгеи',
        url: `${BASE_URL}/og-image.jpg`,
        contentUrl: `${BASE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
      },
    ],
  };
}

export function buildCottageStructuredData(cottage: Cottage): JsonLdGraph {
  const canonical = `${BASE_URL}/booking/${cottage.slug}`;
  const accommodationId = `${canonical}#accommodation`;
  const offerId = `${canonical}#offer`;
  const images = [...new Set([
    cottage.mainImage,
    ...cottage.gallery,
    ...cottage.images.map((image) => image.url),
  ].filter(Boolean))].map(absoluteSiteUrl);

  const accommodation: JsonLdNode = {
    '@type': 'Accommodation',
    '@id': accommodationId,
    name: cottage.name,
    description: cottage.longDescription || cottage.shortDescription,
    url: canonical,
    containedInPlace: { '@id': LODGING_ID },
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: cottage.guests,
    },
    floorSize: {
      '@type': 'QuantitativeValue',
      value: cottage.area,
      unitCode: 'MTK',
    },
    numberOfBedrooms: cottage.bedrooms,
    petsAllowed: true,
    checkinTime: cottage.checkInTime,
    checkoutTime: cottage.checkOutTime,
    offers: { '@id': offerId },
  };

  if (images.length > 0) accommodation.image = images;
  if (cottage.amenities.length > 0) {
    accommodation.amenityFeature = cottage.amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    }));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      lodgingBusiness(),
      accommodation,
      {
        '@type': 'Offer',
        '@id': offerId,
        url: canonical,
        price: cottage.basePrice,
        priceCurrency: 'RUB',
        unitText: 'ночь',
        availability: 'https://schema.org/InStock',
        itemOffered: { '@id': accommodationId },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Домики', item: `${BASE_URL}/#cabins` },
          { '@type': 'ListItem', position: 3, name: cottage.name, item: canonical },
        ],
      },
    ],
  };
}