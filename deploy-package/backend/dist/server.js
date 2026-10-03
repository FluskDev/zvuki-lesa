import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { cottagesRouter, cottagesAdminRouter } from './routes/cottages.js';
import { servicesRouter } from './routes/services.js';
import { calendarRouter } from './routes/calendar.js';
import { availabilityRouter } from './routes/availability.js';
import { bookingsRouter } from './routes/bookings.js';
import { adminRouter } from './routes/admin.js';
import { analyticsRouter, adminAnalyticsRouter } from './routes/analytics.js';
import { seoPagesRouter } from './routes/seoPages.js';
import { blogPostsRouter } from './routes/blogPosts.js';
import imagesRouter from './routes/images.js';
import sitemapRouter from './routes/sitemap.js';
import reviewsRouter from './routes/reviews.js';
import { siteElementsRouter, siteElementsAdminRouter } from './routes/siteElements.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { startMaxPolling, stopMaxPolling } from './services/maxPoller.js';
import { ensureSiteElements } from './services/ensureSiteElements.js';
const app = express();
app.use(cors());
app.use(express.json());
// ─── Конфиг раздачи фронтенда ─────────────────────────────────────────
// На проде (Windows-сервер) фронт лежит рядом с api/: E:\ZvukiLesa\public.
// На линуксе тоже работает: ../public относительно cwd api/.
// Если папка недоступна (dev без пререндера) — статика фронта просто
// не подключается, роуты /api/* продолжают работать.
const FRONTEND_PUBLIC = process.env.FRONTEND_PUBLIC_PATH
    ?? path.join(process.cwd(), '..', 'public');
const hasFrontendStatic = fs.existsSync(FRONTEND_PUBLIC);
// Раздача статики из backend/public: /uploads/*, /Galary/* и т. п.
app.use(express.static(path.join(process.cwd(), 'public')));
app.get('/api/health', (_req, res) => {
    res.json({ success: true, timestamp: new Date().toISOString() });
});
app.use('/api/cottages', cottagesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api', availabilityRouter); // /api/availability + /api/cottages/:id/availability
app.use('/api/bookings', bookingsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminAnalyticsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', cottagesAdminRouter);
app.use('/api', seoPagesRouter);
app.use('/api', blogPostsRouter);
app.use('/api', imagesRouter);
app.use('/api', reviewsRouter);
app.use('/api', siteElementsRouter);
app.use('/api/admin', siteElementsAdminRouter);
app.use('/', sitemapRouter);
// ─── Фронтенд (пререндер из dist/) ────────────────────────────────────
// Подключаем ПОСЛЕ sitemapRouter, чтобы динамический /sitemap.xml
// (70 URL из всех таблиц) выигрывал у статического fallback (5 якорей).
if (hasFrontendStatic) {
    app.use(express.static(FRONTEND_PUBLIC));
}
// SPA-fallback для клиентских маршрутов, которые не пререндерены
// (/admin, /admin/login, /admin/seo-pages/new и т.п.).
// Не трогает /api/*, /sitemap.xml, файлы с расширением.
if (hasFrontendStatic) {
    app.get(/^(?!\/api\/|.*\.[a-z0-9]+$).*/, (_req, res, next) => {
        const indexPath = path.join(FRONTEND_PUBLIC, 'index.html');
        if (fs.existsSync(indexPath))
            return res.sendFile(indexPath);
        next();
    });
}
app.use(notFoundHandler);
app.use(errorHandler);
const PORT = Number(process.env.PORT) || 3001;
// Сидинг дефолтных site_map_elements ДО старта слушателя, чтобы первый
// запрос GET /api/site-elements сразу возвращал 4 строки, а не пустой массив.
ensureSiteElements().finally(() => {
    app.listen(PORT, () => {
        console.log(`[server] listening on http://localhost:${PORT}`);
        startMaxPolling();
    });
});
process.on('SIGTERM', () => {
    stopMaxPolling();
    process.exit(0);
});
process.on('SIGINT', () => {
    stopMaxPolling();
    process.exit(0);
});
