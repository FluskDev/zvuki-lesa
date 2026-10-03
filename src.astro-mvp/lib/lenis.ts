import Lenis from '@studio-freight/lenis';

let lenis: Lenis | null = null;

export function initLenis() {
  if (lenis) return;
  
  lenis = new Lenis({
    duration: 2.5,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });

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

export function scrollToElement(href: string) {
  const element = document.querySelector(href) as HTMLElement | null;
  if (!element) return;

  const scrollContainer = document.querySelector<HTMLElement>('.snap-scroll-container');
  if (!scrollContainer) {
    // Мобильная версия или другой layout без SnapScroll — нативный скролл ОК.
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // SnapScroll-контейнер: секции по 100vh с overflow: hidden. Любая попытка
  // прицелиться в произвольный offset внутри секции через scrollIntoView /
  // getBoundingClientRect / offsetParent даёт непредсказуемый результат —
  // браузер приземляется на чужую 100vh-границу. Поэтому привязываемся
  // к самой секции: находим её индекс среди всех <section> в контейнере и
  // скроллим ровно на N × высоту вьюпорта. Это совпадает с логикой SnapScroll,
  // и абзац-якорь внутри секции оказывается у верха экрана.
  const sections = Array.from(scrollContainer.querySelectorAll<HTMLElement>('section'));
  const targetSection = sections.find(
    (s) => s === element || (element && s.contains(element)),
  );
  if (!targetSection) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const idx = sections.indexOf(targetSection);
  const viewportHeight = scrollContainer.clientHeight;
  const maxScroll = scrollContainer.scrollHeight - viewportHeight;
  const targetTop = Math.max(0, Math.min(idx * viewportHeight, maxScroll));

  const startTop = scrollContainer.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 2) return;

  const duration = 500;
  const startTime = performance.now();
  const animate = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    scrollContainer.scrollTop = startTop + distance * eased;
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
