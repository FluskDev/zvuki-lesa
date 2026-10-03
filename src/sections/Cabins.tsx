import { useEffect, useRef, useState } from 'react';
import { TreePine, Phone, MessageCircle, Send, Mail } from 'lucide-react';

// Раньше в этой секции рендерились собственные карточки домиков
// (MiniCabinCard + DraggableContainer). После того как homereserve.ru дал
// готовый виджет списка объектов, карточки убраны — дублирование и
// рассинхрон. Виджет сам показывает оба домика с актуальными ценами.
//
// Текущая реализация — iframe + reverse proxy:
//   - iframe src="/hr-widget-loader.html" (статика в public/)
//   - внутри iframe живёт <div id="hr-widget"> + initWidgetList
//   - все запросы к homereserve.ru идут через /hr-widget/*:
//       dev  : vite proxy       → https://homereserve.ru
//       prod : Apache ProxyPass → https://homereserve.ru
//   - это обходит гео-блок homereserve.ru: пользователю отдаётся
//     виджет, загруженный с нашего российского сервера.
//
// Fallback в этой компоненте остался на случай, если iframe пустой:
// VPN на dev (proxy идёт с IP разработчика), outage homereserve.ru,
// медленная сеть — пользователь увидит прямые контакты через 8с.
const HR_WIDGET_LOAD_TIMEOUT_MS = 8000;
const HR_IFRAME_SRC = '/hr-widget-loader.html';

const PHONE_DISPLAY = '+7 (928) 211-02-49';
const PHONE_TEL = 'tel:+79282110249';
const WHATSAPP_HREF = 'https://wa.me/79282110249';
const TELEGRAM_HREF = 'https://t.me/ZVUKILESA01';
const EMAIL_HREF = 'mailto:booking@zvuki-lesa.ru';

type WidgetState = 'idle' | 'loading' | 'ready' | 'failed';

function WidgetLoader() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-white/60"
      role="status"
      aria-live="polite"
      aria-label="Загрузка модуля бронирования"
    >
      <TreePine className="w-10 h-10 mb-3 text-emerald-400 animate-pulse" />
      <p>Загружаем модуль бронирования…</p>
    </div>
  );
}

