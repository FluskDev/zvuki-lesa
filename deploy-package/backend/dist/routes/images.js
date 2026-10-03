import { Router } from 'express';
import multer from 'multer';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { imagesRegistry, cottageImages } from '../db/schema.js';
import { imageInputSchema, imagePatchSchema } from '../validation/seo.js';
import { verifyToken } from '../lib/adminAuth.js';
import { ApiError } from '../lib/errors.js';
import { processImage } from '../services/imageProcessor.js';
import path from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});
const PUBLIC_UPLOADS = path.join(process.cwd(), 'public', 'uploads');
function requireAdmin(req, _res, next) {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    next();
}
// Публичный список всех загруженных изображений
router.get('/images', async (_req, res) => {
    const rows = await db
        .select()
        .from(imagesRegistry)
        .orderBy(desc(imagesRegistry.createdAt));
    res.json({ success: true, data: rows });
});
router.post('/admin/images', requireAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Файл не загружен');
    }
    const parsed = imageInputSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.flatten());
    }
    const now = new Date();
    const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const destDir = path.join(PUBLIC_UPLOADS, yyyymm);
    const filenameBase = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await processImage(req.file.buffer, { destDir, filenameBase });
    const publicPath = `/uploads/${yyyymm}/${path.basename(result.path)}`;
    const [row] = await db
        .insert(imagesRegistry)
        .values({
        path: publicPath,
        alt: parsed.data.alt,
        caption: parsed.data.caption ?? null,
        width: result.width,
        height: result.height,
    })
        .returning();
    res.json({ success: true, data: row });
});
router.patch('/admin/images/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    const parsed = imagePatchSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.flatten());
    }
    const [row] = await db
        .update(imagesRegistry)
        .set(parsed.data)
        .where(eq(imagesRegistry.id, id))
        .returning();
    if (!row) {
        throw new ApiError(404, 'NOT_FOUND', 'Image not found');
    }
    res.json({ success: true, data: row });
});
router.delete('/admin/images/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    const [row] = await db
        .select()
        .from(imagesRegistry)
        .where(eq(imagesRegistry.id, id))
        .limit(1);
    if (!row) {
        throw new ApiError(404, 'NOT_FOUND', 'Image not found');
    }
    const fullPath = path.join(process.cwd(), 'public', row.path);
    if (existsSync(fullPath)) {
        try {
            unlinkSync(fullPath);
        }
        catch {
            // ignore — файл мог быть уже удалён вручную
        }
    }
    // Удаляем запись из реестра и заодно все cottage_images-строки, которые на неё
    // ссылаются. Без этого UI домика продолжит показывать битую иконку для удалённого
    // файла (именно так сейчас «поломанные» фото появились на стороне домиков).
    await db.transaction(async (tx) => {
        await tx.delete(cottageImages).where(eq(cottageImages.url, row.path));
        await tx.delete(imagesRegistry).where(eq(imagesRegistry.id, id));
    });
    res.json({ success: true });
});
export default router;
