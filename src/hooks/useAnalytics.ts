import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getSessionId, trackClick, trackPageview } from '@/lib/analytics';

/**
 * Глобальный трекинг: pageview на смене роута + click delegation по [data-track].
 * Вызывать один раз на верхнем уровне приложения (внутри <Router>).
 */
export function useAnalytics(): void {
  const location = useLocation();
  const lastPathRef = useRef<string>('');

  // 1) pageview на смене pathname
  useEffect(() => {
    if (location.pathname === lastPathRef.current) return;
    lastPathRef.current = location.pathname;
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  // 2) click delegation — ловим клики по [data-track] в любой точке DOM.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest('[data-track]') as HTMLElement | null;
      if (!el) return;
      const label = el.getAttribute('data-track') || el.textContent?.trim() || 'unknown';
      trackClick(label.slice(0, 200));
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // 3) Грейсфул флаш событий при закрытии вкладки — sendBeacon уже используется
  // внутри send(). Дополнительно инициализируем session id.
  useEffect(() => {
    getSessionId();
  }, []);
}
