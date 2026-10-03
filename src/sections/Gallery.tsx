import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const galleryImages = [
  { src: '/Galary/1.jpg', alt: 'Фото 1' },
  { src: '/Galary/2.jpg', alt: 'Фото 2' },
  { src: '/Galary/3.jpg', alt: 'Фото 3' },
  { src: '/Galary/4.jpg', alt: 'Фото 4' },
  { src: '/Galary/5.jpg', alt: 'Фото 5' },
  { src: '/Galary/6.jpg', alt: 'Фото 6' },
  { src: '/Galary/7.jpg', alt: 'Фото 7' },
  { src: '/Galary/8.jpg', alt: 'Фото 8' },
  { src: '/Galary/9.jpg', alt: 'Фото 9' },
  { src: '/Galary/10.jpg', alt: 'Фото 10' },
  { src: '/Galary/11.jpg', alt: 'Фото 11' },
  { src: '/Galary/12.jpg', alt: 'Фото 12' },
  { src: '/Galary/13.jpg', alt: 'Фото 13' },
  { src: '/Galary/14.jpg', alt: 'Фото 14' },
  { src: '/Galary/15.jpg', alt: 'Фото 15' },
  { src: '/Galary/16.jpg', alt: 'Фото 16' },
  { src: '/Galary/17.jpg', alt: 'Фото 17' },
  { src: '/Galary/19.jpg', alt: 'Фото 19' },
  { src: '/Galary/20.jpg', alt: 'Фото 20' },
  { src: '/Galary/21.jpg', alt: 'Фото 21' },
  { src: '/Galary/22.jpg', alt: 'Фото 22' },
  { src: '/Galary/23.jpg', alt: 'Фото 23' },
  { src: '/Galary/24.jpg', alt: 'Фото 24' },
  { src: '/Galary/25.jpg', alt: 'Фото 25' },
];

const ITEMS_PER_PAGE = 6;

export function Gallery() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(galleryImages.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const currentImages = galleryImages.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const openImage = (index: number) => setSelectedIndex(startIndex + index);
  const closeImage = () => setSelectedIndex(null);
  const goToPrevious = () => setSelectedIndex((prev) => (prev === 0 ? galleryImages.length - 1 : (prev || 0) - 1));
  const goToNext = () => setSelectedIndex((prev) => (prev === galleryImages.length - 1 ? 0 : (prev || 0) + 1));

  const goToPrevPage = () => setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  const goToNextPage = () => setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));

  return (
    <section id="gallery" className="py-20 lg:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">Галерея</h2>
          <p className="text-lg text-stone-400 max-w-2xl mx-auto">Уютные домики и атмосферные интерьеры для вашего идеального отдыха</p>
        </div>

        <div className="relative">
          <button
            onClick={goToPrevPage}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-12 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-hidden" role="list" aria-label="Галерея фотографий">
            {currentImages.map((image, idx) => (
              <div
                key={`${currentPage}-${idx}`}
                className="relative aspect-square overflow-hidden rounded-xl cursor-pointer group"
                onClick={() => openImage(idx)}
                onKeyDown={(e) => e.key === 'Enter' && openImage(idx)}
                role="listitem"
                tabIndex={0}
                aria-label={`Открыть фото ${idx + 1}`}
                style={{ animation: `slideInFromRight 0.4s ease-out ${idx * 60}ms both` }}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
              </div>
            ))}
          </div>

          <button
            onClick={goToNextPage}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-12 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label="Следующая страница"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>

        <div className="flex justify-center items-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                idx === currentPage ? 'bg-white' : 'bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Страница ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={closeImage}>
        <DialogContent
          className="max-w-5xl bg-black/95 border-0 p-0"
          aria-describedby="dialog-image-description"
        >
          {selectedIndex !== null && (
            <div
              className="relative"
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') goToPrevious();
                if (e.key === 'ArrowRight') goToNext();
                if (e.key === 'Escape') closeImage();
              }}
              tabIndex={0}
              role="dialog"
              aria-modal="true"
              aria-label="Просмотр фотографии"
            >
              <img
                id="dialog-image-description"
                src={galleryImages[selectedIndex].src}
                alt={galleryImages[selectedIndex].alt}
                className="w-full max-h-[80vh] object-contain"
              />
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Предыдущее фото"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Следующее фото"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                {selectedIndex + 1} / {galleryImages.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
