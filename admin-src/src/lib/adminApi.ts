/**
 * API клиент админки для управления бронированиями.
 * Использует относительный путь /api/admin, который проксируется Vite на http://localhost:3001.
 */

import type { ApiResult } from './api';

const BASE = '/api/admin';
export const TOKEN_KEY = 'admin_token';

export interface AdminBookingService {
  name: string;
  quantity: number;
  priceAtBooking: number | null;
}

export interface AdminBooking {
  id: number;
  cottageId: number;
  cottageName: string;
  guestName: string;
  phone: string;
  email: string | null;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nights: number;
  subtotal: number;
  servicesTotal: number;
  totalPrice: number;
  status: 'new' | 'confirmed' | 'cancelled';
  source: 'site' | 'manual';
  notes: string | null;
  managerComment: string | null;
  createdAt: string;
  services: AdminBookingService[];
}

export interface OccupancyItem {
  bookingId: number;
  cottageId: number;
  guestName: string;
  status: 'new' | 'confirmed';
  checkInDate: string;
  checkOutDate: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = getToken();
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) {
      clearToken();
      return { success: false, error: 'Требуется авторизация', code: 'UNAUTHORIZED' };
    }
    const body = await res.json();
    if (!res.ok || body.success === false) {
      return { success: false, error: body.error ?? `HTTP ${res.status}`, code: body.code };
    }
    return { success: true, data: body };
  } catch {
    return { success: false, error: 'Нет связи с сервером' };
  }
}

export async function adminLogin(password: string): Promise<ApiResult<{ token: string }>> {
  const res = await adminFetch<{ token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (res.success) localStorage.setItem(TOKEN_KEY, res.data.token);
  return res;
}

export interface ListParams {
  status?: 'new' | 'confirmed' | 'cancelled' | 'all';
  from?: string;
  to?: string;
  cottageId?: number;
}

export async function getAdminBookings(params: ListParams) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  return adminFetch<{ bookings: AdminBooking[] }>(`/bookings?${qs}`);
}

export async function getAdminCalendar(from: string, to: string) {
  const qs = new URLSearchParams({ from, to });
  return adminFetch<{ occupancy: OccupancyItem[] }>(`/calendar?${qs}`);
}

export interface ManualBookingInput {
  cottageId: number;
  guestName: string;
  phone: string;
  email?: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  notes?: string;
  managerComment?: string;
  priceOverride?: number;
}

