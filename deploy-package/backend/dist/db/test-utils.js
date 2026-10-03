import { sql } from 'drizzle-orm';
/**
 * Сбрасывает все «контентные» таблицы тестовой БД.
 * Используется в `beforeEach` каждого теста для изоляции.
 */
export async function resetDb(db) {
    await db.execute(sql `TRUNCATE TABLE
    booking_services, bookings, notifications, price_rules, services,
    recreation_items, cottage_amenities, amenities, cottage_images, cottages,
    seo_pages, blog_posts, images_registry, reviews, max_subscribers, analytics_events
    RESTART IDENTITY CASCADE`);
}
