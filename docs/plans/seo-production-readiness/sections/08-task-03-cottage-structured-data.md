### Task 3C: Реализовать cottage JSON-LD и завершить GREEN

**Files:**
- Modify: `src/lib/structuredData.ts`
- Test: `src/lib/structuredData.test.ts`

- [ ] **Step 1: Добавить builder конкретного домика**

В конец `src/lib/structuredData.ts` добавить:

```ts
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
```

- [ ] **Step 2: Запустить focused tests**

Run:

```bash
npx vitest run src/lib/structuredData.test.ts
```

Expected: 4 tests PASS. В JSON нет пустых `image`/`amenityFeature`, а URL с кириллицей корректно percent-encoded через `new URL()`.

- [ ] **Step 3: Проверить TypeScript типов Schema**

Run:

```bash
npx tsc -b --pretty false
```

Expected: PASS. Если TypeScript укажет на optional `image` в тесте, использовать уже предусмотренный optional access `accommodation?.image?.[0]`, а не ослаблять тип до `any`.

---
