import { useMemo } from 'react';
import {
  COTTAGES,
  COTTAGE_IMAGES,
  COTTAGE_AMENITIES,
  AMENITIES,
  RECREATION_ITEMS,
} from '@/types/content';
import type { Cottage, CottageImage } from '@/lib/api';

/**
 * Источник правды: src/data/cottages.json + связанные таблицы
 * (cottage-images, cottage-amenities, amenities, recreation-items) —
 * все из scripts/export-data.mjs.
 *
 * Возвращает ту же форму Cottage, что и раньше (camelCase + агрегаты
 * gallery/images/amenities/recreation), чтобы потребители
 * (Cabins, BookingPage, SeoPage, SiteMap, structuredData) не переписывать.
 *
 * Синхронный источник: loading=false, error=null. refetch — no-op
 * (сохранён для обратной совместимости с сигнатурой).
 */

export interface UseCottagesResult {
  data: Cottage[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY_REFETCH = () => {
  // no-op: данные синхронные, обновление контента — через git commit + redeploy.
};

function buildCottageImagesFor(cottageId: number): CottageImage[] {
  return COTTAGE_IMAGES
    .filter((img) => img.cottage_id === cottageId)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img) => ({
      id: img.id,
      url: img.url,
      section: img.section,
      position: img.position,
    }));
}

function buildGalleryUrls(images: CottageImage[]): string[] {
  return images.map((img) => img.url);
}

function buildAmenityNamesFor(cottageId: number): string[] {
  const amenityIds = COTTAGE_AMENITIES.filter(
    (ca) => ca.cottage_id === cottageId,
  ).map((ca) => ca.amenity_id);
  return AMENITIES.filter((a) => amenityIds.includes(a.id)).map((a) => a.name);
}

function buildRecreationFor(cottageId: number) {
  return RECREATION_ITEMS.filter((r) => r.cottage_id === cottageId)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      photo: r.photo,
    }));
}

function buildCottage(): Cottage[] {
  return COTTAGES.filter((c) => c.is_active).map((c) => {
    const images = buildCottageImagesFor(c.id);
    return {
      id: c.id,
      slug: c.slug,
      mapId: c.map_id,
      name: c.name,
      shortDescription: c.short_description,
      longDescription: c.long_description,
      description: c.description,
      houseRules: c.house_rules,
      basePrice: c.base_price,
      area: c.area,
      guests: c.guests,
      bedrooms: c.bedrooms,
      beds: { double: c.beds_double, single: c.beds_single },
      checkInTime: c.check_in_time,
      checkOutTime: c.check_out_time,
      mainImage: c.main_image,
      amenities: buildAmenityNamesFor(c.id),
      gallery: buildGalleryUrls(images),
      images,
      recreation: buildRecreationFor(c.id),
    };
  });
}

export function useCottages(): UseCottagesResult {
  const data = useMemo<Cottage[]>(() => buildCottage(), []);
  return { data, isLoading: false, error: null, refetch: EMPTY_REFETCH };
}
