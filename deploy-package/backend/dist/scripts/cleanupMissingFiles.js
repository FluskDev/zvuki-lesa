/**
 * Одноразовая чистка: удаляет cottage_images и images_registry записи,
 * которые ссылаются на файлы, отсутствующие на диске.
 *
 * Зачем: при удалении фото через /api/admin/images раньше стирался и файл,
 * и registry row, но строки cottage_images оставались. Из-за этого в
 * админке домика показывались «битые» иконки для картинок, которых физически
 * уже не было.
 *
 * Начиная с этого момента, DELETE в routes/images.ts удаляет и связанные
 * cottage_images-строки в одной транзакции. Этот скрипт нужен только для того,
 * чтобы вычистить последствия прошлых удалений.
 *
 * Запуск: cd backend && npx tsx --env-file=.env src/scripts/cleanupMissingFiles.ts
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cottageImages, imagesRegistry } from '../db/schema.js';
async function main() {
    const publicDir = path.join(process.cwd(), 'public');
    // cottage_images
    const cottageRows = await db.select().from(cottageImages);
    let cotDeleted = 0;
    for (const r of cottageRows) {
        const full = path.join(publicDir, r.url);
        if (!existsSync(full)) {
            console.log(`[cottage_images] missing file, dropping row id=${r.id} (${r.url})`);
            await db.delete(cottageImages).where(eq(cottageImages.id, r.id));
            cotDeleted++;
        }
    }
    // images_registry
    const regRows = await db.select().from(imagesRegistry);
    let regDeleted = 0;
    for (const r of regRows) {
        const full = path.join(publicDir, r.path);
        if (!existsSync(full)) {
            console.log(`[images_registry] missing file, dropping id=${r.id} (${r.path})`);
            await db.delete(imagesRegistry).where(eq(imagesRegistry.id, r.id));
            regDeleted++;
        }
    }
    console.log(`\nDone. cottage_images removed: ${cotDeleted}, images_registry removed: ${regDeleted}`);
    process.exit(0);
}
main().catch((err) => {
    console.error('[cleanup] failed:', err);
    process.exit(1);
});
