import { Router } from 'express';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bookings, bookingServices, services, cottages } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { createBookingSchema } from '../lib/validation.js';
import { calculateStayPrice } from '../services/pricing.js';
import { isDateRangeAvailable, hasWeekendOrHoliday } from '../services/availability.js';
import { notifyNewBooking } from '../services/notifications.js';
export const bookingsRouter = Router();
bookingsRouter.post('/', async (req, res) => {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    const data = parsed.data;
    const [cottage] = await db.select().from(cottages).where(eq(cottages.id, data.cottageId)).limit(1);
    if (!cottage)
        throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
    if (cottage.guests < data.guests)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Too many guests');
    // Проверка пересечений
    const overlapping = await db.select({
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        status: bookings.status,
    }).from(bookings).where(and(eq(bookings.cottageId, data.cottageId), ne(bookings.status, 'cancelled')));
    if (!isDateRangeAvailable(overlapping, data.checkInDate, data.checkOutDate)) {
        throw new ApiError(409, 'DATES_UNAVAILABLE', 'Эти даты уже заняты');
    }
    // Расчёт цены
    const nights = Math.round((new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime()) / 86_400_000);
    if (hasWeekendOrHoliday(data.checkInDate, data.checkOutDate) && nights < 2) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'В выходные и праздники минимум 2 ночи');
    }
    const quote = calculateStayPrice(cottage.basePrice, data.checkInDate, data.checkOutDate, [], data.cottageId);
    const subtotal = quote.subtotal;
    // Услуги
    let servicesTotal = 0;
    const serviceRows = [];
    if (data.services && data.services.length > 0) {
        const allServices = await db.select().from(services);
        for (const s of data.services) {
            const srv = allServices.find((x) => x.id === s.serviceId);
            if (!srv)
                throw new ApiError(400, 'VALIDATION_ERROR', `Service ${s.serviceId} not found`);
            const price = srv.basePrice ?? 0;
            servicesTotal += price * s.quantity;
            serviceRows.push({
                bookingId: 0,
                serviceId: srv.id,
                name: srv.name,
                quantity: s.quantity,
                priceAtBooking: srv.basePrice,
            });
        }
    }
    const totalPrice = subtotal + servicesTotal;
    // Транзакция
    const result = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(bookings).values({
            cottageId: data.cottageId,
            guestName: data.guestName,
            phone: data.phone,
            email: data.email ?? null,
            checkInDate: data.checkInDate,
            checkOutDate: data.checkOutDate,
            guests: data.guests,
            notes: data.notes ?? null,
            nights,
            subtotal,
            servicesTotal,
            totalPrice,
            source: 'site',
        }).returning();
        for (const row of serviceRows) {
            await tx.insert(bookingServices).values({ ...row, bookingId: inserted.id });
        }
        return inserted;
    });
    console.log(`[BOOKING #${result.id}] New: ${data.guestName} ${data.phone} ${data.checkInDate}→${data.checkOutDate}, ${nights} ноч., ₽${totalPrice}`);
    const serviceLines = serviceRows.map((r) => ({
        name: r.name,
        quantity: r.quantity,
        priceAtBooking: r.priceAtBooking,
    }));
    // Уведомление (notifications table + MAX-рассылка) — после коммита транзакции.
    void notifyNewBooking({
        id: result.id,
        guestName: data.guestName,
        phone: data.phone,
        cottageName: cottage.name,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        nights,
        totalPrice,
        services: serviceLines,
    }).catch((err) => console.error('[notifications] notifyNewBooking failed', err));
    res.status(201).json({
        success: true,
        booking: {
            id: result.id,
            status: result.status,
            nights: result.nights,
            subtotal: result.subtotal,
            servicesTotal: result.servicesTotal,
            totalPrice: result.totalPrice,
            createdAt: result.createdAt,
        },
    });
});
