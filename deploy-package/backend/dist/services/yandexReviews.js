/**
 * Парсер отзывов с Яндекс.Карт.
 *
 * Открывает URL бизнеса (YANDEX_MAPS_URL) через Puppeteer, собирает блоки
 * отзывов с DOM и пишет их в таблицу reviews с дедупликацией по (source,
 * external_id). Идемпотентен: повторные запуски не дублируют записи.
 *
 * Использование:
 *   import { syncYandexReviews } from './services/yandexReviews.js';
 *   const result = await syncYandexReviews();
 *
 * Переменные окружения:
 *   YANDEX_MAPS_URL            — обязательный, ссылка на бизнес.
 *   YANDEX_REVIEWS_AUTO_PUBLISH — если 'true', новые отзывы сразу публикуются.
 *                                 По умолчанию 'false' (черновик, владелец публикует вручную).
 */
import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import puppeteer from 'puppeteer';
import { db } from '../db/client.js';
import { reviews } from '../db/schema.js';
import { downloadReviewAvatar } from './reviewAvatars.js';
// ─── Константы ────────────────────────────────────────────────────────────
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MONTHS_RU = {
    января: 0,
    февраля: 1,
    марта: 2,
    апреля: 3,
    мая: 4,
    июня: 5,
    июля: 6,
    августа: 7,
    сентября: 8,
    октября: 9,
    ноября: 10,
    декабря: 11,
};
// ─── Парсинг даты ─────────────────────────────────────────────────────────
/**
 * Яндекс показывает дату отзыва как «16 мая» (без года).
 * Дорисовываем год:
 *   - месяц отзыва ≤ текущего месяца → текущий год;
 *   - месяц > текущего → предыдущий год (зимой видим прошлогодние майские).
 * Если в строке есть год («16 мая 2024») — парсим как есть.
 */
export function parseYandexDate(raw, now = new Date()) {
    const m = raw.trim().match(/^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?$/i);
    if (!m)
        return null;
    const day = Number(m[1]);
    const monthName = m[2].toLowerCase();
    const month = MONTHS_RU[monthName];
    if (month === undefined)
        return null;
    let year = m[3] ? Number(m[3]) : now.getFullYear();
    if (!m[3]) {
        // Без года: если месяц уже прошёл в этом году — это этот год;
        // если ещё не наступил (например, январь и отзыв «16 мая») — прошлый.
        if (month > now.getMonth() + 1)
            year -= 1;
    }
    return new Date(Date.UTC(year, month, day));
}
/**
 * Извлекает один отзыв из DOM-узла `.business-review-view__info`.
 * Возвращает null, если данных недостаточно (защита от мусорных блоков).
 */
function extractReviewFromNode(node) {
    // Контейнер всего отзыва — общий предок, который содержит и info, и body
    const root = node.closest('.business-review-view') ?? node.parentElement;
    if (!root)
        return null;
    const authorName = root.querySelector('.business-review-view__author-name [itemprop="name"]')?.textContent?.trim() ??
        root.querySelector('.business-review-view__author-name')?.textContent?.trim() ??
        '';
    const authorUrl = root.querySelector('.business-review-view__link')?.getAttribute('href') ?? null;
    // Рейтинг: aria-label вида «Оценка 5 Из 5»
    const ratingAria = root.querySelector('[aria-label^="Оценка"]')?.getAttribute('aria-label') ?? '';
    const ratingMatch = ratingAria.match(/Оценка\s+(\d+)\s+Из\s+\d+/i);
    const rating = ratingMatch ? Number(ratingMatch[1]) : 0;
    // Дата: первый span вида «16 мая» или «16 мая 2024»
    const dateSpan = Array.from(root.querySelectorAll('span')).find((s) => /^\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(\s+\d{4})?$/.test((s.textContent ?? '').trim()));
    const dateText = dateSpan?.textContent?.trim() ?? '';
    // Текст: первый «длинный» (≥ 30 символов) текстовый блок внутри body
    const body = root.querySelector('.business-review-view__body');
    let text = '';
    if (body) {
        const candidates = Array.from(body.querySelectorAll('*'))
            .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length >= 30)
            .map((el) => (el.textContent ?? '').trim());
        // Берём самый длинный — на случай, если есть спойлер «Показать полностью…»
        text = candidates.sort((a, b) => b.length - a.length)[0] ?? body.textContent?.trim() ?? '';
    }
    if (!authorName || rating < 1 || rating > 5 || !text || !dateText)
        return null;
    // authorAvatarUrl заполняется ниже в браузерном контексте (см. fetchReviewsViaBrowser);
    // эта функция оставлена для возможного юнит-тестирования DOM-парсинга.
    return { authorName, authorUrl, rating, text, dateText, authorAvatarUrl: null };
}
/** Стабильный external_id из автора + даты + первых 100 символов текста. */
export function makeExternalId(authorUrl, dateText, text) {
    const seed = `${authorUrl ?? ''}|${dateText}|${text.slice(0, 100)}`;
    return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}
