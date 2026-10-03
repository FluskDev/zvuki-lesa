import { useState, useRef, useEffect } from 'react';
import { Bed, Users } from 'lucide-react';
import { useCottages } from '@/hooks/useCottages';
import { cn } from '@/lib/utils';
import type { Cottage } from '@/lib/api';

function MiniCabinCard({ cabin }: { cabin: Cottage }) {
  const images = cabin.gallery.length > 0 ? cabin.gallery : [cabin.mainImage];
  const [currentImage, setCurrentImage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const lastXRef = useRef<number>(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isHovered || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const threshold = rect.width / images.length;

    const index = Math.floor(x / threshold);
    const clampedIndex = Math.min(Math.max(index, 0), images.length - 1);

    if (x > lastXRef.current && clampedIndex !== currentImage) {
      setCurrentImage(Math.min(currentImage + 1, images.length - 1));
    } else if (x < lastXRef.current && clampedIndex !== currentImage) {
      setCurrentImage(Math.max(currentImage - 1, 0));
    }

    lastXRef.current = x;
  };

  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden flex-shrink-0 select-none"
      style={{ backgroundColor: '#2B2B30', width: '328px', height: '414px', marginRight: '20px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCurrentImage(0);
      }}
    >
      <div
        ref={imageRef}
        className="relative h-44 overflow-hidden select-none"
        onMouseMove={handleMouseMove}
      >
        <img
          src={images[currentImage]}
          alt={cabin.name}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentImage ? 'bg-white w-3' : 'bg-white/50'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4">
        <h3 className="text-lg font-bold text-white mb-1">{cabin.name}</h3>
        <p className="text-sm text-white/70 mb-3 line-clamp-2">{cabin.shortDescription}</p>

        <div className="flex items-center gap-2 text-xs text-white/60 mb-4 flex-wrap">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>до {cabin.guests} гостей</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Bed className="w-3 h-3" />
            <span>{cabin.bedrooms} {cabin.bedrooms === 1 ? 'спальня' : 'спальни'}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Bed className="w-3 h-3" />
            <span>{cabin.area} м²</span>
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => { window.location.href = `/booking/${cabin.id}`; }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-4 px-8 rounded-full transition-colors w-full"
          data-track={`cabin_book_${cabin.id}`}
        >
          Забронировать
        </button>
      </div>
    </div>
  );
}

function DraggableContainer({ children, count }: { children: React.ReactNode; count: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ isDown: false, startX: 0, startScroll: 0, moved: false });

  // При малом числе домиков центрируем вместо эффекта «выезда за край».
  const centerMode = count > 0 && count <= 3;

  // Глобальные слушатели нужны, чтобы драг не «терялся» при выходе курсора за карточку.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s.isDown || !containerRef.current) return;
      const el = containerRef.current;
      const dx = e.clientX - s.startX;
      if (Math.abs(dx) > 4) s.moved = true;

      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return; // скролла нет — драг не нужен
      const target = s.startScroll - dx;
      const RESISTANCE = 0.3;
      const RUBBER_LIMIT = 140;

      if (target < 0) {
        // Тянем вправо от левой границы — резинка.
        el.scrollLeft = 0;
        const over = Math.max(-RUBBER_LIMIT, target);
        el.style.transform = `translateX(${over * RESISTANCE}px)`;
      } else if (target > max) {
        // Тянем влево от правой границы — резинка.
        el.scrollLeft = max;
        const over = Math.min(RUBBER_LIMIT, target - max);
        el.style.transform = `translateX(${over * RESISTANCE}px)`;
      } else {
        el.scrollLeft = target;
        el.style.transform = 'translateX(0)';
      }
    };
    const onUp = () => {
      const s = stateRef.current;
      if (!s.isDown) return;
      s.isDown = false;
      if (containerRef.current) {
        const el = containerRef.current;
        // Пружинный возврат резинки.
        if (el.style.transform && el.style.transform !== 'translateX(0px)') {
          el.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = 'translateX(0)';
          window.setTimeout(() => {
            el.style.transition = '';
          }, 450);
        }
        el.style.cursor = centerMode ? 'default' : 'grab';
        el.style.removeProperty('user-select');
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [centerMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || centerMode) return;
    // Не начинаем драг с интерактивных элементов внутри карточки (ссылки/кнопки).
    const target = e.target as HTMLElement;
    if (target.closest('a, button')) return;
    const s = stateRef.current;
    s.isDown = true;
    s.moved = false;
    s.startX = e.clientX;
    s.startScroll = containerRef.current.scrollLeft;
    containerRef.current.style.cursor = 'grabbing';
    containerRef.current.style.userSelect = 'none';
  };

  // Подавляем клик по карточке после драга, чтобы не открывать её случайно.
  const handleClick = (e: React.MouseEvent) => {
    if (stateRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex gap-5 pb-2 overflow-x-auto overflow-y-hidden scrollbar-hide select-none',
        centerMode && 'justify-center',
      )}
      style={centerMode
        ? { cursor: 'default' }
        : { cursor: 'grab', paddingLeft: '200px', paddingRight: '200px', marginLeft: '-200px' }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

function CabinCardSkeleton() {
  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden flex-shrink-0 animate-pulse"
      style={{ backgroundColor: '#2B2B30', width: '328px', height: '414px', marginRight: '20px' }}
    >
      <div className="h-44 bg-white/5" />
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div className="h-5 bg-white/5 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-full" />
        <div className="h-3 bg-white/5 rounded w-2/3" />
        <div className="flex-1" />
        <div className="h-12 bg-white/5 rounded-full" />
      </div>
    </div>
  );
}

export function Cabins() {
  const { data: cottages, isLoading } = useCottages();

  return (
    <section id="cabins" className="min-h-screen flex items-center py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Наши домики
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Выберите идеальное место для вашего отдыха в горах Адыгеи
          </p>
        </div>

        <div className="overflow-visible">
          <DraggableContainer count={isLoading || !cottages ? 3 : cottages.length}>
            {isLoading || !cottages
              ? Array.from({ length: 3 }).map((_, i) => <CabinCardSkeleton key={i} />)
              : cottages.map((cabin) => (
                  <MiniCabinCard key={cabin.id} cabin={cabin} />
                ))}
          </DraggableContainer>
        </div>
      </div>
    </section>
  );
}