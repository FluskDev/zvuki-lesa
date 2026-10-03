import { useEffect, useState } from 'react';
import { Mountain, Phone, Mail, MapPin } from 'lucide-react';
import { seoApi, type SeoPageListItem } from '@/lib/seoApi';

export function Footer() {
  const [topSeo, setTopSeo] = useState<SeoPageListItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    seoApi.list().then((r) => {
      if (cancelled) return;
      const pages = r.success ? r.data.pages : [];
      setTopSeo(pages.filter((p: SeoPageListItem) => p.priority >= 0.8).slice(0, 8));
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <footer className="text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Mountain className="w-6 h-6 text-emerald-400" />
              <span className="text-xl font-bold">Даховская</span>
            </div>
            <p className="text-stone-400 text-sm leading-relaxed">
              Уютные домики в станице Даховская, Республика Адыгея. 
              Идеальное место для отдыха в горах с семьей или друзьями.
              Гостевой дом "Звуки леса" — ваш дом в горах!
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Быстрые ссылки</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li><a href="#cabins" className="hover:text-emerald-400 transition-colors">Наши домики</a></li>
              <li><a href="#services" className="hover:text-emerald-400 transition-colors">Услуги</a></li>
              <li><a href="#about" className="hover:text-emerald-400 transition-colors">О Даховской</a></li>
              <li><a href="#reviews" className="hover:text-emerald-400 transition-colors">Отзывы</a></li>
              <li><a href="#gallery" className="hover:text-emerald-400 transition-colors">Галерея</a></li>
              <li><a href="#contacts" className="hover:text-emerald-400 transition-colors">Контакты</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Контакты</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href="tel:+79282110249" className="hover:text-emerald-400 transition-colors">+7 (928) 211-02-49</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:booking@dakhovskaya.ru" className="hover:text-emerald-400 transition-colors">booking@dakhovskaya.ru</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5" />
                <span>Республика Адыгея, станица Даховская,<br />Короткая улица, 17</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Популярные направления</h4>
            {topSeo.length === 0 ? (
              <p className="text-stone-500 text-sm">Загрузка...</p>
            ) : (
              <ul className="space-y-2 text-sm text-stone-400">
                {topSeo.map((p) => (
                  <li key={p.slug}>
                    <a href={`/seo/${p.slug}`} className="hover:text-emerald-400 transition-colors">{p.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-stone-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-stone-500 text-sm">© 2026 Даховская. Все права защищены.</p>
          <p className="text-stone-600 text-xs">Гостевой дом "Звуки леса" — бронирование домиков в Республике Адыгея</p>
        </div>
      </div>
    </footer>
  );
}
