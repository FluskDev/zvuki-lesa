import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  src: string;
  alt: string;
  fallbackAlt?: string;
}

interface ImageRow {
  path: string;
  alt: string;
}

/**
 * Обёртка над <img> с акцентом на SEO и доступность:
 * - дефолтный loading="lazy";
 * - dev-предупреждение, если alt пустой;
 * - если src указывает на загруженный файл из /uploads/ и передан fallbackAlt,
 *   SeoImage попробует подтянуть человекочитаемый alt из реестра /api/images.
 */
export function SeoImage({ src, alt, fallbackAlt, ...rest }: Props) {
  const [resolvedAlt, setResolvedAlt] = useState(alt);

  useEffect(() => {
    if (src.startsWith('/uploads/') && fallbackAlt !== undefined) {
      apiFetch<ImageRow[]>('/images')
        .then(r => {
          const found = r.success ? r.data.find(img => img.path === src) : undefined;
          if (found) setResolvedAlt(found.alt);
        })
        .catch(() => {});
    }
  }, [src, fallbackAlt]);

  useEffect(() => {
    if (!alt && import.meta.env.DEV) {
      console.warn(`[SeoImage] Missing alt for src=${src}`);
    }
  }, [alt, src]);

  return <img src={src} alt={resolvedAlt} loading={rest.loading ?? 'lazy'} {...rest} />;
}