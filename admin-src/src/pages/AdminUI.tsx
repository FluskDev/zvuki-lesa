import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Variant = 'published' | 'draft' | 'new' | 'confirmed' | 'cancelled' | 'neutral';

const STYLES: Record<Variant, string> = {
  published: 'bg-emerald-950/60 text-emerald-300 border-emerald-900',
  confirmed: 'bg-emerald-950/60 text-emerald-300 border-emerald-900',
  draft: 'bg-amber-950/60 text-amber-300 border-amber-900',
  new: 'bg-sky-950/60 text-sky-300 border-sky-900',
  cancelled: 'bg-neutral-900 text-neutral-400 border-neutral-800 line-through',
  neutral: 'bg-neutral-900 text-neutral-300 border-neutral-800',
};

interface Props {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
}

/**
 * Единый бейдж статуса: «Опубл.», «Черновик», «Новая», «Подтв.», «Отменена».
 * Тёмная тема + мягкие тональные заливки — лучше читаются чем сплошной fill.
 */
export function StatusBadge({ variant, children, className }: Props) {
  return (
    <Badge variant="outline" className={cn('font-normal text-xs', STYLES[variant], className)}>
      {children}
    </Badge>
  );
}

/**
 * Скелетон-строки для таблиц. Используется во время загрузки списков.
 */
export function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-neutral-800">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-neutral-900 rounded animate-pulse" style={{ width: `${60 + ((i * 17) % 40)}%` }} />
        </td>
      ))}
    </tr>
  );
}