import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { seoPages } from '../db/schema.js';
import { seoPageInputSchema, seoPagePatchSchema } from '../validation/seo.js';
import { verifyToken } from '../lib/adminAuth.js';
import { ApiError } from '../lib/errors.js';
export const seoPagesRouter = Router();
function requireAdmin(req, _res, next) {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    next();
}
// Публичные: только опубликованные страницы
seoPagesRouter.get('/seo', async (_req, res) => {
    const rows = await db
        .select({
        id: seoPages.id,
        slug: seoPages.slug,
        title: seoPages.title,
        description: seoPages.description,
        h1: seoPages.h1,
        metaImage: seoPages.metaImage,
        intent: seoPages.intent,
        priority: seoPages.priority,
    })
        .from(seoPages)
        .where(eq(seoPages.isPublished, true))
        .orderBy(desc(seoPages.priority));
    res.json({ success: true, pages: rows });
});
seoPagesRouter.get('/seo/:slug', async (req, res) => {
    const [row] = await db
        .select()
        .from(seoPages)
        .where(eq(seoPages.slug, req.params.slug))
        .limit(1);
    if (!row || !row.isPublished) {
        throw new ApiError(404, 'NOT_FOUND', 'Page not found');
    }
    res.json({ success: true, page: row });
});
// Админ: полный CRUD
seoPagesRouter.get('/admin/seo-pages', requireAdmin, async (_req, res) => {
    const rows = await db
        .select()
        .from(seoPages)
        .orderBy(desc(seoPages.updatedAt));
    res.json({ success: true, pages: rows });
});
seoPagesRouter.post('/admin/seo-pages', requireAdmin, async (req, res) => {
    const parsed = seoPageInputSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    try {
        const [row] = await db.insert(seoPages).values(parsed.data).returning();
        res.json({ success: true, page: row });
    }
    catch (e) {
        if (e?.code === '23505') {
            throw new ApiError(409, 'CONFLICT', 'Slug already exists');
        }
        throw e;
    }
});
seoPagesRouter.patch('/admin/seo-pages/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    const parsed = seoPagePatchSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const data = parsed.data;
    const patch = { ...data, updatedAt: new Date() };
    const [row] = await db
        .update(seoPages)
        .set(patch)
        .where(eq(seoPages.id, id))
        .returning();
    if (!row) {
        throw new ApiError(404, 'NOT_FOUND', 'Page not found');
    }
    res.json({ success: true, page: row });
});
seoPagesRouter.delete('/admin/seo-pages/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    await db.delete(seoPages).where(eq(seoPages.id, id));
    res.json({ success: true });
});
