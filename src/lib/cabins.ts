export type CabinMapId = 'Домик1' | 'Домик2';

export type CabinSection = 'main' | 'interior' | 'kitchen' | 'bathroom' | 'amenities';

export interface CabinImage {
  id: number;
  url: string;
  section: CabinSection;
  position: number;
}

export interface RecreationItem {
  id: number;
  title: string;
  photo: string;
  description: string;
}

export interface Cabin {
  id: number;
  mapId: CabinMapId;
  name: string;
  shortDescription: string;
  longDescription: string;
  description?: string;
  houseRules?: string;
  area: number;
  guests: number;
  bedrooms: number;
  beds: { double: number; single: number };
  checkInTime: string;
  checkOutTime: string;
  rules: string[];
  amenities: string[];
  amenitiesHidden?: string[];
  recreation: RecreationItem[];
  gallery: string[];
  images?: CabinImage[];
  mainImage: string;
}

export const CABINS: Cabin[] = [
  {
    id: 1,
    mapId: 'Домик1',
    name: 'Шале Уют',
    shortDescription: 'Комфортабельный двухэтажный дом с панорамными окнами и видом на горы',
    longDescription:
      'Шале Уют — это уголок спокойствия в самом сердце Адыгеи. Двухэтажный дом с панорамными окнами, просторной террасой и собственным выходом к лесу. Идеально подходит для семейного отдыха или уединённой поездки вдвоём. Внутри — натуральное дерево, тёплые пледы и всё необходимое для комфортного отдыха в любое время года.',
    area: 49,
    guests: 5,
    bedrooms: 2,
    beds: { double: 2, single: 1 },
    checkInTime: '15:00 – 23:00',
    checkOutTime: 'до 12:00',
    rules: [
      'Громкая музыка запрещена',
      'Курение запрещено (Все виды)',
      'Можно с животными по согласованию',
    ],
    amenities: [
      'Площадь: 49 м²',
      'Кондиционирование / Система климат-контроля',
      'Халаты',
      'Тапочки',
      'Туалетно-косметические принадлежности',
      'Бассейн',
    ],
    amenitiesHidden: [
      'Всё необходимое для приготовления еды',
      'Минибар',
      'Wi-Fi',
      'Телевизор',
      'Фен',
      'Полотенца',
      'Посуда',
    ],
    recreation: [
      {
        id: 1,
        title: 'Банный чан на террасе',
        photo: '/images/placeholder-recreation.jpg',
        description: 'Горячий чан под открытым небом с видом на лес. Прогрев 1,5–2 часа.',
      },
      {
        id: 2,
        title: 'Рафтинг по реке Белой',
        photo: '/images/placeholder-recreation.jpg',
        description: 'Сплав по горной реке с опытным инструктором. От 2 часов.',
      },
      {
        id: 3,
        title: 'Джип-тур в горы',
        photo: '/images/placeholder-recreation.jpg',
        description: 'Экскурсия по горным дорогам Адыгеи с остановками у панорамных точек.',
      },
      {
        id: 4,
        title: 'Конные прогулки',
        photo: '/images/placeholder-recreation.jpg',
        description: 'Прогулка верхом по окрестным тропам. От 1 часа.',
      },
    ],
    // gallery и mainImage — fallback для случаев, когда useCottages() пустой
    // (например, в unit-тестах). Реальные фото — в public/Шале Уют/1.jpg..15.jpg,
    // в UI они идут через useCottages() → COTTAGE_IMAGES.
    gallery: [
      '/Шале Уют/1.jpg',
      '/Шале Уют/2.jpg',
      '/Шале Уют/3.jpg',
      '/Шале Уют/4.jpg',
      '/Шале Уют/5.jpg',
      '/Шале Уют/6.jpg',
    ],
    mainImage: '/Шале Уют/1.jpg',
  },
  {
    id: 2,
    mapId: 'Домик2',
    name: 'Лесная Резиденция',
    shortDescription: 'Уютный дом в окружении соснового леса с террасой',
    longDescription:
      'Лесная Резиденция — это место, где время замедляется. Дом утопает в зелени соснового леса, а с террасы открывается вид на вековые деревья. Идеальное место для тех, кто хочет уединиться от городской суеты, насладиться тишиной и свежим воздухом.',
    area: 42,
    guests: 4,
    bedrooms: 2,
    beds: { double: 1, single: 2 },
    checkInTime: '15:00 – 23:00',
    checkOutTime: 'до 12:00',
    rules: [
      'Громкая музыка запрещена',
      'Курение запрещено (Все виды)',
      'Можно с животными по согласованию',
    ],
    amenities: [
      'Площадь: 42 м²',
      'Кондиционирование',
      'Туалетно-косметические принадлежности',
      'Терраса с видом на лес',
      'Мангальная зона',
      'Wi-Fi',
    ],
    amenitiesHidden: [
      'Всё необходимое для приготовления еды',
      'Посуда',
      'Полотенца',
      'Фен',
    ],
    recreation: [
      {
        id: 1,
        title: 'Банный чан',
        photo: '/images/placeholder-recreation.jpg',
        description: 'Горячий чан под открытым небом.',
      },
      {
        id: 2,
        title: 'Рафтинг',
        photo: '/images/placeholder-recreation.jpg',
        description: 'Сплав по реке Белой.',
      },
      {
        id: 3,
        title: 'Пешие маршруты',
        photo: '/images/placeholder-recreation.jpg',
        description: 'Тропы по лесу и к горным ручьям.',
      },
    ],
    // gallery/mainImage fallback — см. домик 1. Реальные фото домика 2
    // лежат в public/Лесная резеденция/1.jpg..17.jpg.
    gallery: [
      '/Лесная резеденция/1.jpg',
      '/Лесная резеденция/2.jpg',
      '/Лесная резеденция/3.jpg',
      '/Лесная резеденция/4.jpg',
      '/Лесная резеденция/5.jpg',
    ],
    mainImage: '/Лесная резеденция/1.jpg',
  },
];

export function getCabinById(id: number | undefined): Cabin | undefined {
  if (id === undefined) return undefined;
  return CABINS.find((c) => c.id === id);
}