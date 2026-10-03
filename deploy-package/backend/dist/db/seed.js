import { sql } from 'drizzle-orm';
import { db, client } from './client.js';
import { eq } from 'drizzle-orm';
import { cottages, cottageImages, amenities, cottageAmenities, recreationItems, services, priceRules, } from './schema.js';
async function clear() {
    // Postgres: TRUNCATE ... RESTART IDENTITY CASCADE сбрасывает sequences и
    // зачищает все таблицы, на которые ссылаются внешние ключи. Порядок не важен —
    // CASCADE проходит по FK.
    await db.execute(sql `
    TRUNCATE TABLE
      booking_services,
      bookings,
      notifications,
      analytics_events,
      price_rules,
      services,
      recreation_items,
      cottage_amenities,
      amenities,
      cottage_images,
      cottages,
      seo_pages,
      blog_posts,
      images_registry,
      reviews,
      max_subscribers
    RESTART IDENTITY CASCADE;
  `);
}
const CABIN_DATA = [
    {
        slug: 'shale-uyut', mapId: 'Домик1', name: 'Шале Уют',
        shortDescription: 'Комфортабельный двухэтажный дом с панорамными окнами и видом на горы',
        longDescription: 'Шале Уют — это уголок спокойствия в самом сердце Адыгеи. Двухэтажный дом с панорамными окнами, просторной террасой и собственным выходом к лесу.',
        description: 'Шале Уют создан для тех, кто ценит уединение и природу. Натуральное дерево в отделке, тёплые пледы, панорамные окна от пола до потолка и просторная терраса с видом на лес. Идеально для семейного отдыха или уединённой поездки вдвоём в любое время года.',
        houseRules: 'Громкая музыка запрещена. Курение в доме запрещено. Можно с животными по согласованию. Залог сохранности имущества — по договору.',
        basePrice: 4500, area: 49, guests: 5, bedrooms: 2,
        bedsDouble: 2, bedsSingle: 1,
        checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
        gallery: ['/Galary/1.jpg', '/Galary/2.jpg', '/Galary/3.jpg', '/Galary/4.jpg', '/Galary/5.jpg', '/Galary/6.jpg'],
        amenities: ['Площадь: 49 м²', 'Кондиционирование', 'Халаты', 'Тапочки', 'Wi-Fi', 'Бассейн'],
        recreation: [
            { title: 'Банный чан на террасе', description: 'Горячий чан под открытым небом.', photo: '/images/chan.jpg' },
            { title: 'Рафтинг по реке Белой', description: 'Сплав с инструктором.', photo: '/services/rafting/photo_43_2026-04-26_11-45-32.jpg' },
        ],
    },
    {
        slug: 'lesnaya-rezidenciya', mapId: 'Домик2', name: 'Лесная Резиденция',
        shortDescription: 'Уютный дом в окружении соснового леса с террасой',
        longDescription: 'Лесная Резиденция — место, где время замедляется.',
        description: 'Дом в окружении соснового леса с собственной террасой и мангальной зоной. Подходит для семейного отдыха и компаний друзей. Тишина, свежий воздух и близость к главным достопримечательностям Адыгеи.',
        houseRules: 'Громкая музыка запрещена. Курение в доме запрещено. Можно с животными по согласованию.',
        basePrice: 3800, area: 42, guests: 4, bedrooms: 2,
        bedsDouble: 1, bedsSingle: 2,
        checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
        gallery: ['/Galary/7.jpg', '/Galary/8.jpg', '/Galary/9.jpg', '/Galary/10.jpg', '/Galary/11.jpg'],
        amenities: ['Площадь: 42 м²', 'Кондиционирование', 'Терраса', 'Мангальная зона', 'Wi-Fi'],
        recreation: [
            { title: 'Банный чан', description: 'Под открытым небом.', photo: '/images/chan.jpg' },
            { title: 'Рафтинг', description: 'Сплав по реке.', photo: '/services/rafting/photo_42_2026-04-26_11-45-32.jpg' },
        ],
    },
    {
        slug: 'gorny-dom', mapId: 'Домик3', name: 'Горный Дом',
        shortDescription: 'Каждый день начинается с вида на Кавказские горы',
        longDescription: 'Горный Дом — для тех, кто ценит панорамные виды.',
        description: 'Самый просторный дом с панорамным видом на Кавказские горы. Три спальни, камин, просторная гостиная и большая терраса. Для семей и компаний до 6 человек, ценящих комфорт и виды.',
        houseRules: 'Громкая музыка запрещена. Курение в доме запрещено. Можно с животными по согласованию.',
        basePrice: 5200, area: 65, guests: 6, bedrooms: 3,
        bedsDouble: 2, bedsSingle: 2,
        checkInTime: '15:00 – 23:00', checkOutTime: 'до 12:00',
        gallery: ['/Galary/12.jpg', '/Galary/13.jpg', '/Galary/14.jpg', '/Galary/15.jpg', '/Galary/16.jpg', '/Galary/17.jpg'],
        amenities: ['Площадь: 65 м²', 'Кондиционирование', 'Камин', 'Wi-Fi', 'Бассейн'],
        recreation: [
            { title: 'Банный чан', description: 'С панорамным видом.', photo: '/images/chan.jpg' },
            { title: 'Джип-тур', description: 'В горы.', photo: '/services/jeeping/photo_39_2026-04-26_11-45-32.jpg' },
        ],
    },
];
// Эвристика секционирования фото по имени файла. Не нашли — уходим в 'interior'.
function classifyImage(url) {
    const lower = url.toLowerCase();
    if (/kuhn|kitch|kitchen/.test(lower))
        return 'kitchen';
    if (/vann|bath|shower|sanuz/.test(lower))
        return 'bathroom';
    if (/pool|terrace|terras|banya|chan|barbecue|grill|amen/.test(lower))
        return 'amenities';
    return 'interior';
}
// Удобства, которые должны быть у каждого домика (добавляются в таблицу amenities
// и привязываются ко всем домикам при сиде).
const DEFAULT_AMENITIES = [
    'Телевизор',
    'Сплит система',
    'Душ',
    'Туалет',
    'Холодильник',
    'Микроволновка',
    'Индукционная плита',
    'Сушка',
    'Фен',
    'Полотенца',
    'Столовые приборы',
    'Постельное бельё',
];
const SERVICES_DATA = [
    { slug: 'rafting', name: 'Рафтинг', description: 'Сплав по горной реке', basePrice: 2500, icon: 'Waves' },
    { slug: 'jeeping', name: 'Джиппинг', description: 'Тур по горным дорогам', basePrice: 3500, icon: 'Mountain' },
    { slug: 'bath-cham', name: 'Банный чан', description: 'Чан на террасе', basePrice: 2000, icon: 'Flame' },
    { slug: 'horse-ride', name: 'Конные прогулки', description: 'Верховая прогулка', basePrice: 1500, icon: 'Users' },
    { slug: 'atv', name: 'Квадроциклы', description: 'Катание по маршрутам', basePrice: 3000, icon: 'Bike' },
];
async function run() {
    await clear();
    // Домики
    for (const c of CABIN_DATA) {
        const mainImageUrl = c.gallery[0];
        const [cottage] = await db.insert(cottages).values({
            slug: c.slug, mapId: c.mapId, name: c.name,
            shortDescription: c.shortDescription, longDescription: c.longDescription,
            description: c.description, houseRules: c.houseRules,
            basePrice: c.basePrice, area: c.area, guests: c.guests, bedrooms: c.bedrooms,
            bedsDouble: c.bedsDouble, bedsSingle: c.bedsSingle,
            checkInTime: c.checkInTime, checkOutTime: c.checkOutTime,
            mainImage: mainImageUrl,
        }).returning();
        // Первое фото всегда в 'main' (обложка). Остальные классифицируем по имени файла,
        // при отсутствии совпадений — в 'interior'.
        let position = 0;
        for (const [idx, url] of c.gallery.entries()) {
            const section = idx === 0 ? 'main' : classifyImage(url);
            await db.insert(cottageImages).values({
                cottageId: cottage.id, url, section, position: position++,
            });
        }
        for (const name of [...c.amenities, ...DEFAULT_AMENITIES]) {
            const existing = await db.select().from(amenities).where(eq(amenities.name, name));
            let amenityId;
            if (existing.length > 0) {
                amenityId = existing[0].id;
            }
            else {
                const [inserted] = await db.insert(amenities).values({ name }).returning();
                amenityId = inserted.id;
            }
            await db.insert(cottageAmenities).values({ cottageId: cottage.id, amenityId });
        }
        for (const [pos, r] of c.recreation.entries()) {
            await db.insert(recreationItems).values({
                cottageId: cottage.id, title: r.title, description: r.description,
                photo: r.photo, position: pos,
            });
        }
    }
    // Услуги
    for (const [pos, s] of SERVICES_DATA.entries()) {
        await db.insert(services).values({
            slug: s.slug, name: s.name, description: s.description,
            basePrice: s.basePrice, icon: s.icon, position: pos,
        });
    }
    // Правила цен (пример)
    await db.insert(priceRules).values({
        cottageId: null, name: 'Высокий сезон (июль-август)',
        startDate: '2026-07-01', endDate: '2026-08-31',
        modifierType: 'percent', modifierValue: 30, weekendModifier: 10, priority: 0,
    });
    await db.insert(priceRules).values({
        cottageId: null, name: 'Новый год',
        startDate: '2026-12-25', endDate: '2027-01-08',
        modifierType: 'percent', modifierValue: 100, weekendModifier: null, priority: 10,
    });
    console.log('[seed] done');
}
run().then(() => client.end({ timeout: 1 })).then(() => process.exit(0));
