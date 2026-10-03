import { useState, useEffect } from 'react';
import './SiteMap.css';

/**
 * Просто статичная карта участка. Загружает `/maps.svg` и рисует его
 * как есть — без кликов, без модалок, без подсветок. Бэкап интерактивной
 * версии лежит в `_backup/SiteMap.tsx.pre-staticmap`.
 */
export function SiteMap() {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    fetch('/maps.svg')
      .then((res) => res.text())
      .then(setSvg)
      .catch(console.error);
  }, []);

  if (!svg) {
    return <div className="w-full h-full bg-white/5 animate-pulse" />;
  }

  return (
    <div
      className="w-full h-full site-map-container"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
