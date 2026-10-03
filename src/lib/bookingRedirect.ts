/**
 * Единственный URL бронирования во всём проекте.
 * RealtyCalendar — внешний channel manager, все бронирования идут туда.
 */
export const RC_BOOKING_URL = 'https://homereserve.ru/feEBPdLdgb';

/**
 * Собрать URL с query-параметрами.
 * Фильтрует undefined и пустые строки.
 * Если после фильтра ничего не осталось — возвращает базовый URL без "?".
 */
export function rcBookingHref(params?: Record<string, string | undefined>): string {
  if (!params) return RC_BOOKING_URL;
  const filtered = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '',
  ) as [string, string][];
  if (filtered.length === 0) return RC_BOOKING_URL;
  const qs = new URLSearchParams(filtered).toString();
  return `${RC_BOOKING_URL}?${qs}`;
}
