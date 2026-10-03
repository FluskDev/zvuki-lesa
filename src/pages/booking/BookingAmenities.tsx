import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingAmenities({ cabin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hidden = cabin.amenitiesHidden ?? [];
  const hasHidden = hidden.length > 0;
  const visible = expanded ? [...cabin.amenities, ...hidden] : cabin.amenities;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-8">Удобства</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
        {visible.map((amenity, i) => (
          <div key={i} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span className="text-white/90">{amenity}</span>
          </div>
        ))}
      </div>
      {hasHidden && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-6 inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {expanded ? 'Скрыть' : 'Показать все'}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  );
}
