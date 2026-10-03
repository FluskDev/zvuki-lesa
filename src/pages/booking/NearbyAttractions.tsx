import { Link } from 'react-router-dom';

interface Attraction {
  title: string;
  href: string;
  description: string;
}

const ATTRACTIONS: Attraction[] = [
  {
    title: 'Плато Лагонаки',
    href: '/seo/lagonaki-otdih',
    description: 'Альпийские луга и пешие маршруты — 60 км от нас',
  },
  {
    title: 'Водопады Руфабго',
    href: '/seo/rufabgo-vodopady',
    description: 'Каскад водопадов в ущелье — 25 км от нас',
  },
  {
    title: 'Термальные источники',
    href: '/seo/termalnye-istochniki-adygeya',
    description: 'Купание круглый год — 40 км от нас',
  },
];

export function NearbyAttractions() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-6">Что посмотреть рядом</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {ATTRACTIONS.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="block border border-white/5 rounded-2xl p-5 bg-[#1A1A1E] hover:bg-[#222226] transition-colors"
          >
            <div className="font-semibold text-white">{item.title}</div>
            <div className="text-sm text-white/60 mt-1">{item.description}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}