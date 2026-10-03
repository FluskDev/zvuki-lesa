import { Router } from 'express';
import { and, eq, lte, gte, ne } from 'drizzle-orm';
import { addDays, parseISO, format } from 'date-fns';
import { db } from '../db/client.js';
import { cottages, bookings, priceRules } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { availabilityQuerySchema } from '../lib/validation.js';
import { isDateRangeAvailable, hasWeekendOrHoliday } from '../services/availability.js';
import { calculateStayPrice } from '../services/pricing.js';
export const availabilityRouter = Router();
async function quoteForCottage(cottageId, checkIn, checkOut, guests) {
    const [cottage] = await db.select().from(cottages).where(eq(cottages.id, cottageId)).limit(1);
    if (!cottage)
        return null;
    if (cottage.guests < guests)
        return null;
    const rules = await db.select().from(priceRules);
    const overlappingBookings = await db.select({
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        status: bookings.status,
    })
        .from(bookings)
        .where(and(eq(bookings.cottageId, cottageId), ne(bookings.status, 'cancelled'), lte(bookings.checkInDate, checkOut), gte(bookings.checkOutDate, checkIn)));
    const available = isDateRangeAvailable(overlappingBookings, checkIn, checkOut);
    const quote = calculateStayPrice(cottage.basePrice, checkIn, checkOut, rules, cottageId);
    const nights = quote.perNight.length;
    const weekend = hasWeekendOrHoliday(checkIn, checkOut);
    const minNightsOk = !(weekend && nights < 2);
    return {
        cottageId: cottage.id,
        name: cottage.name,
        mainImage: cottage.mainImage,
        guests: cottage.guests,
        available,
        subtotal: quote.subtotal,
        nights,
        minNightsOk,
        warning: minNightsOk ? null : 'В выходные и праздничные дни минимальное бронирование — от 2 суток',
    };
}
availabilityRouter.get('/availability', async (req, res) => {
    const parsed = availabilityQuerySchema.safeParse(req.query);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
    const { checkIn, checkOut, guests = 1 } = parsed.data;
    const all = await db.select().from(cottages).where(eq(cottages.isActive, true));
    const results = (await Promise.all(all.map((c) => quoteForCottage(c.id, checkIn, checkOut, guests))))
        .filter((r) => r !== null && r.available);
    res.json({
        success: true,
        checkIn,
        checkOut,
        nights: results[0]?.nights ?? 0,
        results,
    });
});
availabilityRouter.get('/cottages/:id/availability', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cottageId');
    const parsed = availabilityQuerySchema.safeParse(req.query);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
    const { checkIn, checkOut, guests = 1 } = parsed.data;
    const result = await quoteForCottage(id, checkIn, checkOut, guests);
    if (!result)
        throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
    const rules = await db.select().from(priceRules);
    const quote = calculateStayPrice((await db.select().from(cottages).where(eq(cottages.id, id)).limit(1))[0].basePrice, checkIn, checkOut, rules, id);
    res.json({
        success: true,
        available: result.available,
        nights: result.nights,
        guests,
        price: {
            perNight: quote.perNight,
            subtotal: quote.subtotal,
            minNightsOk: result.minNightsOk,
            warning: result.warning,
        },
    });
});
// Цены по дням для календаря (без проверки доступности, без гостей)
availabilityRouter.get('/cottages/:id/calendar-prices', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cottageId');
    const from = String(req.query.from ?? '');
    const days = Number(req.query.days ?? '0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(days) || days < 1 || days > 180) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid from/days');
    }
    const [cottage] = await db.select().from(cottages).where(eq(cottages.id, id)).limit(1);
    if (!cottage)
        throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
    const checkInISO = from;
    const checkOutISO = format(addDays(parseISO(from), days), 'yyyy-MM-dd');
    const rules = await db.select().from(priceRules);
    const quote = calculateStayPrice(cottage.basePrice, checkInISO, checkOutISO, rules, id);
    res.json({
        success: true,
        cottageId: cottage.id,
        basePrice: cottage.basePrice,
        prices: quote.perNight,
    });
});
// Агрегированные цены по дням — минимум по всем активным домикам.
// Используется на главной странице (StickyFooter), где конкретный домик не выбран.
availabilityRouter.get('/calendar-prices', async (req, res) => {
    const from = String(req.query.from ?? '');
    const days = Number(req.query.days ?? '0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(days) || days < 1 || days > 180) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid from/days');
    }
    const checkInISO = from;
    const checkOutISO = format(addDays(parseISO(from), days), 'yyyy-MM-dd');
    const activeCottages = await db.select().from(cottages).where(eq(cottages.isActive, true));
    if (activeCottages.length === 0) {
        res.json({ success: true, prices: [] });
        return;
    }
    const rules = await db.select().from(priceRules);
    const perCottage = activeCottages.map((c) => calculateStayPrice(c.basePrice, checkInISO, checkOutISO, rules, c.id).perNight);
    const byDate = new Map();
    for (const perNight of perCottage) {
        for (const p of perNight) {
            const list = byDate.get(p.date) ?? [];
            list.push({ final: p.final, hasRule: p.rule !== null });
            byDate.set(p.date, list);
        }
    }
    const prices = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => {
        const min = values.reduce((acc, v) => Math.min(acc, v.final), Infinity);
        const max = values.reduce((acc, v) => Math.max(acc, v.final), -Infinity);
        const hasRule = values.some((v) => v.hasRule);
        return { date, min, max, hasRule };
    });
    res.json({ success: true, prices });
});
