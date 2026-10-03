import { z } from 'zod';
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
export const createBookingSchema = z.object({
    cottageId: z.number().int().positive(),
    guestName: z.string().min(1).max(200),
    phone: z.string().min(5).max(50),
    email: z.string().email().optional(),
    checkInDate: isoDate,
    checkOutDate: isoDate,
    guests: z.number().int().min(1).max(50),
    notes: z.string().max(2000).optional(),
    services: z.array(z.object({
        serviceId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
    })).optional(),
}).refine((d) => d.checkOutDate > d.checkInDate, {
    message: 'checkOutDate must be after checkInDate',
    path: ['checkOutDate'],
});
export const availabilityQuerySchema = z.object({
    checkIn: isoDate,
    checkOut: isoDate,
    guests: z.coerce.number().int().min(1).max(50).optional(),
}).refine((d) => d.checkOut > d.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
});
export const calendarQuerySchema = z.object({
    from: isoDate,
    to: isoDate,
});
export const loginSchema = z.object({
    password: z.string().min(1),
});
export const manualBookingSchema = z.object({
    cottageId: z.number().int().positive(),
    guestName: z.string().min(1).max(200),
    phone: z.string().min(1).max(50),
    email: z.string().email().optional(),
    checkInDate: isoDate,
    checkOutDate: isoDate,
    guests: z.number().int().min(1).max(50),
    notes: z.string().max(2000).optional(),
    managerComment: z.string().max(2000).optional(),
    priceOverride: z.number().int().min(0).optional(),
    services: z.array(z.object({
        serviceId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
    })).optional(),
}).refine((d) => d.checkOutDate > d.checkInDate, {
    message: 'checkOutDate must be after checkInDate',
    path: ['checkOutDate'],
});
export const updateBookingSchema = z.object({
    guestName: z.string().min(1).max(200).optional(),
    phone: z.string().min(1).max(50).optional(),
    email: z.string().email().nullable().optional(),
    checkInDate: isoDate.optional(),
    checkOutDate: isoDate.optional(),
    guests: z.number().int().min(1).max(50).optional(),
    notes: z.string().max(2000).nullable().optional(),
    managerComment: z.string().max(2000).nullable().optional(),
    totalPrice: z.number().int().min(0).optional(),
    status: z.enum(['new', 'confirmed', 'cancelled']).optional(),
});
export const adminListQuerySchema = z.object({
    status: z.enum(['new', 'confirmed', 'cancelled', 'all']).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    cottageId: z.coerce.number().int().positive().optional(),
});
