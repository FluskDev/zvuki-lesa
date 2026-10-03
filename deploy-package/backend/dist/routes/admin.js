import { Router } from 'express';
import { and, eq, gte, lte, ne, asc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bookings, bookingServices, services, cottages } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { signToken, verifyToken } from '../lib/adminAuth.js';
import { loginSchema, manualBookingSchema, updateBookingSchema, adminListQuerySchema, } from '../lib/validation.js';
import { calculateStayPrice } from '../services/pricing.js';
export const adminRouter = Router();
adminRouter.post('/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    if (parsed.data.password !== process.env.ADMIN_PASSWORD) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Неверный пароль');
    }
    res.json({ success: true, token: signToken() });
});
export function requireAdmin(req, _res, next) {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    next();
}
adminRouter.use(requireAdmin);
adminRouter.get('/bookings', async (req, res) => {
    const parsed = adminListQuerySchema.safeParse(req.query);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
    const q = parsed.data;
    const conditions = [];
    if (q.status && q.status !== 'all')
        conditions.push(eq(bookings.status, q.status));
    if (q.cottageId)
        conditions.push(eq(bookings.cottageId, q.cottageId));
    if (q.from)
        conditions.push(gte(bookings.checkInDate, q.from));
    if (q.to)
        conditions.push(lte(bookings.checkInDate, q.to));
    const rows = await db
        .select({
        id: bookings.id, cottageId: bookings.cottageId, cottageName: cottages.name,
        guestName: bookings.guestName, phone: bookings.phone, email: bookings.email,
        checkInDate: bookings.checkInDate, checkOutDate: bookings.checkOutDate,
        guests: bookings.guests, nights: bookings.nights,
        subtotal: bookings.subtotal, servicesTotal: bookings.servicesTotal,
        totalPrice: bookings.totalPrice, status: bookings.status, source: bookings.source,
        notes: bookings.notes, managerComment: bookings.managerComment, createdAt: bookings.createdAt,
    })
        .from(bookings)
        .innerJoin(cottages, eq(cottages.id, bookings.cottageId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(bookings.checkInDate));
    const ids = rows.map((r) => r.id);
    const servicesByBooking = new Map();
    if (ids.length > 0) {
        const svcRows = await db
            .select({
            bookingId: bookingServices.bookingId,
            name: services.name,
            quantity: bookingServices.quantity,
            priceAtBooking: bookingServices.priceAtBooking,
        })
            .from(bookingServices)
            .innerJoin(services, eq(services.id, bookingServices.serviceId))
            .where(inArray(bookingServices.bookingId, ids));
        for (const s of svcRows) {
            const list = servicesByBooking.get(s.bookingId) ?? [];
            list.push({ name: s.name, quantity: s.quantity, priceAtBooking: s.priceAtBooking });
            servicesByBooking.set(s.bookingId, list);
        }
    }
    const bookingsWithServices = rows.map((r) => ({
        ...r,
        services: servicesByBooking.get(r.id) ?? [],
    }));
    res.json({ success: true, bookings: bookingsWithServices });
});
adminRouter.get('/calendar', async (req, res) => {
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'from/to required as YYYY-MM-DD');
    }
    const rows = await db
        .select({
        bookingId: bookings.id, cottageId: bookings.cottageId,
        guestName: bookings.guestName, status: bookings.status,
        checkInDate: bookings.checkInDate, checkOutDate: bookings.checkOutDate,
    })
        .from(bookings)
        .where(and(ne(bookings.status, 'cancelled'), lte(bookings.checkInDate, to), gte(bookings.checkOutDate, from)))
        .orderBy(asc(bookings.checkInDate));
    res.json({ success: true, occupancy: rows });
});
adminRouter.post('/bookings', async (req, res) => {
    const parsed = manualBookingSchema.safeParse(req.body);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    const data = parsed.data;
    const [cottage] = await db.select().from(cottages).where(eq(cottages.id, data.cottageId)).limit(1);
    if (!cottage)
        throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
    const nights = Math.round((new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime()) / 86_400_000);
    const quote = calculateStayPrice(cottage.basePrice, data.checkInDate, data.checkOutDate, [], data.cottageId);
    const subtotal = quote.subtotal;
    let servicesTotal = 0;
    const serviceRows = [];
    if (data.services?.length) {
        const allServices = await db.select().from(services);
        for (const s of data.services) {
            const srv = allServices.find((x) => x.id === s.serviceId);
            if (!srv)
                throw new ApiError(400, 'VALIDATION_ERROR', `Service ${s.serviceId} not found`);
            servicesTotal += (srv.basePrice ?? 0) * s.quantity;
            serviceRows.push({ serviceId: srv.id, quantity: s.quantity, priceAtBooking: srv.basePrice });
        }
    }
    const totalPrice = data.priceOverride ?? subtotal + servicesTotal;
    const result = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(bookings).values({
            cottageId: data.cottageId, guestName: data.guestName, phone: data.phone,
            email: data.email ?? null, checkInDate: data.checkInDate, checkOutDate: data.checkOutDate,
            guests: data.guests, notes: data.notes ?? null, managerComment: data.managerComment ?? null,
            nights, subtotal, servicesTotal, totalPrice,
            status: 'confirmed', source: 'manual',
        }).returning();
        for (const row of serviceRows) {
            await tx.insert(bookingServices).values({ ...row, bookingId: inserted.id });
        }
        return inserted;
    });
    res.status(201).json({ success: true, booking: result });
});
async function setStatus(id, status, res) {
    const [updated] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
    if (!updated)
        throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
    res.json({ success: true, booking: updated });
}
adminRouter.post('/bookings/:id/confirm', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    await setStatus(id, 'confirmed', res);
});
adminRouter.post('/bookings/:id/cancel', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    await setStatus(id, 'cancelled', res);
});
adminRouter.get('/finance', async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from))
        throw new ApiError(400, 'VALIDATION_ERROR', 'from must be YYYY-MM-DD');
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))
        throw new ApiError(400, 'VALIDATION_ERROR', 'to must be YYYY-MM-DD');
    const dateConditions = [];
    if (from)
        dateConditions.push(gte(bookings.checkInDate, from));
    if (to)
        dateConditions.push(lte(bookings.checkInDate, to));
    const allRows = await db
        .select({
        id: bookings.id,
        cottageId: bookings.cottageId,
        cottageName: cottages.name,
        status: bookings.status,
        source: bookings.source,
        checkInDate: bookings.checkInDate,
        totalPrice: bookings.totalPrice,
        servicesTotal: bookings.servicesTotal,
        nights: bookings.nights,
    })
        .from(bookings)
        .innerJoin(cottages, eq(cottages.id, bookings.cottageId))
        .where(dateConditions.length ? and(...dateConditions) : undefined);
    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);
    const todayIso = todayDate.toISOString().slice(0, 10);
    const activeStatuses = new Set(['new', 'confirmed']);
    let totalBookings = allRows.length;
    let activeBookings = 0;
    let cancelledBookings = 0;
    let upcomingBookings = 0;
    let totalRevenue = 0;
    let totalNights = 0;
    let servicesRevenue = 0;
    const byCottage = new Map();
    const byMonth = new Map();
    for (const r of allRows) {
        const isActive = activeStatuses.has(r.status);
        const isCancelled = r.status === 'cancelled';
        if (isActive)
            activeBookings++;
        if (isCancelled)
            cancelledBookings++;
        if ((r.status === 'confirmed' || r.status === 'new') && r.checkInDate >= todayIso)
            upcomingBookings++;
        if (!isCancelled) {
            totalRevenue += r.totalPrice;
            totalNights += r.nights;
            servicesRevenue += r.servicesTotal;
            const c = byCottage.get(r.cottageId) ?? {
                cottageId: r.cottageId, cottageName: r.cottageName, bookings: 0, nights: 0, revenue: 0,
            };
            c.bookings++;
            c.nights += r.nights;
            c.revenue += r.totalPrice;
            byCottage.set(r.cottageId, c);
            // PG `date` возвращается как строка формата YYYY-MM-DD.
            const month = r.checkInDate.slice(0, 7); // YYYY-MM
            const m = byMonth.get(month) ?? { month, bookings: 0, revenue: 0 };
            m.bookings++;
            m.revenue += r.totalPrice;
            byMonth.set(month, m);
        }
    }
    const averageCheck = activeBookings > 0 ? Math.round(totalRevenue / activeBookings) : 0;
    res.json({
        success: true,
        finance: {
            summary: {
                totalBookings,
                activeBookings,
                cancelledBookings,
                upcomingBookings,
                totalRevenue,
                totalNights,
                servicesRevenue,
                averageCheck,
            },
            byCottage: Array.from(byCottage.values()).sort((a, b) => b.revenue - a.revenue),
            byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
        },
    });
});
adminRouter.patch('/bookings/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    const data = parsed.data;
    const [current] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!current)
        throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
    const checkInDate = data.checkInDate ?? current.checkInDate;
    const checkOutDate = data.checkOutDate ?? current.checkOutDate;
    if (checkOutDate <= checkInDate)
        throw new ApiError(400, 'VALIDATION_ERROR', 'checkOutDate must be after checkInDate');
    const nights = Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86_400_000);
    const patch = {
        checkInDate, checkOutDate, nights,
    };
    if (data.guestName !== undefined)
        patch.guestName = data.guestName;
    if (data.phone !== undefined)
        patch.phone = data.phone;
    if (data.email !== undefined)
        patch.email = data.email;
    if (data.guests !== undefined)
        patch.guests = data.guests;
    if (data.notes !== undefined)
        patch.notes = data.notes;
    if (data.managerComment !== undefined)
        patch.managerComment = data.managerComment;
    if (data.status !== undefined)
        patch.status = data.status;
    if (data.totalPrice !== undefined)
        patch.totalPrice = data.totalPrice;
    const [updated] = await db.update(bookings).set(patch).where(eq(bookings.id, id)).returning();
    res.json({ success: true, booking: updated });
});
