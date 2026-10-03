import { Phone, Mail, MapPin, Clock, Instagram, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { YandexMap } from '@/components/YandexMap';

export function Contacts() {
  return (
    <section id="contacts" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">Контакты</h2>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">Свяжитесь с нами удобным способом — мы всегда рады помочь</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-800 mb-1">Телефон</h3>
                <a href="tel:+79282110249" className="text-stone-600 hover:text-emerald-600 transition-colors">+7 928 211 0249</a>
                <p className="text-sm text-stone-500 mt-1">Звоните с 9:00 до 21:00</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-800 mb-1">Мессенджеры</h3>
                <div className="flex flex-wrap gap-3">
                  <a href="https://wa.me/79282110249" target="_blank" rel="noopener noreferrer" className="text-stone-600 hover:text-emerald-600 transition-colors underline decoration-emerald-600/30 hover:decoration-emerald-600">WhatsApp</a>
                  <span className="text-stone-400">•</span>
                  <a href="https://t.me/+79282110249" target="_blank" rel="noopener noreferrer" className="text-stone-600 hover:text-emerald-600 transition-colors underline decoration-emerald-600/30 hover:decoration-emerald-600">Telegram</a>
                </div>
                <p className="text-sm text-stone-500 mt-1">Пишите в любое время</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-800 mb-1">Email</h3>
                <a href="mailto:booking@dakhovskaya.ru" className="text-stone-600 hover:text-emerald-600 transition-colors">booking@dakhovskaya.ru</a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-800 mb-1">Адрес</h3>
                <p className="text-stone-600">Республика Адыгея, Майкопский район,<br />станица Даховская, Короткая улица, 17</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-800 mb-1">Режим работы</h3>
                <p className="text-stone-600">Работаем круглосуточно</p>
                <p className="text-sm text-stone-500 mt-1">Заезд в 14:00, выезд в 12:00</p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <a href="https://www.instagram.com/zvukilesa01/" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="rounded-full w-12 h-12 p-0"><Instagram className="w-5 h-5" /></Button>
              </a>
              <a href="https://t.me/ZVUKILESA01" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="rounded-full w-12 h-12 p-0"><Send className="w-5 h-5" /></Button>
              </a>
            </div>
          </div>

<div className="bg-white rounded-2xl overflow-hidden shadow-lg h-96 lg:h-auto min-h-[400px] p-4">
            <YandexMap center={[44.223140, 40.199615]} zoom={16} height="100%" width="100%" />
          </div>
        </div>
      </div>
    </section>
  );
}
