import Lenis from '@studio-freight/lenis';

let lenis: Lenis | null = null;

export function initLenis() {
  if (lenis) return;

  // lerp 0.2 — баланс между плавностью и отзывчивостью. С lerp 0.1
  // scroll-by-wheel заметно отставал от ввода (Lenis каждый frame
  // догоняет target на 10%, при 60Hz wheel events target двигается
  // быстрее, чем lerp компенсирует — постоянный лаг ~1-2 кадра).
  // С lerp 0.2 отзывчивость на wheel почти нативная, но сохраняется
  // мягкое «дотягивание» scroll-to-anchor и scroll-to-top.
  // duration не используем — даёт «рывки» при нативных scroll events
  // (drag скроллбара, СКМ с авто-прокруткой).
  lenis = new Lenis({
    lerp: 0.2,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
  });

  // При зажатой СКМ браузер показывает стрелки прокрутки и обновляет
  // scroll напрямую — без wheel. Lenis видит это как «внешний» scroll и
  // начинает интерполировать, отсюда дёрганье. Временно отключаем smooth
  // пока кнопка зажата.
  let suppressed = false;
  const suppress = () => {
    if (lenis && !suppressed) {
      lenis.stop();
      suppressed = true;
    }
  };
  const release = () => {
    if (lenis && suppressed) {
      lenis.start();
      suppressed = false;
    }
  };

  window.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      suppress();
      return;
    }
    // Drag скроллбара: mousedown в правой кромке viewport (где лежит
    // стандартный скроллбар в Windows/Linux, ~16–25 px). Без этой заглушки
    // Lenis добавляет инерцию поверх ручного перетаскивания, и тяга
    // «дёргается». На MacOS скроллбар overlay — не мешает.
    const SCROLLBAR_GUESS = 24;
    if (e.clientX > window.innerWidth - SCROLLBAR_GUESS) {
      suppress();
    }
  });
  window.addEventListener('mouseup', release);
  window.addEventListener('mouseleave', release);
  // Если фокус/окно потеряно с зажатой кнопкой — обязательно вернуть Lenis.
  window.addEventListener('blur', release);

  // === Скролл-ловушка для iframe модуля бронирования ===
  // Основная защита — overlay-div над iframe (см. Cabins.tsx +
  // .iframe-scroll-guard в src/index.css): он лежит В DOM родителя,
  // его wheel/touch/key форвардятся в Lenis через window.__lenisScrollBy.
  // pointer-events:none пропускает клики насквозь к iframe.
  //
  // Дополнительно: focusin/mouseover снимают фокус с iframe на случай,
  // если guard-div почему-то не покрывает область (например на мобильных
  // с safe-area, или при resize). Skip в fullscreen-режиме (модалка
  // бронирования — там wheel должен скроллить форму локально).
  const isFullscreenIframe = () =>
    !!document.querySelector('iframe.iframe-fullscreen');
  const blurIframeIfFocused = () => {
    if (isFullscreenIframe()) return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae.tagName === 'IFRAME') {
      ae.blur();
    }
  };
  document.addEventListener(
    'mouseover',
    function (e) {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== 'IFRAME') return;
      blurIframeIfFocused();
    },
    { capture: true },
  );
  document.addEventListener(
    'focusin',
    function (e) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName === 'IFRAME') {
        if (isFullscreenIframe()) return;
        target.blur();
      }
    },
    { capture: true },
  );

  function raf(time: number) {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
}

export function destroyLenis() {
  if (lenis) {
    lenis.destroy();
    lenis = null;
  }
}

export function getLenis() {
  return lenis;
}

/**
 * Скролл родительской страницы на `dy` пикселей. Вызывается из
 * overlay-guard'а над iframe модуля бронирования (Cabins.tsx) — когда
 * курсор попадает в область iframe, Chrome focus-iframe забирает wheel
 * в документ iframe и не пускает в window.parent. Guard-div лежит
 * В DOM родителя, поэтому его wheel/touch/key идут в window.parent и
 * форвардятся сюда через `window.__lenisScrollBy(deltaY)`.
 *
 * Важно: wheel-обработчик в guard делает e.preventDefault() +
 * e.stopPropagation(), поэтому Lenis НЕ получает wheel-событие
 * (Lenis слушает в bubble phase на window) и НЕ запускает свою
 * lerp-анимацию автоматически. Скролл делаем МЫ через scrollTo.
 *
 * Без `immediate: true` — Lenis плавно интерполирует scrollY к новому
 * target'у через lerp (0.2 в initLenis). На 60Hz wheel-событиях target
 * двигается быстрее, чем lerp компенсирует, поэтому scrollY чуть
 * отстаёт от ввода (~1 кадр, лаг незаметен на 60fps). С immediate:true
 * scrollY прыгает мгновенно, без lerp-сглаживания — feel как у обычного
 * browser scroll, теряется «ленесовская» плавность. Поэтому используем
 * обычный scrollTo.
 *
 * Без Lenis (SSR, prerender, до initLenis) — fallback на нативный
 * scrollBy с behavior:'auto'.
 */
if (typeof window !== 'undefined') {
  (window as unknown as { __lenisScrollBy?: (dy: number) => void }).__lenisScrollBy =
    function (dy: number) {
      if (!lenis) {
        window.scrollBy({ top: dy, behavior: 'auto' });
        return;
      }
      const target = window.scrollY + dy;
      lenis.scrollTo(target);
    };
}

/**
 * Плавный скролл к якорю. Если Lenis активен — используем его scrollTo,
 * иначе fallback на нативный smooth scrollIntoView.
 */
export function scrollToElement(href: string) {
  const element = document.querySelector(href) as HTMLElement | null;
  if (!element) return;

  if (lenis) {
    lenis.scrollTo(element, { offset: -0 });
    return;
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
