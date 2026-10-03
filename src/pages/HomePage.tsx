import { lazy, Suspense } from 'react';
import { Navigation } from '@/sections/Navigation';
import { Hero } from '@/sections/Hero';
import { StickyFooter } from '@/components/StickyFooter/StickyFooter';
import { useReviews } from '@/hooks/useReviews';
import { useDocumentHead } from '@/lib/seo';
import { buildHomeStructuredData } from '@/lib/structuredData';

// Нижние секции грузятся отдельными чанками — initial JS не тянет
// их код (Cabins/Services/About/Amenities/Reviews/ContactUsLanding).
// Suspense fallback=null безопасен: секции встают в поток документа,
// место под незагруженную секцию не резервируется, layout не «скачет».
const Cabins = lazy(() =>
  import('@/sections/Cabins').then((m) => ({ default: m.Cabins })),
);
const Services = lazy(() =>
  import('@/sections/Services').then((m) => ({ default: m.Services })),
);
const About = lazy(() =>
  import('@/sections/About').then((m) => ({ default: m.About })),
);
const Amenities = lazy(() =>
  import('@/sections/Amenities').then((m) => ({ default: m.Amenities })),
);
const Reviews = lazy(() =>
  import('@/sections/Reviews').then((m) => ({ default: m.Reviews })),
);
const ContactUsLanding = lazy(() =>
  import('@/sections/ContactUsLanding').then((m) => ({ default: m.ContactUsLanding })),
);

const title = 'Звуки Леса — Аренда домиков в станице Даховская | Адыгея';
const description = 'Уютные домики в станице Даховская: горный отдых, рафтинг, джиппинг и банный чан. Бронирование гостевого дома «Звуки Леса».';
const canonical = 'https://zvuki-lesa.ru/';
const ogImage = 'https://zvuki-lesa.ru/og-image.jpg';

export function HomePage() {
  const { data, loading } = useReviews();

  useDocumentHead({
    title,
    description,
    canonical,
    ogImage,
    robots: 'index, follow, max-snippet:-1, max-image-preview:large',
    schema: buildHomeStructuredData(data),
  });

  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <Suspense fallback={null}>
          <Cabins />
        </Suspense>
        <Suspense fallback={null}>
          <Services />
        </Suspense>
        <Suspense fallback={null}>
          <About />
        </Suspense>
        <Suspense fallback={null}>
          <Amenities />
        </Suspense>
        <Suspense fallback={null}>
          <Reviews data={data} loading={loading} />
        </Suspense>
        <Suspense fallback={null}>
          <ContactUsLanding />
        </Suspense>
      </main>
      <StickyFooter />
    </>
  );
}