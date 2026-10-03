import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Image } from 'lucide-react';

interface Service {
  id: number;
  name: string;
  mediaFolder: string;
}

interface ServiceMediaDialogProps {
  service: Service | null;
  isOpen: boolean;
  onClose: () => void;
}

const serviceMedia: Record<string, string[]> = {
  rafting: [],
  jeeping: [],
  'bath-cham': [
    '/services/bath-cham/1.jpg',
    '/services/bath-cham/2.jpg',
  ],
};

export function ServiceMediaDialog({ service, isOpen, onClose }: ServiceMediaDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [service]);

  if (!service) return null;

  const images = serviceMedia[service.mediaFolder] || [];
  const hasImages = images.length > 0;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0">
        {/* Заголовок */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-stone-800">{service.name}</h2>
        </div>

        {/* Контент */}
        <div className="px-6 py-4">
          {!hasImages ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Image className="w-7 h-7 text-stone-400" />
              </div>
              <p className="text-stone-500 text-sm">Фото пока не добавлены</p>
            </div>
          ) : (
            <div className="relative">
              {/* Фото контейнер */}
              <div className="relative bg-stone-100 rounded-lg overflow-hidden">
                <img
                  src={images[currentIndex]}
                  alt={`${service.name} - фото ${currentIndex + 1}`}
                  className="w-full h-64 sm:h-80 object-cover"
                />

                {/* Навигация */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-stone-700" />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-stone-700" />
                    </button>
                  </>
                )}

                {/* Счётчик */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-1 rounded-full text-white text-xs">
                  {currentIndex + 1} / {images.length}
                </div>
              </div>

              {/* Миниатюры */}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {images.map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${
                        idx === currentIndex ? 'border-emerald-600' : 'border-transparent hover:border-stone-300'
                      }`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}