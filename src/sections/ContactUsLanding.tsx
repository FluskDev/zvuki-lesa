import { MapPin, Phone, Mail, Send } from 'lucide-react';
import { YandexMap } from '@/components/YandexMap';

// Прямые контакты гостевого дома. Раньше тут была форма, которая POST'ила на
// /api/contact — после удаления backend (Task 2.5) этот POST уходит в 404
// (Vite SPA-fallback HTML), JSON.parse падает, гость видит
// «Произошла ошибка. Попробуйте позже» при каждой попытке отправить.
// Решение: заменили форму на прямые CTA — звонок (нативный tel: на мобиле
// открывает набор), email, Telegram, WhatsApp. Те же каналы, что и в Footer.
const PHONE_DISPLAY = '+7 (928) 211-02-49';
const PHONE_TEL = 'tel:+79282110249';
const EMAIL = 'booking@zvuki-lesa.ru';
const EMAIL_HREF = 'mailto:booking@zvuki-lesa.ru';
const TELEGRAM_HREF = 'https://t.me/ZVUKILESA01';
const WHATSAPP_HREF = 'https://wa.me/79282110249';

export function ContactUsLanding() {
  return (
    <section id="contact-us" className="min-h-screen lg:h-screen bg-[#141414] flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-24">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 lg:gap-16 items-center">
          {/* Left Column - Contact CTA */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
                Свяжитесь с нами
              </h1>
              <p className="text-lg sm:text-xl text-stone-400 max-w-lg">
                Позвоните или напишите — отвечаем в течение пяти минут в рабочее время и
                в течение часа ночью
              </p>
            </div>

            {/* Главный CTA — звонок */}
            <a
              href={PHONE_TEL}
              className="group flex items-center gap-4 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 hover:border-emerald-700/60 rounded-2xl px-6 py-5 transition-all duration-200"
              aria-label={`Позвонить: ${PHONE_DISPLAY}`}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-900/30 text-emerald-400 group-hover:bg-emerald-800/40 transition-colors">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Позвонить</div>
                <div className="text-2xl sm:text-3xl font-semibold text-white tabular-nums">
                  {PHONE_DISPLAY}
                </div>
              </div>
            </a>

            {/* Email, Telegram, WhatsApp */}
            <div className="grid sm:grid-cols-3 gap-3">
              <a
                href={EMAIL_HREF}
                className="group flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 hover:border-emerald-700/60 rounded-xl px-4 py-5 transition-all duration-200 text-center"
                aria-label={`Написать на email: ${EMAIL}`}
              >
                <Mail className="w-5 h-5 text-stone-400 group-hover:text-emerald-400 transition-colors" />
                <span className="text-xs text-stone-500">Email</span>
                <span className="text-sm text-white font-medium break-all">{EMAIL}</span>
              </a>

              <a
                href={TELEGRAM_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 hover:border-emerald-700/60 rounded-xl px-4 py-5 transition-all duration-200 text-center"
                aria-label="Написать в Telegram"
              >
                <Send className="w-5 h-5 text-stone-400 group-hover:text-emerald-400 transition-colors" />
                <span className="text-xs text-stone-500">Telegram</span>
                <span className="text-sm text-white font-medium">@ZVUKILESA01</span>
              </a>

              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 hover:border-emerald-700/60 rounded-xl px-4 py-5 transition-all duration-200 text-center"
                aria-label="Написать в WhatsApp"
              >
                <svg
                  className="w-5 h-5 text-stone-400 group-hover:text-emerald-400 transition-colors"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
                <span className="text-xs text-stone-500">WhatsApp</span>
                <span className="text-sm text-white font-medium">Написать</span>
              </a>
            </div>

            <div className="border-t border-stone-800 pt-8">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
                <p className="text-stone-400 text-sm leading-relaxed">
                  ул. Короткая, 17, ст-ца Даховская, Республика Адыгея, 385792
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Map */}
          <div className="flex flex-col items-center lg:items-end pb-8 lg:pb-0">
            <div className="relative w-full max-w-[400px] aspect-square">
              {/* Decorative glow */}
              <div className="absolute inset-0 bg-gradient-radial from-emerald-900/20 via-transparent to-transparent rounded-full blur-xl" />

              {/* Circular map container */}
              <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-stone-800 shadow-2xl shadow-emerald-900/10">
                <YandexMap
                  center={[44.223140, 40.199615]}
                  zoom={16}
                  width="100%"
                  height="100%"
                />
              </div>

              {/* Decorative ring */}
              <div className="absolute inset-0 rounded-full border border-stone-800 pointer-events-none" />
            </div>

            {/* Novera Studio credit below map */}
            <div className="mt-6">
              <a
                href="https://novera-studio.ru"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-stone-500 hover:text-emerald-400 transition-colors text-xs"
                aria-label="Сделано в NOVERA Studio — перейти на novera-studio.ru"
              >
                {/* Логотип NOVERA */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <rect width="32" height="32" rx="10" fill="currentColor" />
                  <path d="M9 22V10l14 12V10" stroke="white" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Сделано в <span className="font-semibold">NOVERA</span> Studio</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
      `}</style>
    </section>
  );
}
