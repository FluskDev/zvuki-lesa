import { HeroCarousel, type HeroSlide } from '@/components/HeroCarousel/HeroCarousel';

const SLIDES: HeroSlide[] = [
  {
    src: '/cabin-1-enhanced.webp',
    header: 'Что такое Звуки Леса?',
    title: 'Уютные домики в горах',
    description: 'Отдохните от городской суеты в комфортных домиках',
  },
  {
    src: '/services/rafting/photo_43_2026-04-26_11-45-32.webp',
    header: 'Что такое Звуки Леса?',
    title: 'Сплав по горным рекам',
    description: 'Незабываемые впечатления от рафтинга для всей семьи',
  },
  {
    src: '/services/jeeping/photo-39-cinematic.webp',
    header: 'Что такое Звуки Леса?',
    title: 'Джип-туры по горам',
    description: 'Исследуйте живописные горные маршруты на внедорожниках',
  },
  {
    src: '/services/bath-cham/hero-evening.webp',
    header: 'Что такое Звуки Леса?',
    title: 'Банный чан на свежем воздухе',
    description: 'Расслабление и здоровье: Прогрев мышц, снятие стресса, улучшение кровообращения и обмена веществ.',
  },
];

export function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Hero Carousel */}
      <HeroCarousel slides={SLIDES} autoplayInterval={6000} />
    </section>
  );
}
