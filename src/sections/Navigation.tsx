import { useState, useEffect } from 'react';
import { Mountain, X } from 'lucide-react';
import { scrollToElement } from '@/lib/lenis';

const mobileMenuLinks = [
  { href: '#hero', label: 'Главная' },
  { href: '#cabins', label: 'Домики' },
  { href: '#services', label: 'Расположение' },
  { href: '#about', label: 'О даховской' },
  { href: '#amenities', label: 'О нас' },
  { href: '#reviews', label: 'Отзывы' },
  { href: '#contact-us', label: 'Свяжитесь с нами' },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // === Синхронизация с StickyFooter ===
  // При открытом мобильном меню StickyFooter (плашка с кнопкой
  // «Забронировать») нужно спрятать — иначе она висит поверх
  // чёрного оверлея меню (z-index 60 vs 9999) и читается как
  // «кнопка внутри бургер-меню», что неуместно. Ставим на <body>
  // атрибут [data-menu-open="true"] — StickyFooter.module.css ловит
  // его и прячет трей через display:none !important.
  // Атрибут вместо класса: PostCSS Modules по умолчанию хеширует
  // ЛЮБОЙ класс в селекторе .module.css, поэтому .menu-open в
  // `body.menu-open .…` терял оригинальный вид при компиляции и
  // переставал матчиться с React'овским classList. Атрибутные
  // селекторы CSS Modules не трогает.
  // Cleanup на размонтировании — чтобы при HMR/переходе между
  // страницами атрибут не «залип».
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.setAttribute('data-menu-open', 'true');
    } else {
      document.body.setAttribute('data-menu-open', 'false');
    }
    return () => {
      document.body.removeAttribute('data-menu-open');
    };
  }, [isMobileMenuOpen]);

  const scrollToSection = (href: string) => {
    scrollToElement(href);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav
        role="navigation"
        aria-label="Основная навигация"
        className={`fixed top-0 left-0 right-0 z-[70] transition-all duration-500 ${isScrolled ? 'bg-[#0f0f0e63] py-3' : 'bg-transparent py-5'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo - left */}
            <a href="#" className={`flex items-center gap-2 transition-colors ${isScrolled ? 'text-white' : 'text-white'}`}>
              <Mountain className="w-7 h-7 text-emerald-500" />
              <span className="text-xl font-bold whitespace-nowrap">Звуки Леса</span>
            </a>

            {/* Right side icons and phone - hidden on mobile, shown on md+ */}
            <div className="hidden md:flex items-center gap-3">
              <a href="https://t.me/ZVUKILESA01" target="_blank" rel="noopener noreferrer" className={`p-1 ${isScrolled ? 'text-white' : 'text-white'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              <a href="https://wa.me/79282110249" target="_blank" rel="noopener noreferrer" className={`p-1 ${isScrolled ? 'text-white' : 'text-white'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet">
                  <path d="M23.17,27.05A13.93,13.93,0,0,0,37.08,41h.45a3.47,3.47,0,0,0,3.3-3.48,3.71,3.71,0,0,0-.06-.67,4.6,4.6,0,0,0-.2-.66l-5.86-.93a3.51,3.51,0,0,0-.8,1.77,10.46,10.46,0,0,1-6.69-6.53A3.49,3.49,0,0,0,29,29.67L28,23.86a3.3,3.3,0,0,0-.81-.25,3.64,3.64,0,0,0-.57,0A3.48,3.48,0,0,0,23.17,27.05Z" fill="#FFFFFF"/>
                  <path d="M15.89,50A2,2,0,0,1,14,47.38l2.22-6.77a18,18,0,1,1,8.69,7.92L16.22,50A1.84,1.84,0,0,1,15.89,50Zm9.28-5.55a2,2,0,0,1,.86.2,14,14,0,1,0-5.94-5.32,2,2,0,0,1,.2,1.67l-1.47,4.48,6-1Z" fill="#FFFFFF"/>
                </svg>
              </a>
              <span className={`${isScrolled ? 'text-white' : 'text-white'}`}>|</span>
              <a href="tel:+79282110249" className={`text-sm font-medium whitespace-nowrap ${isScrolled ? 'text-white' : 'text-white'}`}>
                +7 (928) 211-02-49
              </a>
            </div>

            {/* Burger menu button - right */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`flex items-center gap-2 px-3 py-2 border-2 rounded-md transition-colors ${
                isScrolled ? 'text-white border-white' : 'text-white border-white'
              }`}
              aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="w-5 h-0.5 bg-current block"></span>
                  <span className="w-5 h-0.5 bg-current block"></span>
                  <span className="w-5 h-0.5 bg-current block"></span>
                </div>
              )}
              <span className="text-sm font-medium hidden sm:inline">{isMobileMenuOpen ? 'Закрыть' : 'Меню'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay - black background */}
      <div
        className={`fixed inset-0 z-[60] bg-black transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div className="flex flex-col h-full pt-24 pb-8 px-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            {mobileMenuLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollToSection(link.href)}
                className="text-2xl font-medium text-white hover:text-emerald-400 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Соцсети и телефон - внизу мобильного меню */}
          <div className="flex flex-col items-center gap-4 border-t border-white/10 pt-6">
            <a href="tel:+79282110249" className="text-xl font-semibold text-white hover:text-emerald-400 transition-colors">
              +7 (928) 211-02-49
            </a>
            <div className="flex items-center gap-6">
              <a href="https://t.me/ZVUKILESA01" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-emerald-400 transition-colors" aria-label="Telegram">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              <a href="https://wa.me/79282110249" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-emerald-400 transition-colors" aria-label="WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet">
                  <path d="M23.17,27.05A13.93,13.93,0,0,0,37.08,41h.45a3.47,3.47,0,0,0,3.3-3.48,3.71,3.71,0,0,0-.06-.67,4.6,4.6,0,0,0-.2-.66l-5.86-.93a3.51,3.51,0,0,0-.8,1.77,10.46,10.46,0,0,1-6.69-6.53A3.49,3.49,0,0,0,29,29.67L28,23.86a3.3,3.3,0,0,0-.81-.25,3.64,3.64,0,0,0-.57,0A3.48,3.48,0,0,0,23.17,27.05Z" fill="#FFFFFF"/>
                  <path d="M15.89,50A2,2,0,0,1,14,47.38l2.22-6.77a18,18,0,1,1,8.69,7.92L16.22,50A1.84,1.84,0,0,1,15.89,50Zm9.28-5.55a2,2,0,0,1,.86.2,14,14,0,1,0-5.94-5.32,2,2,0,0,1,.2,1.67l-1.47,4.48,6-1Z" fill="#FFFFFF"/>
                </svg>
              </a>
              <a href="https://instagram.com/zvukilesa01" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-emerald-400 transition-colors" aria-label="Instagram">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
