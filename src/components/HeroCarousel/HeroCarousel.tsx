import { useEffect, useCallback, useState, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import styles from './HeroCarousel.module.css';

export interface HeroSlide {
  src: string;
  title: string;
  description: string;
  header?: string;
}

interface HeroCarouselProps {
  slides: HeroSlide[];
  autoplayInterval?: number;
}

export function HeroCarousel({
  slides,
  autoplayInterval = 6000,
}: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true },
    []
  );
  const [activeIndex, setActiveIndex] = useState(0);
  // Сколько слайдов уже разрешено загружать (src проставлен).
  // Стартуем с 1 — виден только первый слайд. Каждый его onLoad
  // открывает src для следующего. Так 4 hero-картинки грузятся
  // последовательно, не параллельно.
  const [maxLoadedSlide, setMaxLoadedSlide] = useState(0);
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetAutoplay = useCallback(() => {
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
    }
    if (emblaApi) {
      autoplayTimerRef.current = setInterval(() => {
        emblaApi.scrollNext();
      }, autoplayInterval);
    }
  }, [emblaApi, autoplayInterval]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
    };

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    resetAutoplay();

    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
    };
  }, [emblaApi, autoplayInterval, resetAutoplay]);

  const onUserInteraction = useCallback(() => {
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const onUserRelease = useCallback(() => {
    resetAutoplay();
  }, [resetAutoplay]);

  const onSlideClick = useCallback(() => {
    resetAutoplay();
  }, [resetAutoplay]);

  // Handle tab visibility - pause autoplay when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (autoplayTimerRef.current) {
          clearInterval(autoplayTimerRef.current);
          autoplayTimerRef.current = null;
        }
      } else {
        resetAutoplay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetAutoplay]);

  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.on('pointerDown', onUserInteraction);
    emblaApi.on('pointerUp', onUserRelease);
    emblaApi.on('pointerUp', onSlideClick);

    return () => {
      emblaApi.off('pointerDown', onUserInteraction);
      emblaApi.off('pointerUp', onUserRelease);
      emblaApi.off('pointerUp', onSlideClick);
    };
  }, [emblaApi, onUserInteraction, onUserRelease, onSlideClick]);

  const handleIndicatorClick = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      // Если прыгнули на ещё не загруженный слайд — открываем src
      // для всех до него, чтобы не упереться в пустоту.
      setMaxLoadedSlide((prev) => Math.max(prev, index));
      emblaApi.scrollTo(index);
      onUserInteraction();
    },
    [emblaApi, onUserInteraction],
  );

  const handleSlideLoad = useCallback((index: number) => {
    // Когда слайд N доехал — открываем src для слайда N+1.
    setMaxLoadedSlide((prev) => Math.max(prev, index + 1));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.viewport} ref={emblaRef}>
        <div className={styles.track}>
          {slides.map((slide, index) => {
            const isFirst = index === 0;
            const showSrc = index <= maxLoadedSlide;
            return (
              <div key={index} className={styles.slide}>
                <img
                  src={showSrc ? slide.src : undefined}
                  alt=""
                  className={styles.image}
                  loading={isFirst ? 'eager' : 'eager'}
                  decoding={isFirst ? 'sync' : 'async'}
                  fetchPriority={isFirst ? 'high' : 'low'}
                  onLoad={showSrc ? () => handleSlideLoad(index) : undefined}
                />
                <div className={styles.content}>
                  {slide.header && <p className={styles.header}>{slide.header}</p>}
                  <h2 className={styles.title}>{slide.title}</h2>
                  <p className={styles.description}>{slide.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.overlay} />

      <div className={styles.indicators}>
        {slides.map((_, index) => (
          <button
            key={index}
            className={`${styles.indicator} ${
              index === activeIndex ? styles.indicatorActive : ''
            }`}
            onClick={() => handleIndicatorClick(index)}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}