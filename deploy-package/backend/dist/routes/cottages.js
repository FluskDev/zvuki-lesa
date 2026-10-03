import { Router } from 'express';
import { eq, asc, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cottages, cottageImages, amenities, cottageAmenities, recreationItems, bookings, } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { verifyToken } from '../lib/adminAuth.js';
import { z } from 'zod';
export const SECTIONS = ['main', 'interior', 'kitchen', 'bathroom', 'amenities'];
// PG 23505 — нарушение unique-constraint. Маппим имя индекса в человекочитаемое сообщение.
function mapUniqueViolation(e) {
    // postgres-js кладёт имя индекса в поле `constraint_name`, а не `constraint`.
    const err = e;
    if (err?.code !== '23505')
        return null;
    switch (err.constraint_name) {
        case 'cottages_slug_unique':
            return new ApiError(409, 'CONFLICT', 'Slug already exists — уже занят другим домиком');
        case 'cottages_map_id_unique':
            return new ApiError(409, 'CONFLICT', 'Точка на карте (mapId) уже занята другим домиком');
        default:
            // Любая другая 23505 — это уникальный конфликт, вернём 409 с дефолтным
            // сообщением, чтобы клиент знал, что это конфликт, а не internal error.
            return new ApiError(409, 'CONFLICT', 'Конфликт уникальности');
    }
}
// Порядок секций для сортировки: главное фото всегда идёт первым.
const SECTION_ORDER = {
    main: 0, interior: 1, kitchen: 2, bathroom: 3, amenities: 4,
};
function requireAdmin(req, _res, next) {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    next();
}
export async function loadCottage(cottage) {
    const rows = await db
        .select()
        .from(cottageImages)
        .where(eq(cottageImages.cottageId, cottage.id));
    // Сортируем в JS: сначала по порядку секции (main → interior → ...), потом по position.
    const images = rows.sort((a, b) => {
        const oa = SECTION_ORDER[a.section] ?? 99;
        const ob = SECTION_ORDER[b.section] ?? 99;
        return oa - ob || a.position - b.position;
    });
    const amenityRows = await db
        .select({ id: amenities.id, name: amenities.name, icon: amenities.icon })
        .from(cottageAmenities)
        .innerJoin(amenities, eq(amenities.id, cottageAmenities.amenityId))
        .where(eq(cottageAmenities.cottageId, cottage.id));
    const recreation = await db
        .select()
        .from(recreationItems)
        .where(eq(recreationItems.cottageId, cottage.id))
        .orderBy(asc(recreationItems.position));
    // Первое фото секции main = mainImage для превью.
    const firstMain = images.find((i) => i.section === 'main');
    return {
        id: cottage.id,
        slug: cottage.slug,
        mapId: cottage.mapId,
        name: cottage.name,
        shortDescription: cottage.shortDescription,
        longDescription: cottage.longDescription,
        description: cottage.description ?? '',
        houseRules: cottage.houseRules ?? '',
        basePrice: cottage.basePrice,
        area: cottage.area,
        guests: cottage.guests,
        bedrooms: cottage.bedrooms,
        beds: { double: cottage.bedsDouble, single: cottage.bedsSingle },
        checkInTime: cottage.checkInTime,
        checkOutTime: cottage.checkOutTime,
        mainImage: firstMain?.url ?? cottage.mainImage,
        amenities: amenityRows.map((r) => r.name),
        amenitiesFull: amenityRows,
        gallery: images.map((i) => i.url),
        images: images.map((i) => ({
            id: i.id,
            url: i.url,
            section: i.section,
            position: i.position,
        })),
        recreation,
    };
}
export const cottagesRouter = Router();
cottagesRouter.get('/', async (_req, res) => {
    const all = await db
        .select()
        .from(cottages)
        .where(eq(cottages.isActive, true))
        .orderBy(asc(cottages.id));
    const result = await Promise.all(all.map(loadCottage));
    res.json({ success: true, cottages: result });
});
cottagesRouter.get('/:idOrSlug', async (req, res) => {
    const { idOrSlug } = req.params;
    const condition = /^\d+$/.test(idOrSlug)
        ? eq(cottages.id, Number(idOrSlug))
        : eq(cottages.slug, idOrSlug);
    const [cottage] = await db.select().from(cottages).where(condition).limit(1);
    if (!cottage)
        throw new ApiError(404, 'NOT_FOUND', `Cottage ${idOrSlug} not found`);
    const result = await loadCottage(cottage);
    res.json({ success: true, cottage: result });
});
// ---------- Админ: отдельный роутер, монтируется в server.ts под /api/admin ----------
const cottagePatchSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    shortDescription: z.string().min(1).max(300).optional(),
    longDescription: z.string().min(1).max(2000).optional(),
    description: z.string().max(8000).optional().nullable(),
    houseRules: z.string().max(8000).optional().nullable(),
    basePrice: z.number().int().nonnegative().optional(),
    area: z.number().int().positive().optional(),
    guests: z.number().int().positive().optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    bedsDouble: z.number().int().nonnegative().optional(),
    bedsSingle: z.number().int().nonnegative().optional(),
    checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    mapId: z.string().min(1).max(40).nullable().optional(),
    isActive: z.boolean().optional(),
    amenityIds: z.array(z.number().int().positive()).optional(),
});
const slugRegex = /^[a-z0-9-]+$/;
const cottageCreateSchema = z.object({
    slug: z.string().min(1).max(80).regex(slugRegex),
    mapId: z.string().min(1).max(40).nullable().optional(),
    name: z.string().min(1).max(120),
    shortDescription: z.string().min(1).max(300),
    longDescription: z.string().min(1).max(2000),
    description: z.string().max(8000).optional().nullable(),
    houseRules: z.string().max(8000).optional().nullable(),
    basePrice: z.number().int().nonnegative(),
    area: z.number().int().positive(),
    guests: z.number().int().positive(),
    bedrooms: z.number().int().nonnegative(),
    bedsDouble: z.number().int().nonnegative().default(0),
    bedsSingle: z.number().int().nonnegative().default(0),
    checkInTime: z.string().regex(/^\d{2}:\d{2}$/),
    checkOutTime: z.string().regex(/^\d{2}:\d{2}$/),
    mainImage: z.string().min(1).max(500),
    isActive: z.boolean().default(true),
    amenityIds: z.array(z.number().int().positive()).optional(),
});
export const cottagesAdminRouter = Router();
cottagesAdminRouter.use(requireAdmin);
cottagesAdminRouter.get('/cottages', async (_req, res) => {
    const all = await db.select().from(cottages).orderBy(asc(cottages.id));
    res.json({ success: true, cottages: all });
});
cottagesAdminRouter.get('/amenities', async (_req, res) => {
    const all = await db.select().from(amenities).orderBy(asc(amenities.id));
    res.json({ success: true, amenities: all });
});
cottagesAdminRouter.get('/cottages/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    const [cottage] = await db.select().from(cottages).where(eq(cottages.id, id)).limit(1);
    if (!cottage)
        throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
    res.json({ success: true, cottage: await loadCottage(cottage) });
});
cottagesAdminRouter.patch('/cottages/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    const parsed = cottagePatchSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const { amenityIds, ...patch } = parsed.data;
    if (Object.keys(patch).length > 0) {
        try {
            await db.update(cottages).set(patch).where(eq(cottages.id, id));
        }
        catch (e) {
            const mapped = mapUniqueViolation(e);
            if (mapped)
                throw mapped;
            throw e;
        }
    }
    if (amenityIds !== undefined) {
        await db.delete(cottageAmenities).where(eq(cottageAmenities.cottageId, id));
        if (amenityIds.length > 0) {
            await db
                .insert(cottageAmenities)
                .values(amenityIds.map((amenityId) => ({ cottageId: id, amenityId })));
        }
    }
    const [cottage] = await db.select().from(cottages).where(eq(cottages.id, id)).limit(1);
    if (!cottage)
        throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
    res.json({ success: true, cottage: await loadCottage(cottage) });
});
cottagesAdminRouter.post('/cottages', async (req, res) => {
    const parsed = cottageCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const { amenityIds, ...data } = parsed.data;
    let created;
    try {
        [created] = await db.insert(cottages).values(data).returning();
    }
    catch (e) {
        const mapped = mapUniqueViolation(e);
        if (mapped)
            throw mapped;
        throw e;
    }
    if (amenityIds && amenityIds.length > 0) {
        await db.insert(cottageAmenities).values(amenityIds.map((amenityId) => ({ cottageId: created.id, amenityId })));
    }
    const [cottage] = await db.select().from(cottages).where(eq(cottages.id, created.id)).limit(1);
    res.json({ success: true, cottage: await loadCottage(cottage) });
});
cottagesAdminRouter.delete('/cottages/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    const [existing] = await db.select().from(cottages).where(eq(cottages.id, id)).limit(1);
    if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Cottage not found');
    }
    // Брони (включая отменённые) блокируют удаление — нужны для аудита.
    const hasBookings = (await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.cottageId, id))
        .limit(1)).length > 0;
    if (hasBookings) {
        throw new ApiError(409, 'CONFLICT', 'Невозможно удалить: у домика есть бронирования. Скройте его через isActive=false.');
    }
    try {
        await db.delete(cottages).where(eq(cottages.id, id));
    }
    catch (e) {
        // Safety net: если бронь создали между проверкой и удалением,
        // FK без cascade бросит 23503 — мапим в 409.
        const err = e;
        if (err?.code === '23503') {
            throw new ApiError(409, 'CONFLICT', 'Невозможно удалить: у домика есть бронирования. Скройте его через isActive=false.');
        }
        throw e;
    }
    res.json({ success: true });
});
// ---------- Админ: изображения домика ----------
const imageInputSchema = z.object({
    url: z.string().min(1).max(500),
    section: z.enum(SECTIONS).default('interior'),
    position: z.number().int().nonnegative().optional(),
});
const imagePatchSchema = z.object({
    section: z.enum(SECTIONS).optional(),
    position: z.number().int().nonnegative().optional(),
});
cottagesAdminRouter.post('/cottages/:id/images', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    const parsed = imageInputSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const { url, section } = parsed.data;
    // Автопозиция: следующий индекс внутри секции.
    const sectionRows = await db
        .select({ position: cottageImages.position })
        .from(cottageImages)
        .where(eq(cottageImages.cottageId, id));
    const maxInSection = sectionRows
        .map((r) => r.position)
        .filter((p) => typeof p === 'number')
        .reduce((m, p) => (p > m ? p : m), -1);
    const [row] = await db
        .insert(cottageImages)
        .values({
        cottageId: id,
        url,
        section,
        position: parsed.data.position ?? maxInSection + 1,
    })
        .returning();
    res.json({ success: true, image: row });
});
cottagesAdminRouter.patch('/cottages/:id/images/:imageId', async (req, res) => {
    const id = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!Number.isFinite(id) || !Number.isFinite(imageId)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    const parsed = imagePatchSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const [row] = await db
        .update(cottageImages)
        .set(parsed.data)
        .where(eq(cottageImages.id, imageId))
        .returning();
    if (!row)
        throw new ApiError(404, 'NOT_FOUND', 'Image not found');
    res.json({ success: true, image: row });
});
cottagesAdminRouter.delete('/cottages/:id/images/:imageId', async (req, res) => {
    const imageId = Number(req.params.imageId);
    if (!Number.isFinite(imageId))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    await db.delete(cottageImages).where(eq(cottageImages.id, imageId));
    res.json({ success: true });
});
// Обратная совместимость: переменная, чтобы не падал импорт, если где-то остался.
void desc;