/**
 * Достаёт URL аватара из inline-style вида:
 *   background-image: url("https://avatars.mds.yandex.net/get-yapic/.../islands-68");
 * Возвращает null, если style пустой/битый.
 */
export function parseAvatarStyleUrl(inlineStyle) {
    const m = inlineStyle.match(/background-image\s*:\s*url\(["']?([^"')]+)["']?\)/i);
    return m ? upsizeAvatar(m[1]) : null;
}
/**
 * Апскейлит аватар с 68px (стандартный islands-68 в HTML) до 200px.
 * Если суффикса нет — возвращает как есть.
 */
export function upsizeAvatar(url) {
    return url.replace(/\/islands-\d{1,3}$/, '/islands-200');
}
/**
 * Скроллит вниз несколько раз, чтобы подгрузились ленивые отзывы,
 * и возвращает список собранных блоков.
 */
async function scrapeYandexPage(url, limit) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ru-RU'],
    });
    try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'ru-RU,ru;q=0.9' });
        await page.setViewport({ width: 1280, height: 900 });
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        if (!resp || !resp.ok()) {
            throw new Error(`Yandex Maps: HTTP ${resp?.status() ?? 'no response'}`);
        }
        // Если нас завели на короткий alias вида /maps/-/<hash> или просто на
        // обзорную страницу бизнеса, Яндекс показывает только превью первых
        // ~3 отзывов. Полный список доступен на отдельной вкладке /reviews/ —
        // найдём ссылку (вкладка «Отзывы» или кнопка «Посмотреть все N отзывов»)
        // и перейдём туда в той же сессии.
        if (!/\/reviews\/?(?:[?#].*)?$/.test(new URL(page.url()).pathname + new URL(page.url()).search)) {
            const reviewsHref = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="/reviews"]'));
                // 1) Предпочитаем «настоящую» ссылку на вкладку отзывов (с org-ID).
                for (const a of links) {
                    const href = a.getAttribute('href') ?? '';
                    if (/\/maps\/org\/[^/]+\/\d+\/reviews\/?/.test(href)) {
                        return new URL(href, window.location.href).toString();
                    }
                }
                // 2) Любая другая ссылка с /reviews — лучше, чем превью из 3 штук.
                for (const a of links) {
                    const href = a.getAttribute('href') ?? '';
                    if (href)
                        return new URL(href, window.location.href).toString();
                }
                return null;
            });
            if (reviewsHref) {
                const r2 = await page.goto(reviewsHref, { waitUntil: 'domcontentloaded', timeout: 45_000 });
                if (!r2 || !r2.ok()) {
                    throw new Error(`Yandex Maps reviews tab: HTTP ${r2?.status() ?? 'no response'}`);
                }
            }
        }
        // SPA-рендер. Подождём первую пачку отзывов.
        await page.waitForSelector('.business-review-view__info', { timeout: 15_000 }).catch(() => null);
        await new Promise((r) => setTimeout(r, 3000));
        // Прокрутим список, чтобы подтянуть ленивые блоки (Яндекс подгружает по 10).
        let prevCount = 0;
        for (let i = 0; i < 6; i++) {
            const count = await page.evaluate(() => document.querySelectorAll('.business-review-view__info').length);
            if (limit && count >= limit)
                break;
            if (count === prevCount && i > 0)
                break; // новых больше нет
            prevCount = count;
            await page.evaluate(() => window.scrollBy(0, 1200));
            await new Promise((r) => setTimeout(r, 1200));
        }
        // Извлекаем данные прямо в браузере — там есть DOM, в Node его нет.
        const result = await page.evaluate((max) => {
            const nodes = Array.from(document.querySelectorAll('.business-review-view__info'));
            const slice = typeof max === 'number' ? nodes.slice(0, max) : nodes;
            return slice.map((n) => {
                const root = n.closest('.business-review-view') ?? n.parentElement;
                if (!root)
                    return null;
                const authorName = (root.querySelector('.business-review-view__author-name [itemprop="name"]')?.textContent ?? '').trim() ||
                    (root.querySelector('.business-review-view__author-name')?.textContent ?? '').trim();
                const authorUrl = root.querySelector('.business-review-view__link')?.getAttribute('href') ?? null;
                // Аватар приходит как background-image на div.user-icon-view__icon.
                // inline в browser-контексте, без парсера URL: regex прямо тут.
                const avatarStyle = root.querySelector('.user-icon-view__icon')?.getAttribute('style') ?? '';
                const avatarMatch = avatarStyle.match(/background-image\s*:\s*url\(["']?([^"')]+)["']?\)/i);
                const authorAvatarUrl = avatarMatch
                    ? avatarMatch[1].replace(/\/islands-\d{1,3}$/, '/islands-200')
                    : null;
                const ratingAria = root.querySelector('[aria-label^="Оценка"]')?.getAttribute('aria-label') ?? '';
                const ratingMatch = ratingAria.match(/Оценка\s+(\d+)\s+Из\s+\d+/i);
                const rating = ratingMatch ? Number(ratingMatch[1]) : 0;
                const dateSpan = Array.from(root.querySelectorAll('span')).find((s) => /^\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(\s+\d{4})?$/.test((s.textContent ?? '').trim()));
                const dateText = dateSpan?.textContent?.trim() ?? '';
                const body = root.querySelector('.business-review-view__body');
                let text = '';
                if (body) {
                    const candidates = Array.from(body.querySelectorAll('*'))
                        .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length >= 30)
                        .map((el) => (el.textContent ?? '').trim());
                    text = candidates.sort((a, b) => b.length - a.length)[0] ?? body.textContent?.trim() ?? '';
                }
                if (!authorName || rating < 1 || rating > 5 || !text || !dateText)
                    return null;
                return { authorName, authorUrl, rating, text, dateText, authorAvatarUrl };
            });
        }, limit ?? null);
        return result.filter((r) => r !== null);
    }
    finally {
        await browser.close();
    }
}
// ─── Запись в БД ──────────────────────────────────────────────────────────
/**
 * Пишет распарсенные отзывы в БД с upsert.
 * Возвращает статистику: сколько вставлено / обновлено / пропущено.
 */
