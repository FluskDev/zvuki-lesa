import { Router } from 'express';
import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bookings } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { calendarQuerySchema } from '../lib/validation.js';
export const calendarRouter = Router();
calendarRouter.get('/:cottageId', async (req, res) => {
    const { cottageId } = req.params;
    const parsed = calendarQuerySchema.safeParse(req.query);
    if (!parsed.success)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
    const { from, to } = parsed.data;
    const id = Number(cottageId);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cottageId');
    const rows = await db.select({
        startDate: bookings.checkInDate,
        endDate: bookings.checkOutDate,
    })
        .from(bookings)
        .where(and(eq(bookings.cottageId, id), ne(bookings.status, 'cancelled'), lte(bookings.checkInDate, to), gte(bookings.checkOutDate, from)));
    res.json({ success: true, bookedDates: rows });
});
