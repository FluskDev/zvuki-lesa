import { Router } from 'express';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { blogPosts } from '../db/schema.js';
import { blogPostInputSchema, blogPostPatchSchema } from '../validation/seo.js';
import { verifyToken } from '../lib/adminAuth.js';
import { ApiError } from '../lib/errors.js';
export const blogPostsRouter = Router();
const PAGE_SIZE = 12;
function requireAdmin(req, _res, next) {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    next();
}
// Публичные: список с пагинацией и фильтром по категории
blogPostsRouter.get('/blog', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const where = category
        ? and(eq(blogPosts.isPublished, true), eq(blogPosts.category, category))
        : eq(blogPosts.isPublished, true);
    const [items, totalRows] = await Promise.all([
        db
            .select({
            id: blogPosts.id,
            slug: blogPosts.slug,
            title: blogPosts.title,
            excerpt: blogPosts.excerpt,
            coverImage: blogPosts.coverImage,
            category: blogPosts.category,
            readingTimeMin: blogPosts.readingTimeMin,
            publishedAt: blogPosts.publishedAt,
        })
            .from(blogPosts)
            .where(where)
            .orderBy(desc(blogPosts.publishedAt))
            .limit(PAGE_SIZE)
            .offset((page - 1) * PAGE_SIZE),
        db.select({ total: count() }).from(blogPosts).where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;
    res.json({ success: true, data: { items, total, page, pageSize: PAGE_SIZE } });
});
blogPostsRouter.get('/blog/:slug', async (req, res) => {
    const [row] = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.slug, req.params.slug))
        .limit(1);
    if (!row || !row.isPublished) {
        throw new ApiError(404, 'NOT_FOUND', 'Post not found');
    }
    res.json({ success: true, post: row });
});
// Админ: полный CRUD
blogPostsRouter.get('/admin/blog-posts', requireAdmin, async (_req, res) => {
    const rows = await db
        .select()
        .from(blogPosts)
        .orderBy(desc(blogPosts.updatedAt));
    res.json({ success: true, data: rows });
});
blogPostsRouter.post('/admin/blog-posts', requireAdmin, async (req, res) => {
    const parsed = blogPostInputSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const data = parsed.data;
    const values = {
        ...data,
        publishedAt: data.publishedAt instanceof Date ? data.publishedAt : data.publishedAt ? new Date(data.publishedAt) : null,
    };
    try {
        const [row] = await db.insert(blogPosts).values(values).returning();
        res.json({ success: true, data: row });
    }
    catch (e) {
        if (e?.code === '23505') {
            throw new ApiError(409, 'CONFLICT', 'Slug already exists');
        }
        throw e;
    }
});
blogPostsRouter.patch('/admin/blog-posts/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    const parsed = blogPostPatchSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid body', parsed.error.flatten());
    }
    const data = parsed.data;
    const patch = {
        ...data,
        publishedAt: data.publishedAt instanceof Date
            ? data.publishedAt
            : data.publishedAt
                ? new Date(data.publishedAt)
                : undefined,
        updatedAt: new Date(),
    };
    const [row] = await db
        .update(blogPosts)
        .set(patch)
        .where(eq(blogPosts.id, id))
        .returning();
    if (!row) {
        throw new ApiError(404, 'NOT_FOUND', 'Post not found');
    }
    res.json({ success: true, data: row });
});
blogPostsRouter.delete('/admin/blog-posts/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid id');
    }
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    res.json({ success: true });
});