function WidgetFallback() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2">
          Забронировать домик
        </h3>
        <p className="text-sm sm:text-base text-white/60">
          Онлайн-модуль временно недоступен. Свяжитесь с нами напрямую —
          отвечаем в течение пяти минут в рабочее время.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <a
          href={PHONE_TEL}
          className="group flex items-center gap-3 bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-4 transition-colors"
          aria-label={`Позвонить: ${PHONE_DISPLAY}`}
        >
          <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-white/50">Позвонить</div>
            <div className="text-white font-semibold tabular-nums truncate">
              {PHONE_DISPLAY}
            </div>
          </div>
        </a>

        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-4 transition-colors"
          aria-label="Написать в WhatsApp"
        >
          <MessageCircle className="w-5 h-5 text-white/80 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-white/50">WhatsApp</div>
            <div className="text-white font-semibold truncate">Написать</div>
          </div>
        </a>

        <a
          href={TELEGRAM_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-4 transition-colors"
          aria-label="Написать в Telegram"
        >
          <Send className="w-5 h-5 text-white/80 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-white/50">Telegram</div>
            <div className="text-white font-semibold truncate">@ZVUKILESA01</div>
          </div>
        </a>

        <a
          href={EMAIL_HREF}
          className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-4 transition-colors"
          aria-label="Написать на email"
        >
          <Mail className="w-5 h-5 text-white/80 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-white/50">Email</div>
            <div className="text-white font-semibold truncate">
              booking@zvuki-lesa.ru
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

export function Cabins() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const guardRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<WidgetState>('idle');

  useEffect(() => {
    // intersection-based lazy init: пока iframe вне viewport, не загружаем.
    // На проде iframe = /hr-widget-loader.html (статика), но он дёргает
    // /hr-widget/widget.js через proxy — поэтому держим lazy-load.
    const el = iframeRef.current;
    if (!el) return;

    setState('loading');
    const startedAt = Date.now();
    const timeoutId = window.setTimeout(() => {
      setState((prev) => (prev === 'loading' ? 'failed' : prev));
    }, HR_WIDGET_LOAD_TIMEOUT_MS);

    const handleLoad = () => {
      window.clearTimeout(timeoutId);
      setState((prev) => {
        // Если iframe уже пометили failed по таймауту, а он потом всё же
        // догрузился — оставляем failed (пользователю уже показали
        // контакты, лучше не дёргать UI).
        if (prev === 'failed') return prev;
        return 'ready';
      });
    };

    el.addEventListener('load', handleLoad);

    // postMessage из iframe (см. hr-widget-loader.html): когда виджет
    // открывает/закрывает модалку бронирования, разворачиваем iframe
    // на весь viewport родителя. Иначе модалка внутри iframe не выйдет
    // за пределы контейнера #cabins.
    const handleMessage = (e: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || e.source !== iframe.contentWindow) return;
      const data = e.data as { type?: string; open?: boolean } | null;
      if (!data || data.type !== 'hr-modal-state') return;
      if (data.open) {
        iframe.classList.add('iframe-fullscreen');
        // В fullscreen режиме скрываем guard-overlay — модалка
        // должна ловить wheel/touch/key локально для прокрутки формы.
        if (guardRef.current) guardRef.current.style.display = 'none';
      } else {
        iframe.classList.remove('iframe-fullscreen');
        if (guardRef.current) guardRef.current.style.display = '';
      }
    };
    window.addEventListener('message', handleMessage);

    // === Overlay-guard над iframe ===
    // Задача guard'а — быть прозрачным прокси между курсором и iframe.
    // С CSS pointer-events:auto guard перехватывает pointer-events, но
    // wheel/touch/key — это НЕ pointer events в смысле pointer-events
    // CSS-свойства (оно про mouse/pen/touch hit-testing). wheel/touch
    // идут в guard как в обычный DOM-элемент и БАББЛЯТСЯ до window —
    // там Lenis их ловит и применяет свою lerp-интерполяцию (0.2).
    //
    // Почему не делаем свой wheel/touch listener в guard:
    //   1) Lenis — единственный «правильный» источник истины для scroll.
    //      Свой listener дублирует логику и порождает рассинхрон:
    //      scrollTo(target) на каждом wheel'е отменяет предыдущую
    //      lerp-анимацию, target двигается быстрее чем Lenis догоняет —
    //      пользователь видит медленный/дёрганый скролл.
    //   2) Вне iframe Lenis ловит wheel на window — там плавно. Над
    //      iframe та же логика должна работать идентично, иначе feel
    //      «разный» в разных местах страницы.
    //
    // iframe не получает wheel/touch потому что target = guard (DOM
    // родителя, z-index выше iframe), default action = scroll nearest
    // scrollable ancestor = документ. iframe — sibling, не ancestor.
    // Lenis preventDefault'ит wheel и скроллит через свой RAF.
    //
    // === Клик-форвардер в iframe ===
    // pointer-events:auto блокирует нативный клик в iframe. Ловим
    // pointerdown на guard, программно находим элемент под точкой
    // клика В ДОКУМЕНТЕ iframe через elementFromPoint, диспатчим
    // click + mousedown + mouseup. Так карточки домиков остаются
    // кликабельными, а скролл родителя работает.
    //
    // === keydown ===
    // Lenis не обрабатывает keydown (PageDown/Arrow/Space). Если
    // iframe сфокусирован, key target = iframe.contentWindow — событие
    // НЕ пересекает границу iframe в bubble phase, поэтому listener
    // на guard его не видит. Поэтому слушаем keydown на window (capture
    // phase — раньше Lenis, чтобы preventDefault не дал ему среагировать
    // на Space/Arrow, и чтобы сам Lenis не интерпретировал Space как
    // wheelMultiplier). Skip: когда iframe в fullscreen (модалка
    // бронирования — там keydown должен работать локально для формы).
    const guard = guardRef.current;
    const guardKey = (e: KeyboardEvent) => {
      // fullscreen-режим: модалка должна получать keydown локально
      const ifr = iframeRef.current;
      if (ifr && ifr.classList.contains('iframe-fullscreen')) return;
      const STEP = 80;
      let dy = 0;
      switch (e.key) {
        case 'PageDown': dy = STEP * 3; break;
        case 'PageUp':   dy = -STEP * 3; break;
        case ' ':
        case 'ArrowDown': dy = STEP; break;
        case 'ArrowUp':   dy = -STEP; break;
        case 'Home':      dy = -100000; break;
        case 'End':       dy = 100000; break;
        default: return;
      }
      e.preventDefault();
      if (typeof window.__lenisScrollBy === 'function') {
        window.__lenisScrollBy(dy);
      } else {
        window.scrollBy({ top: dy, behavior: 'auto' });
      }
    };
    const guardPointerDown = (e: PointerEvent) => {
      const ifr = iframeRef.current;
      if (!ifr || !ifr.contentWindow || !ifr.contentDocument) return;
      if (e.button !== 0) return;
      const rect = ifr.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const doc = ifr.contentDocument;
      let target: Element | null = null;
      try {
        target = doc.elementFromPoint(x, y);
      } catch {
        return;
      }
      if (!target) return;
      if (target === doc.documentElement || target === doc.body) return;
      e.preventDefault();
      e.stopPropagation();
      const evt = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: ifr.contentWindow,
        clientX: x,
        clientY: y,
        button: 0,
      });
      target.dispatchEvent(evt);
      const md = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: ifr.contentWindow,
        clientX: x,
        clientY: y,
        button: 0,
      });
      const mu = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: ifr.contentWindow,
        clientX: x,
        clientY: y,
        button: 0,
      });
      target.dispatchEvent(md);
      target.dispatchEvent(mu);
      const tag = target.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        try {
          (target as HTMLInputElement).focus();
        } catch {
          /* noop — inputs disabled/readonly бросят focus() */
        }
      }
    };
    if (guard) {
      guard.addEventListener('pointerdown', guardPointerDown);
    }
    // keydown слушаем на window — guard не получает key от iframe
    // (key не пересекает границу iframe в bubble phase). Capture:false
    // (bubble) — пусть сначала отработают другие обработчики (Radix,
    // формы), если активны — они могут preventDefault и наш код не
    // запустится, что и нужно.
    window.addEventListener('keydown', guardKey);

    return () => {
      el.removeEventListener('load', handleLoad);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', guardKey);
      window.clearTimeout(timeoutId);
      if (guard) {
        guard.removeEventListener('pointerdown', guardPointerDown);
      }
      // debug-only: фиксируем время загрузки для будущей диагностики
      if (import.meta.env.DEV && state !== 'ready') {
        console.debug(
          `[cabins] iframe unmounted after ${Date.now() - startedAt}ms, state=${state}`,
        );
      }
    };
    // state намеренно не в deps — нужен текущий снимок только в cleanup,
    // пересчёт эффекта на смене state привёл бы к отписке/подписке зря.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="cabins" className="min-h-screen flex items-center py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Наши домики
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Выберите идеальное место для вашего отдыха в горах Адыгеи
          </p>
        </div>

        <div className="overflow-visible min-h-[400px] relative">
          {/* Iframe с виджетом RealtyCalendar. Виджет сам рендерит оба домика
              с ценами/свободными датами. Лоадер показывается до onload;
              fallback-кнопки — если homereserve.ru не ответил за 8с
              (VPN на dev, outage на проде, медленная сеть). */}
          <iframe
            ref={iframeRef}
            src={HR_IFRAME_SRC}
            title="Бронирование домиков"
            loading="lazy"
            className="w-full min-h-[600px] border-0 rounded-2xl"
            style={{ display: state === 'failed' ? 'none' : 'block' }}
          />

          {/* Overlay-guard: прозрачный div НАД iframe. CSS pointer-events:auto
              в src/index.css (.iframe-scroll-guard) — guard должен ловить
              wheel/touch/key и форвардить в window родителя → в Lenis
              (см. обработчики в useEffect выше). С pointer-events:none
              wheel/touch тоже прошли бы насквозь к iframe и Chrome
              focus-iframe забрал бы их — поэтому pointer-events:auto.
              Клики тоже блокируются pointer-events:auto — но guard их
              программно пересылает в iframe через elementFromPoint +
              dispatchEvent('click') (см. guardPointerDown в useEffect
              выше). Так карточки домиков остаются кликабельными, а
              скролл родителя при этом работает. Без всего этого Chrome
              focus-iframe забирает wheel внутрь документа iframe и
              страница родителя стоит. Когда модалка бронирования открыта
              (iframe-fullscreen), guard скрывается через style.display='none'
              — модалка должна скроллиться локально. */}
          <div
            ref={guardRef}
            className="iframe-scroll-guard"
            aria-hidden="true"
          />

          {state === 'loading' && (
            <div className="mt-6">
              <WidgetLoader />
            </div>
          )}
          {state === 'failed' && (
            <div className="mt-6">
              <WidgetFallback />
            </div>
          )}

          <noscript>
            <div className="flex flex-col items-center py-12 text-white/60">
              <TreePine className="w-10 h-10 mb-3 text-emerald-400" />
              <p>Включите JavaScript для просмотра домиков и бронирования.</p>
              <a
                href={PHONE_TEL}
                className="mt-4 text-emerald-400 hover:text-emerald-300 underline"
              >
                {PHONE_DISPLAY}
              </a>
            </div>
          </noscript>
        </div>
      </div>
    </section>
  );
}
