import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingRecreation({ cabin }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-8">Отдых и досуг</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cabin.recreation.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className="bg-[#1A1A1E] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={item.photo} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-4 flex flex-col gap-3">
                <h3 className="font-medium text-white">{item.title}</h3>
                {isOpen && (
                  <p className="text-sm text-white/70">{item.description}</p>
                )}
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="mt-auto inline-flex items-center justify-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {isOpen ? 'Скрыть' : 'Описание'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
