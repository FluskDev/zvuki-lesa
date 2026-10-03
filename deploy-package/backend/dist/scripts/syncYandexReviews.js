/**
 * Точка входа для cron/systemd timer.
 *
 *   cd backend && npm run sync:reviews
 *
 * Парсит отзывы с Яндекс.Карт (URL берётся из YANDEX_MAPS_URL) и пишет в БД
 * с дедупликацией по (source, external_id). Идемпотентен.
 *
 * Exit codes:
 *   0 — синхронизация прошла (включая случай «отзывов не было»)
 *   1 — критическая ошибка (нет URL, нет сети, БД недоступна)
 */
import { syncYandexReviews } from '../services/yandexReviews.js';
async function main() {
    const url = process.env.YANDEX_MAPS_URL;
    if (!url) {
        console.error('[sync:reviews] YANDEX_MAPS_URL is not set. Add it to backend/.env');
        process.exit(1);
    }
    console.log(`[sync:reviews] start, url=${url}`);
    let result;
    try {
        result = await syncYandexReviews();
    }
    catch (err) {
        console.error('[sync:reviews] FATAL', err);
        process.exit(1);
    }
    console.log(`[sync:reviews] done in ${result.durationMs}ms: ` +
        `fetched=${result.fetched} inserted=${result.inserted} ` +
        `updated=${result.updated} unchanged=${result.unchanged}`);
    if (result.errors.length > 0) {
        console.error('[sync:reviews] errors:', result.errors);
        process.exit(1);
    }
    process.exit(0);
}
main();