export async function createAdminBooking(input: ManualBookingInput) {
  return adminFetch<{ booking: AdminBooking }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminBooking(id: number, patch: Partial<ManualBookingInput & { status: string; totalPrice: number }>) {
  return adminFetch<{ booking: AdminBooking }>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function confirmAdminBooking(id: number) {
  return adminFetch<{ booking: AdminBooking }>(`/bookings/${id}/confirm`, { method: 'POST' });
}

export async function cancelAdminBooking(id: number) {
  return adminFetch<{ booking: AdminBooking }>(`/bookings/${id}/cancel`, { method: 'POST' });
}

export interface FinanceSummary {
  totalBookings: number;
  activeBookings: number;
  cancelledBookings: number;
  upcomingBookings: number;
  totalRevenue: number;
  totalNights: number;
  servicesRevenue: number;
  averageCheck: number;
}

export interface FinanceByCottage {
  cottageId: number;
  cottageName: string;
  bookings: number;
  nights: number;
  revenue: number;
}

export interface FinanceByMonth {
  month: string; // YYYY-MM
  bookings: number;
  revenue: number;
}

export interface FinanceReport {
  summary: FinanceSummary;
  byCottage: FinanceByCottage[];
  byMonth: FinanceByMonth[];
}

export interface FinanceParams {
  from?: string;
  to?: string;
}

export async function getAdminFinance(params: FinanceParams = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  const suffix = qs.toString() ? `?${qs}` : '';
  return adminFetch<{ finance: FinanceReport }>(`/finance${suffix}`);
}

export interface AnalyticsSummary {
  totalEvents: number;
  totalSessions: number;
  eventsToday: number;
  sessionsToday: number;
}

export interface AnalyticsByDay {
  date: string;
  events: number;
  sessions: number;
}

export interface AnalyticsTopPage {
  page: string;
  events: number;
  sessions: number;
}

export interface AnalyticsTopClick {
  label: string;
  events: number;
}

export interface AnalyticsReferrer {
  source: 'direct' | 'search' | 'social' | 'referral';
  events: number;
}

export interface AnalyticsReport {
  windowDays: number;
  summary: AnalyticsSummary;
  byDay: AnalyticsByDay[];
  topPages: AnalyticsTopPage[];
  topClicks: AnalyticsTopClick[];
  referrers: AnalyticsReferrer[];
}

export async function getAdminAnalytics(days = 30) {
  return adminFetch<{ analytics: AnalyticsReport }>(`/analytics?days=${days}`);
}

/**
 * Generic CRUD helpers для ресурсов админки (SEO-страницы, блог и т. п.).
 * Используют тот же adminFetch, что и доменные функции выше.
 */
export const adminApi = {
  get: <T = unknown>(path: string) => adminFetch<T>(path),
  post: <T = unknown>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T = unknown>(path: string) =>
    adminFetch<T>(path, { method: 'DELETE' }),
};

// ---------- Домики ----------

export const COTTAGE_SECTIONS = ['main', 'interior', 'kitchen', 'bathroom', 'amenities'] as const;
export type CottageSection = (typeof COTTAGE_SECTIONS)[number];

export const COTTAGE_SECTION_LABELS: Record<CottageSection, string> = {
  main: 'Главная',
  interior: 'Внутри',
  kitchen: 'Кухня',
  bathroom: 'Ванная',
  amenities: 'Удобства',
};

export interface CottageImage {
  id: number;
  url: string;
  section: CottageSection;
  position: number;
}

export interface CottageAmenity {
  id: number;
  name: string;
  icon: string | null;
}

export interface AdminCottage {
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
  amenitiesFull: CottageAmenity[];
  gallery: string[];
  images: CottageImage[];
  isActive?: boolean;
}

export interface CottagePatch {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  description?: string | null;
  houseRules?: string | null;
  basePrice?: number;
  area?: number;
  guests?: number;
  bedrooms?: number;
  bedsDouble?: number;
  bedsSingle?: number;
  checkInTime?: string;
  checkOutTime?: string;
  mapId?: string | null;
  isActive?: boolean;
  amenityIds?: number[];
}

export interface CreateCottageInput {
  slug: string;
  mapId: string | null;
  name: string;
  mainImage: string;
  shortDescription: string;
  longDescription: string;
  description?: string | null;
  houseRules?: string | null;
  basePrice: number;
  area: number;
  guests: number;
  bedrooms: number;
  bedsDouble: number;
  bedsSingle: number;
  checkInTime: string;
  checkOutTime: string;
  isActive: boolean;
  amenityIds?: number[];
}

export async function createAdminCottage(input: CreateCottageInput) {
  return adminFetch<{ cottage: AdminCottage }>('/cottages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminCottage(id: number) {
  return adminFetch<{ success: true }>(`/cottages/${id}`, { method: 'DELETE' });
}

export async function getAdminCottage(id: number) {
  return adminFetch<{ cottage: AdminCottage }>(`/cottages/${id}`);
}

export async function updateAdminCottage(id: number, patch: CottagePatch) {
  return adminFetch<{ cottage: AdminCottage }>(`/cottages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function addCottageImage(
  cottageId: number,
  payload: { url: string; section?: CottageSection; position?: number },
) {
  return adminFetch<{ image: CottageImage }>(`/cottages/${cottageId}/images`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCottageImage(
  cottageId: number,
  imageId: number,
  patch: { section?: CottageSection; position?: number },
) {
  return adminFetch<{ image: CottageImage }>(`/cottages/${cottageId}/images/${imageId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteCottageImage(cottageId: number, imageId: number) {
  return adminFetch<{ success: true }>(`/cottages/${cottageId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

export async function listAdminAmenities() {
  return adminFetch<{ amenities: CottageAmenity[] }>(`/amenities`);
}

// Минимальный набор полей, нужный AdminSiteMapPicker'у — список занятых mapId'ов.
export interface AdminCottageSummary {
  id: number;
  mapId: string | null;
  name: string;
  isActive?: boolean;
}

export async function listAdminCottages() {
  return adminFetch<{ cottages: AdminCottageSummary[] }>(`/cottages`);
}

// ---------- Элементы карты (Парковка, Лес1, Лес2, чан) ----------

export interface SiteMapElement {
  mapId: string;
  title: string | null;
  description: string | null;
  photoUrl: string | null;
  hasButton: boolean;
  updatedAt: string;
}

export type SiteMapElementMap = Record<string, SiteMapElement | null>;

export async function getSiteMapElements() {
  // Публичный эндпоинт /api/site-elements, поэтому ходим через обычный fetch,
  // а не через adminFetch (который добавил бы префикс /api/admin).
  const res = await fetch('/api/site-elements');
  const body = await res.json();
  if (!res.ok || body.success === false) {
    return { success: false as const, error: body.error ?? `HTTP ${res.status}` };
  }
  return { success: true as const, data: body.data as SiteMapElementMap };
}

export interface SiteElementPatch {
  title?: string;
  description?: string | null;
  photoUrl?: string | null;
  hasButton?: boolean;
}

export async function updateSiteMapElement(mapId: string, patch: SiteElementPatch) {
  return adminFetch<{ data: SiteMapElement }>(`/site-elements/${encodeURIComponent(mapId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
