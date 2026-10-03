import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCottage, type Cottage } from '@/lib/api';
import type { Cabin, CabinMapId } from '@/lib/cabins';
import { useDocumentHead, type DocumentHead } from '@/lib/seo';
import {
  absoluteSiteUrl,
  buildCottageStructuredData,
} from '@/lib/structuredData';
import { TopBar } from './TopBar';
import { BookingHero } from './BookingHero';
import { BookingInfo } from './BookingInfo';
import { BookingAmenities } from './BookingAmenities';
import { BookingRecreation } from './BookingRecreation';
import { BookingAbout } from './BookingAbout';
import { BookingMap } from './BookingMap';
import { NearbyAttractions } from './NearbyAttractions';

// Маппинг Cottage (API) → Cabin (UI).
// Дочерние компоненты пока ожидают Cabin-форму; после миграции UI на Cottage
// этот маппер можно удалить.
function toCabin(c: Cottage): Cabin {
  return {
    id: c.id,
    mapId: c.mapId as CabinMapId,
    name: c.name,
    shortDescription: c.shortDescription,
    longDescription: c.longDescription,
    description: c.description || undefined,
    houseRules: c.houseRules || undefined,
    area: c.area,
    guests: c.guests,
    bedrooms: c.bedrooms,
    beds: c.beds,
    checkInTime: c.checkInTime,
    checkOutTime: c.checkOutTime,
    rules: [],
    amenities: c.amenities,
    recreation: c.recreation,
    gallery: c.gallery,
    images: c.images,
    mainImage: c.mainImage,
  };
}

export function BookingPage() {
  const { cabinId } = useParams<{ cabinId: string }>();
  const [cottage, setCottage] = useState<Cottage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!cabinId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    getCottage(cabinId).then((res) => {
      setLoading(false);
      if (res.success) {
        setCottage(res.data.cottage);
      } else {
        setNotFound(true);
      }
    });
  }, [cabinId]);

  const requestedCanonical = `https://zvuki-lesa.ru/booking/${cabinId ?? ''}/`;
  let head: DocumentHead;

  if (cottage) {
    const canonical = `https://zvuki-lesa.ru/booking/${cottage.slug}/`;
    const description = [
      cottage.shortDescription,
      `${cottage.area} м², до ${cottage.guests} гостей`,
      `от ${cottage.basePrice.toLocaleString('ru-RU')} ₽ за ночь`,
    ].join('. ');

    head = {
      title: `${cottage.name} — аренда домика в Даховской | Звуки Леса`,
      description,
      canonical,
      ogImage: absoluteSiteUrl(cottage.mainImage || '/og-image.jpg'),
      robots: 'index, follow, max-snippet:-1, max-image-preview:large',
      schema: buildCottageStructuredData(cottage),
    };
  } else if (notFound) {
    head = {
      title: 'Домик не найден | Звуки Леса',
      description: 'Запрошенный домик не найден.',
      canonical: requestedCanonical,
      robots: 'noindex, nofollow',
    };
  } else {
    head = {
      title: 'Загрузка домика | Звуки Леса',
      canonical: requestedCanonical,
      robots: 'noindex, follow',
    };
  }

  useDocumentHead(head);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center px-4">
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  if (notFound || !cottage) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Домик не найден</h1>
          <p className="text-white/70 mb-8">К сожалению, запрашиваемый домик не существует.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  const cabin = toCabin(cottage);

  return (
    <div className="min-h-screen bg-[#0E0E10]">
      <TopBar />
      <BookingHero cabin={cabin} />
      <BookingInfo cabin={cabin} />
      <BookingAmenities cabin={cabin} />
      <BookingRecreation cabin={cabin} />
      <BookingAbout cabin={cabin} />
      <BookingMap />
      <NearbyAttractions />
      <footer className="border-t border-white/5 mt-12 py-8 text-center text-white/40 text-sm">
        © Звуки леса, {new Date().getFullYear()}
      </footer>
    </div>
  );
}