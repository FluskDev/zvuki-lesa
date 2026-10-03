import { Router } from 'express';
import { eq, desc, avg, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { reviews } from '../db/schema.js';
import { reviewInputSchema, reviewPatchSchema } from '../validation/seo.js';
import { verifyToken } from '../lib/adminAuth.js';
import { ApiError } from '../lib/errors.js';
import { syncYandexReviews } from '../services/yandexReviews.js';
export const reviewsRouter = Router();
function requireAdmin(req, _res, next) {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    next();
}
// Публичный: только опубликованные отзывы + агрегаты.
// yandexReviewsUrl — fallback для кнопки «Открыть на Яндексе» в публичной секции,
// если у конкретного отзыва нет authorUrl.
reviewsRouter.get('/reviews', async (_req, res) => {
    const rows = await db
        .select()
        .from(reviews)
        .where(eq(reviews.isPublished, true))
        .orderBy(desc(reviews.date));
    const agg = await db
        .select({ avg: avg(reviews.rating), total: count() })
        .from(reviews)
        .where(eq(reviews.isPublished, true));
    const averageRating = agg[0]?.avg ? Number(agg[0].avg) : 0;
    const total = Number(agg[0]?.total ?? 0);
    const businessUrl = process.env.YANDEX_MAPS_URL;
    const yandexReviewsUrl = businessUrl
        ? businessUrl.replace(/\/?$/, '') + (/\/reviews\/?$/.test(businessUrl) ? '' : '/reviews/')
        : null;
    res.json({ success: true, data: { items: rows, averageRating, total, yandexReviewsUrl } });
});
// Админ: все отзывы (включая неопубликованные)
reviewsRouter.get('/admin/reviews', requireAdmin, async (_req, res) => {
    const rows = await db.select().from(reviews).orderBy(desc(reviews.date));
    res.json({ success: true, data: rows });
});
reviewsRouter.post('/admin/reviews', requireAdmin, async (req, res) => {
    const parsed = reviewInputSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const data = parsed.data;
    const values = {
        ...data,
        date: data.date instanceof Date
            ? data.date
            : data.date
                ? new Date(data.date)
                : new Date(),
    };
    const [row] = await db.insert(reviews).values(values).returning();
    res.json({ success: true, data: row });
});
reviewsRouter.patch('/admin/reviews/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    const parsed = reviewPatchSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const data = parsed.data;
    const { date, ...rest } = data;
    const patch = { ...rest };
    if (date !== undefined) {
        patch.date = date instanceof Date ? date : new Date(date);
    }
    const [row] = await db
        .update(reviews)
        .set(patch)
        .where(eq(reviews.id, id))
        .returning();
    if (!row) {
        throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }
    res.json({ success: true, data: row });
});
reviewsRouter.delete('/admin/reviews/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    await db.delete(reviews).where(eq(reviews.id, id));
    res.json({ success: true });
});
// Админ: ручной запуск парсинга отзывов с Яндекс.Карт.
// Тяжёлый запрос — 10–60 секунд (запуск Puppeteer, рендер SPA).
const syncYandexBodySchema = z.object({
    limit: z.number().int().positive().max(500).optional(),
    dryRun: z.boolean().optional(),
});
reviewsRouter.post('/admin/reviews/sync-yandex', requireAdmin, async (req, res) => {
    const parsed = syncYandexBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const result = await syncYandexReviews(parsed.data);
    res.json({ success: true, data: result });
});
export default reviewsRouter;
