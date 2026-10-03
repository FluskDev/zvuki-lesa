import { Users, BedDouble, BedSingle, Bed, Clock, VolumeX, CigaretteOff, PawPrint } from 'lucide-react';
import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

const RULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Громкая музыка запрещена': VolumeX,
  'Курение запрещено (Все виды)': CigaretteOff,
  'Можно с животными по согласованию': PawPrint,
};

export function BookingInfo({ cabin }: Props) {
  const items = [
    { icon: Users, text: `До ${cabin.guests} гостей` },
    { icon: BedDouble, text: `${cabin.beds.double} двуспальные кровати` },
    ...(cabin.beds.single > 0
      ? [{ icon: BedSingle, text: `${cabin.beds.single} односпальная кровать` }]
      : []),
    { icon: Bed, text: `${cabin.bedrooms} ${cabin.bedrooms === 1 ? 'спальня' : 'спальни'}` },
    { icon: Clock, text: `Заезд: ${cabin.checkInTime} / Выезд ${cabin.checkOutTime}` },
    ...cabin.rules.map((rule) => ({
      icon: RULE_ICONS[rule] || VolumeX,
      text: rule,
    })),
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-8">Основная информация</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-white/90">{item.text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
