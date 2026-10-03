import { useEffect, useRef, useState } from 'react';
import './AdminSiteMapPicker.css';
import { listAdminCottages, type AdminCottageSummary } from '@/lib/adminApi';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EDITABLE_MAP_IDS = ['Домик1', 'Домик2', 'Домик3'] as const;
const ID_SELECTOR = EDITABLE_MAP_IDS.map((id) => `g[id="_${id}"]`).join(', ');

interface AdminSiteMapPickerProps {
  /** Текущая привязка (null = домик не привязан к точке на карте). */
  value: string | null;
  onChange: (mapId: string | null) => void;
  /** id редактируемого домика — его собственная mapId не считается «занятой». */
  currentCottageId?: number;
}

export function AdminSiteMapPicker({ value, onChange, currentCottageId }: AdminSiteMapPickerProps) {
  const [svg, setSvg] = useState<string>('');
  const [allCottages, setAllCottages] = useState<AdminCottageSummary[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Зафиксированный колбэк — стабильная ссылка для listener'а. */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    fetch('/maps.svg')
      .then((res) => res.text())
      .then((text) => {
        if (!cancelled) setSvg(text);
      })
      .catch(console.error);

    listAdminCottages()
      .then((res) => {
        if (!cancelled && res.success) setAllCottages(res.data.cottages);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!svg) return;
    const container = containerRef.current;
    if (!container) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const group = target.closest(ID_SELECTOR);
      if (!group) return;
      // Клики по занятым другим домикам точкам заблокированы — это сделано
      // чтобы UX сразу показывал конфликт, а не получать ошибку на сохранении.
      if (group.classList.contains('map-occupied')) return;
      const id = group.id.replace(/^_/, '');
      if (id && (EDITABLE_MAP_IDS as readonly string[]).includes(id)) {
        onChangeRef.current(id);
      }
    };
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
    // Listener вешается ОДИН раз при загрузке SVG и больше не пересоздаётся,
    // потому что onChangeRef обновляется на каждом рендере и всегда свежий.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svg) return;

    // Снимаем прошлые подсветки.
    container.querySelectorAll('.map-highlight, .map-occupied').forEach((el) => {
      el.classList.remove('map-highlight', 'map-occupied');
    });
    // Чистим и ранее вставленные title'ы, чтобы не плодить.
    container.querySelectorAll('title[data-mapid-tooltip]').forEach((el) => el.remove());

    if (value) {
      const group = container.querySelector(`g[id="_${value}"]`);
      if (group) group.classList.add('map-highlight');
    }

    // Точки, занятые другими домиками — красная обводка + клик-блок.
    // Собственная mapId текущего домика (currentCottageId) исключается.
    const occupiedByCottage = new Map<string, AdminCottageSummary>();
    for (const c of allCottages) {
      if (currentCottageId !== undefined && c.id === currentCottageId) continue;
      // Домики без привязки (mapId=null) намеренно пропускаем — они не занимают точку на карте.
      if (!c.mapId) continue;
      occupiedByCottage.set(c.mapId, c);
    }
    for (const [mapId, cottage] of occupiedByCottage) {
      const group = container.querySelector(`g[id="_${mapId}"]`);
      if (group && !group.classList.contains('map-highlight')) {
        group.classList.add('map-occupied');
        const tooltipText = `Занят: ${cottage.name}${cottage.isActive === false ? ' (скрыт)' : ''}`;
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = tooltipText;
        title.setAttribute('data-mapid-tooltip', mapId);
        group.appendChild(title);
      }
    }
  }, [svg, value, allCottages, currentCottageId]);

  const valueOnMap = !!value && EDITABLE_MAP_IDS.includes(value as typeof EDITABLE_MAP_IDS[number]);

  if (!svg) {
    return <div className="w-full h-full bg-white/5 animate-pulse rounded-md" />;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md overflow-hidden border border-neutral-800 bg-[#0E0E10] aspect-[16/10]">
        <div
          ref={containerRef}
          className="w-full h-full admin-site-map-picker"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <p className="text-xs text-neutral-500">
        Клик по свободной точке задаёт mapId для домика. Текущая привязка:{' '}
        <span className="text-neutral-300 font-mono">{value || '— не задана —'}</span>.
        {!valueOnMap && value && (
          <span className="text-amber-400">
            {' '}— на карте нет такой точки, выделить нельзя, но значение сохранено в БД.
          </span>
        )}
      </p>

      {/* Ручной ввод — на случай, если точки на карте ещё нет (например, Домик3 без SVG). */}
      <div className="space-y-1">
        <Label htmlFor="mapId-input" className="text-xs text-neutral-400">
          Или введите mapId вручную
        </Label>
        <div className="flex gap-2">
          <Input
            id="mapId-input"
            value={value ?? ''}
            onChange={(e) => onChangeRef.current(e.target.value || null)}
            placeholder="Домик1 / Домик2 / Домик3 ..."
            className="bg-neutral-950 font-mono"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChangeRef.current(null)}
              className="shrink-0 px-3 rounded-md border border-red-900/60 bg-red-950/30 text-red-300 text-sm hover:bg-red-950/60 transition-colors"
            >
              Снять привязку
            </button>
          )}
        </div>
      </div>

      <OccupiedLegend
        allCottages={allCottages}
        currentCottageId={currentCottageId}
      />
    </div>
  );
}

interface OccupiedLegendProps {
  allCottages: AdminCottageSummary[];
  currentCottageId?: number;
}

function OccupiedLegend({ allCottages, currentCottageId }: OccupiedLegendProps) {
  const others = allCottages.filter(
    (c) => currentCottageId === undefined || c.id !== currentCottageId,
  );
  if (others.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        Все точки на карте свободны.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-1.5">
      <div className="text-xs font-medium text-neutral-400">
        Занятые точки:
      </div>
      <ul className="space-y-1">
        {others.map((c) => (
          <li key={c.id} className="text-xs text-neutral-300 flex items-center gap-2">
            <span className="font-mono text-red-400 w-20 shrink-0">{c.mapId}</span>
            <span className="truncate">{c.name}</span>
            {c.isActive === false && (
              <span className="text-neutral-500">(скрыт)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
