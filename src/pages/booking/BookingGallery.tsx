import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { GalleryLightbox } from './GalleryLightbox';
import type { CottageImage } from '@/lib/api';

const SECTION_LABELS: Record<CottageImage['section'], string> = {
  main: 'Главная',
  interior: 'Внутри',
  kitchen: 'Кухня',
  bathroom: 'Ванная',
  amenities: 'Удобства',
};

const SECTION_ORDER: CottageImage['section'][] = [
  'main', 'interior', 'kitchen', 'bathroom', 'amenities',
];

const sectionIndex = (s: CottageImage['section']) => SECTION_ORDER.indexOf(s);

interface Props {
  cottageName: string;
  images: CottageImage[];
}

/**
 * Галерея домика с табами по секциям: Главная / Внутри / Кухня / Ванная / Удобства.
 * Первая непустая секция выбирается автоматически. Клик по фото открывает lightbox
 * на общем массиве (с сохранением позиции). Если фото совсем нет — fallback на плоскую сетку
 * по `mainImage`/`gallery`.
 */
export function BookingGallery({ cottageName, images }: Props) {
  const sortedImages = useMemo(
    () => [...(images ?? [])]
      .sort((a, b) => sectionIndex(a.section) - sectionIndex(b.section) || a.position - b.position),
    [images],
  );

  const grouped = useMemo(() => {
    const map: Record<CottageImage['section'], CottageImage[]> = {
      main: [], interior: [], kitchen: [], bathroom: [], amenities: [],
    };
    for (const img of sortedImages) map[img.section].push(img);
    return map;
  }, [sortedImages]);

  const nonEmptySections = SECTION_ORDER.filter((s) => grouped[s].length > 0);

  const [activeSection, setActiveSection] = useState<CottageImage['section'] | null>(
    nonEmptySections[0] ?? null,
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Если у домика нет ни одной секции с фото — ничего не показываем (BookingHero
  // отрендерит fallback на mainImage через `<img>`).
  if (nonEmptySections.length === 0) return null;

  const visibleSection = activeSection && grouped[activeSection].length > 0
    ? activeSection
    : nonEmptySections[0];
  const visibleImages = grouped[visibleSection];

  return (
    <>
      <div role="tablist" aria-label="Секции фото домика" className="flex flex-wrap gap-1.5 mb-4">
        {nonEmptySections.map((section) => {
          const count = grouped[section].length;
          const isActive = section === visibleSection;
          return (
            <button
              key={section}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveSection(section)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-sm transition-colors',
                'border border-white/10',
                isActive
                  ? 'bg-white text-[#0E0E10] border-transparent'
                  : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white',
              )}
            >
              {SECTION_LABELS[section]}
              <span className={cn(
                'text-xs tabular-nums',
                isActive ? 'text-[#0E0E10]/60' : 'text-white/50',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {visibleImages.map((img, i) => {
          // Индекс в общем массиве sortedImages для lightbox.
          const globalIdx = sortedImages.findIndex((s) => s.id === img.id);
          return (
            <button
              key={img.id}
              onClick={() => openLightbox(globalIdx)}
              className={cn(
                'relative overflow-hidden rounded-xl group',
                i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto md:row-span-2' : 'aspect-square',
              )}
            >
              <img
                src={img.url}
                alt={`${cottageName} — ${SECTION_LABELS[img.section]} фото ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading={i <= 2 ? 'eager' : 'lazy'}
              />
            </button>
          );
        })}
      </div>

      <GalleryLightbox
        images={sortedImages.map((i) => i.url)}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        initialIndex={lightboxIndex}
      />
    </>
  );
}