/**
 * Динамический загрузчик Yandex Maps JS API.
 *
 * Скрипт НЕ встраивается в index.html (иначе блокирует initial render ~704KB
 * на каждой странице, включая те, где карты нет). Вместо этого <YandexMap>
 * вызывает loadYandexMaps() при монтировании — скрипт инжектится на лету.
 *
 * Защита от двойной загрузки при нескольких <YandexMap> на странице:
 * один и тот же промис переиспользуется.
 */
declare global {
  interface Window {
    ymaps?: any;
  }
}

const API_SRC =
  'https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=a662013a-bd16-4b08-b2a2-930268c87a3f';

let loadingPromise: Promise<typeof window.ymaps> | null = null;

export function loadYandexMaps(): Promise<typeof window.ymaps> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Yandex Maps доступен только в браузере'));
  }

  // Уже загружен
  if (window.ymaps) {
    return Promise.resolve(window.ymaps);
  }

  // Уже идёт загрузка — переиспользуем промис
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="${API_SRC.split('?')[0]}"]`,
    );
    if (existing) {
      // Кто-то уже добавил <script>, ждём его onload
      existing.addEventListener('load', () => resolve(window.ymaps));
      existing.addEventListener('error', () =>
        reject(new Error('Yandex Maps script load error')),
      );
      return;
    }

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onload = () => resolve(window.ymaps);
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error('Yandex Maps script load error'));
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}
