/**
 * Скачивание и хранение аватарок отзывов.
 *
 * Бэкенд уже раздаёт /uploads/* из process.cwd()/public/.
 * Этот сервис кладёт аватарки туда же: /uploads/reviews/avatars/<sha256(url)>.webp.
 *
 * Идемпотентность: имя файла = sha256 от исходного URL.
 * Повторные синки находят файл и не качают заново.
 *
 * Отказоустойчивость: ошибки сети / не-картинка / таймаут возвращают null
 * (без аватара UI отрисует инициалы), не роняя весь sync.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { processImage } from './imageProcessor.js';
const PUBLIC_UPLOADS = path.join(process.cwd(), 'public', 'uploads', 'reviews', 'avatars');
const PUBLIC_PREFIX = '/uploads/reviews/avatars';
const FETCH_TIMEOUT_MS = 10_000;
/**
 * Скачивает аватар по URL и сохраняет как webp в /uploads/reviews/avatars/.
 *
 * @returns публичный URL (например "/uploads/reviews/avatars/abc.webp") или null.
 */
export async function downloadReviewAvatar(remoteUrl) {
    if (!remoteUrl)
        return null;
    // Детерминированное имя: одинаковый URL → один и тот же файл.
    const hash = createHash('sha256').update(remoteUrl).digest('hex').slice(0, 32);
    const publicPath = `${PUBLIC_PREFIX}/${hash}.webp`;
    const localPath = path.join(PUBLIC_UPLOADS, `${hash}.webp`);
    // Уже скачано — пропускаем.
    if (existsSync(localPath))
        return publicPath;
    try {
        const ctl = new AbortController();
        const timeout = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
        const resp = await fetch(remoteUrl, {
            signal: ctl.signal,
            headers: { 'User-Agent': 'zvuki-lesa/1.0 (+avatar-sync)' },
        });
        clearTimeout(timeout);
        if (!resp.ok)
            return null;
        const contentType = resp.headers.get('content-type') ?? '';
        if (!contentType.startsWith('image/'))
            return null;
        const buffer = Buffer.from(await resp.arrayBuffer());
        if (buffer.length === 0)
            return null;
        await processImage(buffer, {
            destDir: PUBLIC_UPLOADS,
            filenameBase: hash,
        });
        return publicPath;
    }
    catch {
        // Любая ошибка (нет сети, не-Yandex URL, битый JPEG) → без аватара.
        return null;
    }
}
/**
 * Точка монтирования: на случай, если кто-то захочет почистить осиротевшие
 * файлы в /uploads/reviews/avatars/. Сейчас не используется.
 */
export const REVIEW_AVATAR_DIR = PUBLIC_UPLOADS;
