import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookingCTA } from '@/components/BookingCTA/BookingCTA';
import { scrollToElement } from '@/lib/lenis';
import styles from './StickyFooter.module.css';

export function StickyFooter() {
  const [cabinsVisible, setCabinsVisible] = useState(false);

  // На секции домиков нижняя кнопка «Забронировать» уже есть в каждой
  // карточке — дублировать её в StickyFooter там не нужно.
  // Секция Cabins подгружается через React.lazy, поэтому на момент маунта
  // #cabins может ещё не быть в DOM — ловим появление через MutationObserver
  // и только тогда запускаем IntersectionObserver.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;

    const observe = () => {
      const el = document.getElementById('cabins');
      if (!el) return false;
      io = new IntersectionObserver(
        ([entry]) => setCabinsVisible(entry.isIntersecting),
        { threshold: 0.25 },
      );
      io.observe(el);
      return true;
    };

    if (!observe()) {
      mo = new MutationObserver(() => {
        if (observe() && mo) {
          mo.disconnect();
          mo = null;
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      io?.disconnect();
      mo?.disconnect();
    };
  }, []);

  // Рендерим в document.body через createPortal, чтобы вырваться из родительских
  // stacking contexts (кнопка должна быть поверх остального контента).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles['booker-tray-viewport']}
      hidden={cabinsVisible}
      data-sticky-footer-clickable
    >
      <div className={styles.container}>
        <div className={styles['footer-body']}>
          <BookingCTA
            variant="default"
            size="lg"
            className={styles['footer-cta']}
            onClick={(e) => {
              // Плавный Lenis-скролл к секции домиков, где живёт
              // iframe с модулем бронирования. preventDefault останавливает
              // нативный «прыжок» по якорю — без него браузер быстро
              // переставит scrollY в позицию #cabins и Lenis не успеет
              // включить анимацию. href='#cabins' остаётся в DOM как
              // fallback для no-JS / скринридеров / mid-click F5.
              e.preventDefault();
              scrollToElement('#cabins');
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
