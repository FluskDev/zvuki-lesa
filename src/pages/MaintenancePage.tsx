import { Construction, MapPin, Mail, Phone, Send } from 'lucide-react';
import { useDocumentHead } from '@/lib/seo';

/**
 * Временная заглушка главной страницы: «ведутся технические работы».
 *
 * Онтлайн-бронирование на время работ недоступно, поэтому единственный
 * сценарий — бронирование по телефону. Номер и остальные контакты дублируются
 * из ContactUsLanding/Footer.
 *
 * Страница noindex — временную заглушку не нужно индексировать,
 * но follow оставляем, чтобы поисковики не «потеряли» остальные разделы сайта.
 */
const PHONE_DISPLAY = '+7 (928) 211-02-49';
const PHONE_TEL = 'tel:+79282110249';
const EMAIL = 'booking@zvuki-lesa.ru';
const EMAIL_HREF = 'mailto:booking@zvuki-lesa.ru';
const TELEGRAM_HREF = 'https://t.me/ZVUKILESA01';
const WHATSAPP_HREF = 'https://wa.me/79282110249';

export function MaintenancePage() {
  useDocumentHead({
    title: 'Звуки Леса — ведутся технические работы',
    description:
      'Сайт гостевого дома «Звуки Леса» временно на технических работах. Бронирование — по телефону +7 (928) 211-02-49.',
    canonical: 'https://zvuki-lesa.ru/',
    robots: 'noindex, follow',
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#141414] text-stone-100 select-text">
      <header className="border-b border-stone-800/60">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <img
            src="/favicon.svg"
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-lg"
          />
          <span className="text-lg sm:text-xl font-semibold tracking-tight text-white">
            Звуки Леса
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs sm:text-sm font-medium uppercase tracking-wider text-amber-300">
              <Construction className="w-4 h-4" aria-hidden="true" />
              Технические работы
            </span>

            <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Сайт на технических работах
            </h1>

            <p className="mt-4 text-base sm:text-lg text-stone-400 leading-relaxed">
              Мы обновляем сайт гостевого дома «Звуки Леса». Он вернётся совсем скоро, а пока
              бронирование работает — позвоните нам, и мы забронируем домик и всё необходимое
              для отдыха.
            </p>

            {/* Главный CTA — бронирование по телефону */}
            <a
              href={PHONE_TEL}
              aria-label={`Позвонить и забронировать: ${PHONE_DISPLAY}`}
              className="group mt-8 flex items-center gap-4 rounded-2xl border border-emerald-700/40 bg-emerald-900/20 hover:bg-emerald-900/30 hover:border-emerald-600/60 transition-all duration-200 px-6 py-5"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25 transition-colors shrink-0">
                <Phone className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">
                  Бронирование по телефону
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-white tabular-nums">
                  {PHONE_DISPLAY}
                </div>
              </div>
            </a>

            {/* Дополнительные каналы связи */}
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Написать в WhatsApp"
                className="group flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 hover:border-emerald-700/60 rounded-xl px-4 py-5 transition-all duration-200 text-center"
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

              <a
                href={TELEGRAM_HREF}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Написать в Telegram"
                className="group flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 hover:border-emerald-700/60 rounded-xl px-4 py-5 transition-all duration-200 text-center"
              >
                <Send
                  className="w-5 h-5 text-stone-400 group-hover:text-emerald-400 transition-colors"
                  aria-hidden="true"
                />
                <span className="text-xs text-stone-500">Telegram</span>
                <span className="text-sm text-white font-medium">@ZVUKILESA01</span>
              </a>

              <a
                href={EMAIL_HREF}
                aria-label={`Написать на email: ${EMAIL}`}
                className="group flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 hover:border-emerald-700/60 rounded-xl px-4 py-5 transition-all duration-200 text-center"
              >
                <Mail
                  className="w-5 h-5 text-stone-400 group-hover:text-emerald-400 transition-colors"
                  aria-hidden="true"
                />
                <span className="text-xs text-stone-500">Email</span>
                <span className="text-sm text-white font-medium break-all">{EMAIL}</span>
              </a>
            </div>

            <div className="mt-10 border-t border-stone-800 pt-6">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-stone-400 text-sm leading-relaxed">
                  ул. Короткая, 17, ст-ца Даховская, Республика Адыгея, 385792
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-stone-800/60">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-sm text-stone-500">
          Гостевой дом «Звуки Леса» · станица Даховская, Адыгея
        </div>
      </footer>
    </div>
  );
}
