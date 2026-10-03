import { useEffect, useRef } from 'react';
import { loadYandexMaps } from '@/lib/loadYandexMaps';

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

    let cancelled = false;

    const initMap = () => {
      if (cancelled || !window.ymaps || !mapRef.current || mapInstanceRef.current) {
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

    // ymaps.ready() вызывается после полной инициализации модулей API
    // (без этого ymaps.Map не является конструктором).
    loadYandexMaps()
      .then((ymaps) => {
        if (cancelled) return;
        ymaps.ready(initMap);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[YandexMap] failed to load API:', err);
      });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [center, zoom]);

  return <div ref={mapRef} style={{ width, height, borderRadius: '0.5rem' }} />;
}
