import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RC_BOOKING_URL } from '@/lib/bookingRedirect';
import type { MouseEvent } from 'react';

export interface BookingCTAProps {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  className?: string;
  /**
   * Если передан — клик НЕ открывает RealtyCalendar в новой вкладке,
   * а вызывает этот handler. Используется StickyFooter: пользователь
   * остаётся на странице и плавно скроллится к секции #cabins, где
   * уже встроен iframe-виджет бронирования.
   * При наличии onClick рендер превращается во «внутренний якорь»:
   *   • href по умолчанию → '#cabins' (можно переопределить через
   *     одноимённый проп `href`)
   *   • target/rel снимаются
   *   • нативный переход по якорю не сработает — кликер обычно
   *     делает e.preventDefault() и вызывает scrollToElement()
   *     руками, чтобы получить плавный Lenis-скролл.
   */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /**
   * Override для href. По умолчанию:
   *   • если есть `onClick` → '#cabins'
   *   • иначе → RC_BOOKING_URL (откроется в новой вкладке)
   */
  href?: string;
}

/**
 * Единая CTA-кнопка бронирования.
 * По умолчанию ведёт на RealtyCalendar в новой вкладке.
 * Если передан `onClick` (или свой `href`) — становится «внутренним
 * якорем»: href='#cabins' (или override), target/rel снимаются.
 * Используется во всех точках сайта вместо локальных форм.
 */
export function BookingCTA({
  variant = 'default',
  size = 'default',
  label = 'Забронировать',
  className,
  onClick,
  href,
}: BookingCTAProps) {
  // Внутренний режим активируется любым из двух пропов. Если оба не
  // заданы — дефолтное поведение (внешняя ссылка в новой вкладке).
  const isInternal = !!onClick || !!href;
  const finalHref = href ?? (onClick ? '#cabins' : RC_BOOKING_URL);
  return (
    <a
      href={finalHref}
      target={isInternal ? undefined : '_blank'}
      rel={isInternal ? undefined : 'noopener noreferrer'}
      onClick={onClick}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {label}
    </a>
  );
}
