import { useState } from 'react';
import { GalleryLightbox } from './GalleryLightbox';
import { BookingGallery } from './BookingGallery';
import { BookingCTA } from '@/components/BookingCTA/BookingCTA';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingHero({ cabin }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Если в БД есть секционированные фото — показываем галерею с табами.
  const hasSectionedImages = (cabin.images?.length ?? 0) > 0;

  // Fallback для домиков без photos в БД: используем статическую gallery + mainImage.
  const flatImages = cabin.gallery.length > 0
    ? cabin.gallery
    : cabin.mainImage
      ? [cabin.mainImage]
      : [];

  return (
    // Панель бронирования удалена в миграции на RealtyCalendar —
    // вся секция теперь лендинг домика, бронь через <BookingCTA /> на странице /booking.
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">{cabin.name}</h1>
          <p className="text-lg text-white/70 mb-6">{cabin.shortDescription}</p>
        </div>
        <div className="flex-shrink-0">
          {/* Кнопка бронирования: ведёт на RealtyCalendar — единая точка брони для всего сайта. */}
          <BookingCTA variant="default" size="lg" className="w-full sm:w-auto rounded-full px-8 py-6 text-lg" />
        </div>
      </div>

      {hasSectionedImages ? (
        <BookingGallery cottageName={cabin.name} images={cabin.images!} />
      ) : flatImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {flatImages.map((src, i) => (
            <button
              key={i}
              onClick={() => setLightboxOpen(true)}
              className={`relative overflow-hidden rounded-xl group ${
                i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto md:row-span-2' : 'aspect-square'
              }`}
            >
              <img
                src={src}
                alt={`${cabin.name} фото ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading={i <= 2 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>
      ) : null}

      {!hasSectionedImages && flatImages.length > 0 && (
        <GalleryLightbox
          images={flatImages}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </section>
  );
}