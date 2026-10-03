/**
 * API клиент для работы с сервером бронирования
 * Использует относительный путь /api, который проксируется Vite на http://localhost:3001.
 */

const API_BASE = '/api';

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; details?: unknown };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = await res.json();
    if (!res.ok || body.success === false) {
      return {
        success: false,
        error: body.error ?? `HTTP ${res.status}`,
        code: body.code,
        details: body.details,
      };
    }
    return { success: true, data: body };
  } catch (err) {
    console.error('[api]', err);
    return { success: false, error: 'Нет связи с сервером' };
  }
}

export type CottageSection = 'main' | 'interior' | 'kitchen' | 'bathroom' | 'amenities';

export interface CottageImage {
  id: number;
  url: string;
  section: CottageSection;
  position: number;
}

export interface Cottage {
  id: number;
  slug: string;
  mapId: string | null;
  name: string;
  shortDescription: string;
  longDescription: string;
  description: string;
  houseRules: string;
  basePrice: number;
  area: number;
  guests: number;
  bedrooms: number;
  beds: { double: number; single: number };
  checkInTime: string;
  checkOutTime: string;
  mainImage: string;
  amenities: string[];
  gallery: string[];
  images: CottageImage[];
  recreation: { id: number; title: string; description: string; photo: string }[];
}

export interface Service {
  id: number;
  slug: string;
  name: string;
  description: string;
  basePrice: number | null;
  icon: string;
}

export interface PriceQuote {
  perNight: { date: string; base: number; final: number; rule: string | null }[];
  subtotal: number;
  minNightsOk: boolean;
  warning: string | null;
}

export interface BookingData {
  cottageId: number;
  guestName: string;
  phone: string;
  email?: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  notes?: string;
  services?: { serviceId: number; quantity: number }[];
}

export interface BookingResponse {
  id: number;
  status: 'new' | 'confirmed' | 'cancelled';
  nights: number;
  subtotal: number;
  servicesTotal: number;
  totalPrice: number;
  createdAt: string;
}

export async function getCottages() {
  return apiFetch<{ cottages: Cottage[] }>('/cottages');
}

export async function getCottage(idOrSlug: string | number) {
  return apiFetch<{ cottage: Cottage }>(`/cottages/${idOrSlug}`);
}

export async function getAvailability(
  cottageId: number,
  checkIn: string,
  checkOut: string,
  guests = 1,
) {
  const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
  return apiFetch<{
    available: boolean;
    nights: number;
    guests: number;
    price: PriceQuote;
  }>(`/cottages/${cottageId}/availability?${params}`);
}

export async function searchAvailableCottages(checkIn: string, checkOut: string, guests = 1) {
  const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
  return apiFetch<{
    checkIn: string;
    checkOut: string;
    nights: number;
    results: {
      cottageId: number;
      name: string;
      mainImage: string;
      subtotal: number;
      guests: number;
    }[];
  }>(`/availability?${params}`);
}

export async function getServices() {
  return apiFetch<{ services: Service[] }>('/services');
}

export async function getBookedDates(cottageId: number, from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  return apiFetch<{ bookedDates: { startDate: string; endDate: string }[] }>(
    `/calendar/${cottageId}?${params}`,
  );
}

export interface CalendarPrice {
  date: string;
  base: number;
  final: number;
  rule: string | null;
}

export async function getCalendarPrices(cottageId: number, from: string, days: number) {
  const params = new URLSearchParams({ from, days: String(days) });
  return apiFetch<{ cottageId: number; basePrice: number; prices: CalendarPrice[] }>(
    `/cottages/${cottageId}/calendar-prices?${params}`,
  );
}

export interface AggregatePrice {
  date: string;
  min: number;
  max: number;
  hasRule: boolean;
}

export async function getAggregateCalendarPrices(from: string, days: number) {
  const params = new URLSearchParams({ from, days: String(days) });
  return apiFetch<{ prices: AggregatePrice[] }>(`/calendar-prices?${params}`);
}

export async function createBooking(data: BookingData) {
  return apiFetch<{ booking: BookingResponse }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface Review {
  id: number;
  authorName: string;
  rating: number;
  text: string;
  date: string;
  source: '2gis' | 'yandex' | 'google' | 'manual';
  isPublished: boolean;
  /** Локальный URL аватара (/uploads/reviews/avatars/<hash>.webp). null = рисуем инициалы. */
  avatarUrl: string | null;
  /** Прямая ссылка на отзыв/профиль во внешнем источнике (Яндекс.Карты и т.п.). null = не импортировано. */
  authorUrl: string | null;
}

export interface ReviewsResponse {
  items: Review[];
  averageRating: number;
  total: number;
  /** Fallback на страницу отзывов бизнеса на Яндекс.Картах (если у отзыва нет authorUrl). */
  yandexReviewsUrl: string | null;
}

export async function getReviews() {
  return apiFetch<{ data: ReviewsResponse }>('/reviews');
}