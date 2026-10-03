import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Аватар автора отзыва.
 *
 * Если есть avatarUrl — рисуем webp с бэкенда.
 * Иначе — круг с инициалом автора, цвет детерминирован из имени
 * (один автор = один цвет на всех страницах).
 */
export function ReviewAvatar({
  src,
  name,
  size = 40,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const px = `${size}px`;
  const useImg = src && !errored;
  const initials = name.trim().slice(0, 1).toUpperCase() || '?';
  const bg = colorFromName(name);
  const textColor = 'white';

  if (useImg) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        className={cn('rounded-full object-cover shrink-0 ring-1 ring-black/10', className)}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold select-none shrink-0 ring-1 ring-black/10',
        className,
      )}
      style={{ width: px, height: px, background: bg, color: textColor, fontSize: Math.round(size * 0.42) }}
    >
      {initials}
    </span>
  );
}

/**
 * Детерминированный HSL-цвет: одинаковое имя → одинаковый круг на всех страницах.
 * Мягкие тона (45-75% lightness, 55% saturation) — не выжигает глаз, не "плоский".
 */
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 55% 55%)`;
}
