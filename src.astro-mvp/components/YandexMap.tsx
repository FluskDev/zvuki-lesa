import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    ymaps: any;
  }
}

interface YandexMapProps {
  center: [number, number];
  zoom?: number;
  width?: string;
  height?: string;
}

export function YandexMap({ center, zoom = 17, width = '100%', height = '100%' }: YandexMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current || mapInstanceRef.current) {
      return;
    }
    isInitializedRef.current = true;

    const initMap = () => {
      if (!window.ymaps || !mapRef.current || mapInstanceRef.current) {
        return;
      }
      if (typeof window.ymaps.Map !== 'function') {
        return;
      }
      if (mapRef.current.firstChild) {
        mapRef.current.innerHTML = '';
      }

      const map = new window.ymaps.Map(mapRef.current, {
        center,
        zoom,
        controls: [],
        behaviors: ['disableScrolling'],
      });

      const placemark = new window.ymaps.Placemark(
        center,
        {
          balloonContent: 'Звуки леса',
          hintContent: 'Гостевой дом',
        },
        {
          preset: 'islands#darkGreenDotIcon',
          iconColor: '#059648',
        },
      );

      map.geoObjects.add(placemark);
      mapInstanceRef.current = map;
    };

    // Используем ymaps.ready() — колбэк вызывается только после полной загрузки модулей API.
    // Без этого ymaps.Map не является конструктором (modules ещё не инициализированы).
    const bootstrap = () => {
      if (window.ymaps?.ready) {
        window.ymaps.ready(initMap);
      } else {
        const interval = setInterval(() => {
          if (window.ymaps?.ready) {
            clearInterval(interval);
            window.ymaps.ready(initMap);
          }
        }, 100);
        // Сохраняем cleanup через ref-функцию возврата
        cleanupInterval = interval;
      }
    };

    let cleanupInterval: ReturnType<typeof setInterval> | undefined;

    if (window.ymaps) {
      bootstrap();
    } else {
      const scriptInterval = setInterval(() => {
        if (window.ymaps) {
          clearInterval(scriptInterval);
          bootstrap();
        }
      }, 100);
      cleanupInterval = scriptInterval;
    }

    return () => {
      if (cleanupInterval) clearInterval(cleanupInterval);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [center, zoom]);

  return <div ref={mapRef} style={{ width, height, borderRadius: '0.5rem' }} />;
}