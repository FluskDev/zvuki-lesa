import { describe, it, expect } from 'vitest';
import { RC_BOOKING_URL, rcBookingHref } from './bookingRedirect';

describe('bookingRedirect', () => {
  it('exposes homereserve.ru URL', () => {
    expect(RC_BOOKING_URL).toBe('https://homereserve.ru/feEBPdLdgb');
  });

  describe('rcBookingHref', () => {
    it('returns base URL when params undefined', () => {
      expect(rcBookingHref()).toBe('https://homereserve.ru/feEBPdLdgb');
    });

    it('returns base URL when params empty', () => {
      expect(rcBookingHref({})).toBe('https://homereserve.ru/feEBPdLdgb');
    });

    it('appends query string when params given', () => {
      expect(rcBookingHref({ checkIn: '2026-12-01', checkOut: '2026-12-05' }))
        .toBe('https://homereserve.ru/feEBPdLdgb?checkIn=2026-12-01&checkOut=2026-12-05');
    });

    it('filters out undefined and empty values', () => {
      expect(rcBookingHref({ checkIn: '2026-12-01', guests: undefined, note: '' }))
        .toBe('https://homereserve.ru/feEBPdLdgb?checkIn=2026-12-01');
    });
  });
});
