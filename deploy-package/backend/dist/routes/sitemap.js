import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { seoPages, blogPosts, cottages } from '../db/schema.js';
const router = Router();
const BASE = 'https://zvukilesa.ru';
function xmlEscape(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function urlEntry(loc, priority, changefreq, lastmod) {
    const safeLoc = xmlEscape(loc);
    const lastmodStr = lastmod instanceof Date ? lastmod.toISOString() : lastmod;
    const lastmodTag = lastmodStr ? `<lastmod>${lastmodStr.slice(0, 10)}</lastmod>` : '';
    return `<url><loc>${BASE}${safeLoc}</loc>${lastmodTag}<changefreq>${changefreq}</changefreq><priority>${priority.toFixed(1)}</priority></url>`;
}
router.get('/sitemap.xml', async (_req, res) => {
    const [seo, blog, cab] = await Promise.all([
        db.select({
            slug: seoPages.slug,
            priority: seoPages.priority,
            updatedAt: seoPages.updatedAt,
        }).from(seoPages).where(eq(seoPages.isPublished, true)).orderBy(desc(seoPages.priority)),
        db.select({
            slug: blogPosts.slug,
            publishedAt: blogPosts.publishedAt,
            updatedAt: blogPosts.updatedAt,
        }).from(blogPosts).where(eq(blogPosts.isPublished, true)).orderBy(desc(blogPosts.publishedAt)),
        db.select({ slug: cottages.slug }).from(cottages).where(eq(cottages.isActive, true)),
    ]);
    const staticUrls = [
        urlEntry('/', 1.0, 'weekly'),
        urlEntry('/blog', 0.8, 'weekly'),
        urlEntry('/search', 0.6, 'monthly'),
    ];
    const cabUrls = cab.map((c) => urlEntry(`/booking/${c.slug}`, 0.9, 'daily'));
    const seoUrls = seo.map((s) => urlEntry(`/seo/${s.slug}`, s.priority, 'monthly', s.updatedAt));
    const blogUrls = blog.map((b) => urlEntry(`/blog/${b.slug}`, 0.7, 'monthly', b.publishedAt ?? b.updatedAt));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...cabUrls, ...seoUrls, ...blogUrls].join('\n')}\n</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
});
export default router;
