/**
 * Скрипт загрузки SEO/blog-черновиков из data/seo-drafts/ в БД.
 * Запуск: `npm run seed:drafts` (из backend/).
 * Заливает черновики с isPublished=false — владелец публикует через /admin.
 */
import { db } from '../db/client.js';
import { seoPages, blogPosts } from '../db/schema.js';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const SEO_DIR = path.resolve(process.cwd(), 'data', 'seo-drafts', 'seo');
const BLOG_DIR = path.resolve(process.cwd(), 'data', 'seo-drafts', 'blog');
async function loadSeo() {
    const stats = { inserted: 0, skipped: 0, errors: 0 };
    let files;
    try {
        files = readdirSync(SEO_DIR).filter((f) => f.endsWith('.json')).sort();
    }
    catch {
        console.warn(`[seed-drafts] SEO-папка не найдена: ${SEO_DIR}`);
        return stats;
    }
    for (const f of files) {
        const raw = readFileSync(path.join(SEO_DIR, f), 'utf-8');
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch (e) {
            console.error(`[seed-drafts] ! ${f}: невалидный JSON`);
            stats.errors++;
            continue;
        }
        try {
            await db.insert(seoPages).values({
                slug: data.slug,
                title: data.title,
                description: data.description,
                h1: data.h1,
                body: data.body,
                metaImage: data.metaImage ?? null,
                intent: data.intent,
                schemaJson: data.schemaJson,
                isPublished: false,
                priority: typeof data.priority === 'number' ? data.priority : 0.7,
            });
            console.log(`[seed-drafts] + seo/${data.slug}`);
            stats.inserted++;
        }
        catch (e) {
            if (e?.code === '23505') {
                console.log(`[seed-drafts] ~ seo/${data.slug} (already exists)`);
                stats.skipped++;
            }
            else {
                console.error(`[seed-drafts] ! seo/${data.slug}:`, e?.message ?? e);
                stats.errors++;
            }
        }
    }
    return stats;
}
async function loadBlog() {
    const stats = { inserted: 0, skipped: 0, errors: 0 };
    let files;
    try {
        files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.json')).sort();
    }
    catch {
        console.warn(`[seed-drafts] BLOG-папка не найдена: ${BLOG_DIR}`);
        return stats;
    }
    for (const f of files) {
        const raw = readFileSync(path.join(BLOG_DIR, f), 'utf-8');
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch (e) {
            console.error(`[seed-drafts] ! ${f}: невалидный JSON`);
            stats.errors++;
            continue;
        }
        try {
            await db.insert(blogPosts).values({
                slug: data.slug,
                title: data.title,
                excerpt: data.excerpt,
                body: data.body,
                coverImage: data.coverImage ?? null,
                author: data.author ?? 'Команда Звуки Леса',
                category: data.category,
                readingTimeMin: typeof data.readingTimeMin === 'number' ? data.readingTimeMin : 5,
                schemaJson: data.schemaJson,
                isPublished: false,
                publishedAt: data.publishedAt ?? null,
            });
            console.log(`[seed-drafts] + blog/${data.slug}`);
            stats.inserted++;
        }
        catch (e) {
            if (e?.code === '23505') {
                console.log(`[seed-drafts] ~ blog/${data.slug} (already exists)`);
                stats.skipped++;
            }
            else {
                console.error(`[seed-drafts] ! blog/${data.slug}:`, e?.message ?? e);
                stats.errors++;
            }
        }
    }
    return stats;
}
async function main() {
    const seo = await loadSeo();
    const blog = await loadBlog();
    const total = {
        inserted: seo.inserted + blog.inserted,
        skipped: seo.skipped + blog.skipped,
        errors: seo.errors + blog.errors,
    };
    console.log(`\n[seed-drafts] Итог: +${total.inserted} вставлено, ~${total.skipped} пропущено, !${total.errors} ошибок`);
    console.log('[seed-drafts] Владелец публикует через /admin');
    if (total.errors > 0)
        process.exit(1);
    process.exit(0);
}
main().catch((e) => {
    console.error('[seed-drafts] Критическая ошибка:', e);
    process.exit(1);
});
