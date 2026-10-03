export type CabinMapId = 'Домик1' | 'Домик2' | 'Домик3';

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
  price: number;
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
    price: 4500,
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
        photo: '/images/recreation-chan.jpg',
        description: 'Горячий чан под открытым небом с видом на лес. Прогрев 1,5–2 часа.',
      },
      {
        id: 2,
        title: 'Рафтинг по реке Белой',
        photo: '/images/recreation-rafting.jpg',
        description: 'Сплав по горной реке с опытным инструктором. От 2 часов.',
      },
      {
        id: 3,
        title: 'Джип-тур в горы',
        photo: '/images/recreation-jeeptour.jpg',
        description: 'Экскурсия по горным дорогам Адыгеи с остановками у панорамных точек.',
      },
      {
        id: 4,
        title: 'Конные прогулки',
        photo: '/images/recreation-horse.jpg',
        description: 'Прогулка верхом по окрестным тропам. От 1 часа.',
      },
    ],
    gallery: [
      '/images/cabin1-1.jpg',
      '/images/cabin1-2.jpg',
      '/images/cabin1-3.jpg',
      '/images/cabin1-4.jpg',
      '/images/cabin1-5.jpg',
      '/images/cabin1-6.jpg',
    ],
    mainImage: '/images/cabin1-1.jpg',
  },
  {
    id: 2,
    mapId: 'Домик2',
    name: 'Лесная Резиденция',
    shortDescription: 'Уютный дом в окружении соснового леса с террасой',
    longDescription:
      'Лесная Резиденция — это место, где время замедляется. Дом утопает в зелени соснового леса, а с террасы открывается вид на вековые деревья. Идеальное место для тех, кто хочет уединиться от городской суеты, насладиться тишиной и свежим воздухом.',
    price: 3800,
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
        photo: '/images/recreation-chan.jpg',
        description: 'Горячий чан под открытым небом.',
      },
      {
        id: 2,
        title: 'Рафтинг',
        photo: '/images/recreation-rafting.jpg',
        description: 'Сплав по реке Белой.',
      },
      {
        id: 3,
        title: 'Пешие маршруты',
        photo: '/images/recreation-hiking.jpg',
        description: 'Тропы по лесу и к горным ручьям.',
      },
    ],
    gallery: [
      '/images/cabin2-1.jpg',
      '/images/cabin2-2.jpg',
      '/images/cabin2-3.jpg',
      '/images/cabin2-4.jpg',
      '/images/cabin2-5.jpg',
    ],
    mainImage: '/images/cabin2-1.jpg',
  },
  {
    id: 3,
    mapId: 'Домик3',
    name: 'Горный Дом',
    shortDescription: 'Каждый день начинается с вида на Кавказские горы',
    longDescription:
      'Горный Дом — для тех, кто ценит панорамные виды. Большие окна от пола до потолка, просторная терраса и камин в гостиной. Здесь вы будете просыпаться с видом на заснеженные вершины и засыпать под звёздным небом Кавказа.',
    price: 5200,
    area: 65,
    guests: 6,
    bedrooms: 3,
    beds: { double: 2, single: 2 },
    checkInTime: '15:00 – 23:00',
    checkOutTime: 'до 12:00',
    rules: [
      'Громкая музыка запрещена',
      'Курение запрещено (Все виды)',
      'Можно с животными по согласованию',
    ],
    amenities: [
      'Площадь: 65 м²',
      'Кондиционирование / Система климат-контроля',
      'Камин',
      'Халаты и тапочки',
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
      'Гриль-зона',
    ],
    recreation: [
      {
        id: 1,
        title: 'Банный чан',
        photo: '/images/recreation-chan.jpg',
        description: 'Горячий чан на террасе с панорамным видом.',
      },
      {
        id: 2,
        title: 'Рафтинг',
        photo: '/images/recreation-rafting.jpg',
        description: 'Сплав по горной реке.',
      },
      {
        id: 3,
        title: 'Джип-тур',
        photo: '/images/recreation-jeeptour.jpg',
        description: 'Экскурсия в горы.',
      },
      {
        id: 4,
        title: 'Конные прогулки',
        photo: '/images/recreation-horse.jpg',
        description: 'Верховая прогулка по горным тропам.',
      },
    ],
    gallery: [
      '/images/cabin3-1.jpg',
      '/images/cabin3-2.jpg',
      '/images/cabin3-3.jpg',
      '/images/cabin3-4.jpg',
      '/images/cabin3-5.jpg',
      '/images/cabin3-6.jpg',
    ],
    mainImage: '/images/cabin3-1.jpg',
  },
];

export function getCabinById(id: number | undefined): Cabin | undefined {
  if (id === undefined) return undefined;
  return CABINS.find((c) => c.id === id);
}