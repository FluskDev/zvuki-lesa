/**
 * Идемпотентный сидинг дефолтных строк site_map_elements при старте сервера.
 * Запускается через `INSERT ... ON CONFLICT DO NOTHING` — повторные запуски
 * безопасны и ничего не затирают.
 */
import { db } from '../db/client.js';
import { siteMapElements } from '../db/schema.js';
const DEFAULTS = [
    {
        mapId: 'Парковка',
        title: 'Парковка',
        description: 'Гостевой паркинг на 6 машин рядом с домиками.',
        photoUrl: null,
        hasButton: false,
    },
    {
        mapId: 'Лес1',
        title: 'Лес',
        description: 'Хвойный лес вокруг — тропы для прогулок прямо от домика.',
        photoUrl: null,
        hasButton: false,
    },
    {
        mapId: 'Лес2',
        title: 'Лес',
        description: 'Буковый лес на склоне. Маршрут к реке Белой.',
        photoUrl: null,
        hasButton: false,
    },
    {
        mapId: 'чан',
        title: 'Чан',
        description: 'Чан на террасе под открытым небом. Прогрев — круглый год.',
        photoUrl: '/images/chan.jpg',
        hasButton: false,
    },
];
export async function ensureSiteElements() {
    try {
        await db
            .insert(siteMapElements)
            .values(DEFAULTS.map((e) => ({
            mapId: e.mapId,
            title: e.title,
            description: e.description,
            photoUrl: e.photoUrl,
            hasButton: e.hasButton,
        })))
            .onConflictDoNothing();
        console.log(`[site-elements] ensured ${DEFAULTS.length} default rows`);
    }
    catch (err) {
        // Не роняем сервер, если сид не удался — нужные строки будут созданы
        // при первом PATCH админом вручную, а в API вернётся пустой список.
        console.error('[site-elements] ensure failed:', err);
    }
}
