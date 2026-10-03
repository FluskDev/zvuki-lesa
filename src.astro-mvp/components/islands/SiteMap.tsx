import { useEffect, useState } from 'react';
import './SiteMap.css';

interface CottageRef {
  id: string;
  mapId: string;
  name: string;
}

export default function SiteMap() {
  const [cottages, setCottages] = useState<CottageRef[]>([]);
  const [selected, setSelected] = useState<CottageRef | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cottages')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data = json?.data ?? [];
        setCottages(data);
      })
      .catch(() => {
        // fallback empty list
      });
    return () => { cancelled = true; };
  }, []);

  // Placeholder: simple grid map. Real implementation would render maps.svg with hotspots.
  return (
    <div className="relative w-full max-w-4xl mx-auto p-4">
      <h3 className="text-center text-2xl font-bold text-white mb-4">Карта расположения</h3>
      <div className="relative aspect-[16/10] bg-stone-800 rounded-2xl overflow-hidden border border-stone-700">
        <div className="absolute inset-0 flex items-center justify-center text-stone-500 text-sm">
          Карта территории
        </div>
        {cottages.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="absolute w-10 h-10 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
            style={{
              left: `${20 + idx * 15}%`,
              top: `${30 + idx * 10}%`,
            }}
            aria-label={c.name}
          >
            {c.mapId}
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-xl font-bold text-white mb-4">{selected.name}</h4>
            <a
              href={`/booking/${selected.id}`}
              className="block w-full text-center bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-5 py-2 rounded-md transition-colors"
            >
              Забронировать
            </a>
            <button onClick={() => setSelected(null)} className="mt-3 w-full text-stone-400 hover:text-white">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