async function persistReviews(items) {
    if (items.length === 0)
        return { inserted: 0, updated: 0, unchanged: 0 };
    const externalIds = items.map((r) => r.externalId);
    const existing = await db
        .select({
        id: reviews.id,
        externalId: reviews.externalId,
        authorName: reviews.authorName,
        rating: reviews.rating,
        text: reviews.text,
        date: reviews.date,
        authorUrl: reviews.authorUrl,
    })
        .from(reviews)
        .where(and(eq(reviews.source, 'yandex'), inArray(reviews.externalId, externalIds)));
    const existingByExt = new Map(existing.map((r) => [r.externalId, r]));
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const autoPublish = process.env.YANDEX_REVIEWS_AUTO_PUBLISH === 'true';
    for (const r of items) {
        const prev = existingByExt.get(r.externalId);
        if (prev) {
            // Сравним по существенным полям; если совпали — пропускаем.
            // avatarUrl НЕ участвует в сравнении: даже если аватар не подтянулся в прошлый раз,
            // сейчас подтянется — это обновление, а не "unchanged".
            const sameAuthor = prev.authorName === r.authorName;
            const sameRating = prev.rating === r.rating;
            const sameText = prev.text === r.text;
            const sameDate = prev.date.getTime() === r.date.getTime();
            const sameAvatar = r.authorAvatarUrl === null; // null в current → не считаем изменением
            if (sameAuthor && sameRating && sameText && sameDate && sameAvatar) {
                unchanged += 1;
                continue;
            }
            const patch = {
                authorName: r.authorName,
                rating: r.rating,
                text: r.text,
                date: r.date,
            };
            if (r.authorAvatarUrl !== null)
                patch.avatarUrl = r.authorAvatarUrl;
            // authorUrl обновляем даже если стал null — для отзывов из других источников
            // там действительно null, и старый URL от Яндекса уже неактуален.
            if (r.authorUrl !== prev.authorUrl && r.authorUrl !== null) {
                patch.authorUrl = r.authorUrl;
            }
            await db
                .update(reviews)
                .set(patch)
                .where(eq(reviews.id, prev.id));
            updated += 1;
        }
        else {
            await db.insert(reviews).values({
                source: 'yandex',
                externalId: r.externalId,
                authorName: r.authorName,
                rating: r.rating,
                text: r.text,
                date: r.date,
                isPublished: autoPublish,
                avatarUrl: r.authorAvatarUrl,
                authorUrl: r.authorUrl,
            });
            inserted += 1;
        }
    }
    return { inserted, updated, unchanged };
}
// ─── Публичная точка входа ────────────────────────────────────────────────
/**
 * Главная функция: парсит Яндекс.Карты и сохраняет в БД.
 * Используется и cron-скриптом, и admin endpoint.
 */
