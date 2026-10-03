import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { siteMapElements } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { verifyToken } from '../lib/adminAuth.js';
const VALID_MAP_IDS = ['Парковка', 'Лес1', 'Лес2', 'чан'];
function isValidMapId(mapId) {
    return VALID_MAP_IDS.includes(mapId);
}
function requireAdmin(req, _res, next) {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    next();
}
// ============ P U B L I C ============
// Возвращает данные для SiteMap: title, photoUrl, hasButton для каждого
// mapId из дефолтного набора (Парковка / Лес1 / Лес2 / чан).
// Если в БД нет строки для какого-то id — в ответе вместо неё приходит
// null, чтобы фронт мог использовать дефолтный fallback.
export const siteElementsRouter = Router();
siteElementsRouter.get('/site-elements', async (_req, res) => {
    const rows = await db
        .select()
        .from(siteMapElements)
        .orderBy(asc(siteMapElements.mapId));
    // Индексируем по mapId, чтобы на фронте можно было сделать O(1) lookup.
    const byId = {};
    for (const id of VALID_MAP_IDS)
        byId[id] = null;
    for (const row of rows)
        if (isValidMapId(row.mapId))
            byId[row.mapId] = row;
    res.json({ success: true, data: byId });
});
// ============ A D M I N ============
const siteElementPatchSchema = z.object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    photoUrl: z.string().min(1).max(500).nullable().optional(),
    hasButton: z.boolean().optional(),
}).strict();
export const siteElementsAdminRouter = Router();
siteElementsAdminRouter.patch('/site-elements/:mapId', requireAdmin, async (req, res) => {
    const mapId = String(req.params.mapId);
    if (!isValidMapId(mapId)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `mapId должен быть одним из: ${VALID_MAP_IDS.join(', ')}`);
    }
    const parsed = siteElementPatchSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.flatten());
    }
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Пустой patch');
    }
    // Явно прокидываем updatedAt — фронт может увидеть свежую дату после правки.
    const [row] = await db
        .update(siteMapElements)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(siteMapElements.mapId, mapId))
        .returning();
    if (!row) {
        // Строки нет — такое возможно, если сид не отработал. Создаём её на лету.
        const seedDefaults = {
            'Парковка': { title: 'Парковка', description: '' },
            'Лес1': { title: 'Лес', description: '' },
            'Лес2': { title: 'Лес', description: '' },
            'чан': { title: 'Чан', description: '' },
        };
        const def = seedDefaults[mapId];
        const [inserted] = await db
            .insert(siteMapElements)
            .values({
            mapId,
            title: patch.title ?? def.title,
            description: patch.description ?? def.description,
            photoUrl: patch.photoUrl ?? null,
            hasButton: patch.hasButton ?? false,
            updatedAt: new Date(),
        })
            .returning();
        res.json({ success: true, data: inserted });
        return;
    }
    res.json({ success: true, data: row });
});
