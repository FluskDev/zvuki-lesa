import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface Props {
  images: string[];
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}

export function GalleryLightbox({ images, open, onClose, initialIndex = 0 }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-black/95 border-white/10 p-0">
        <Carousel opts={{ startIndex: initialIndex, loop: true }}>
          <CarouselContent>
            {images.map((src, i) => (
              <CarouselItem key={i}>
                <img
                  src={src}
                  alt={`Фото ${i + 1}`}
                  className="w-full h-[80vh] object-contain"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4" />
          <CarouselNext className="right-4" />
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}