export async function syncYandexReviews(opts = {}) {
    const startedAt = Date.now();
    const url = process.env.YANDEX_MAPS_URL;
    if (!url) {
        throw new Error('YANDEX_MAPS_URL is not set. Укажите ссылку на бизнес в .env');
    }
    const errors = [];
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let fetched = 0;
    try {
        // В тестах передают свой браузер (мок) — тогда скрейпинг внутри не запускаем.
        const raw = opts.browser ? [] : await scrapeYandexPage(url, opts.limit);
        // Скачиваем аватарки параллельно (allSettled — ошибка одного не роняет остальные).
        // downloadReviewAvatar идемпотентен: если файл уже есть на диске, вернёт путь.
        const avatarUrls = await Promise.allSettled(raw.map((r) => (r.authorAvatarUrl ? downloadReviewAvatar(r.authorAvatarUrl) : Promise.resolve(null))));
        const items = raw.map((r, i) => {
            const av = avatarUrls[i];
            return {
                externalId: makeExternalId(r.authorUrl, r.dateText, r.text),
                authorName: r.authorName,
                rating: r.rating,
                text: r.text,
                date: parseYandexDate(r.dateText) ?? new Date(),
                authorUrl: r.authorUrl,
                // fulfilled → локальный URL или null, rejected → null (старое значение в БД сохраняется при update)
                authorAvatarUrl: av.status === 'fulfilled' ? av.value : null,
            };
        });
        fetched = items.length;
        if (!opts.dryRun && items.length > 0) {
            const stats = await persistReviews(items);
            inserted = stats.inserted;
            updated = stats.updated;
            unchanged = stats.unchanged;
        }
    }
    catch (err) {
        errors.push({ message: err instanceof Error ? err.message : String(err) });
    }
    return {
        fetched,
        inserted,
        updated,
        unchanged,
        errors,
        durationMs: Date.now() - startedAt,
    };
}
/** Только парсинг без записи — удобно для отладки. */
export async function fetchYandexReviews(limit) {
    const url = process.env.YANDEX_MAPS_URL;
    if (!url)
        throw new Error('YANDEX_MAPS_URL is not set');
    const raw = await scrapeYandexPage(url, limit);
    return raw.map((r) => ({
        externalId: makeExternalId(r.authorUrl, r.dateText, r.text),
        authorName: r.authorName,
        rating: r.rating,
        text: r.text,
        date: parseYandexDate(r.dateText) ?? new Date(),
        authorUrl: r.authorUrl,
        // Ссылка на оригинальный аватар; без скачивания.
        authorAvatarUrl: r.authorAvatarUrl,
    }));
}
