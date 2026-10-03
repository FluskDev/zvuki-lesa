/**
 * Лёгкий клиент аналитики. Хранит session_id в localStorage, шлёт события
 * pageview/click на /api/analytics/event. Использует sendBeacon там, где
 * доступно (для надёжности при закрытии вкладки).
 *
 * После удаления backend (Task 2.5) POST на /api/analytics/event уходит в 404.
 * Решение: send() стал no-op — session_id всё ещё хранится (на случай если в
 * будущем подключим внешнюю аналитику), события логируются в console.debug
 * для разработки. Трекинг на проде обеспечивается Yandex.Metrika (index.html).
 */

const SESSION_KEY = 'analytics_session_id';

function randomId(): string {
  // Короткий session id: 16 hex-символов.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

export type AnalyticsEventType = 'pageview' | 'click';

export interface AnalyticsPayload {
  sessionId: string;
  eventType: AnalyticsEventType;
  page?: string;
  label?: string;
  referrer?: string;
}

function send(payload: AnalyticsPayload): void {
  // Backend удалён (Task 2.5). Раньше тут был POST на /api/analytics/event +
  // sendBeacon fallback — оба теперь уходят в 404 (Vite SPA-fallback). Чтобы
  // не мусорить console на проде 404-шками, делаем no-op + debug-лог для
  // разработки. Yandex.Metrika в index.html — единственный сборщик событий.
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[analytics]', payload);
  }
}

export function trackPageview(page: string): void {
  send({
    sessionId: getSessionId(),
    eventType: 'pageview',
    page,
    referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
  });
}

export function trackClick(label: string, page?: string): void {
  send({
    sessionId: getSessionId(),
    eventType: 'click',
    page: page ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
    label,
  });
}
