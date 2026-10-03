import type { Cabin } from '@/lib/cabins';

interface Props {
  cabin: Cabin;
}

export function BookingAbout({ cabin }: Props) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-6">О домике</h2>
      <p className="text-lg text-white/80 leading-relaxed mb-8 max-w-3xl">
        {cabin.longDescription}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Площадь</p>
          <p className="text-xl font-bold text-white">{cabin.area} м²</p>
        </div>
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Спален</p>
          <p className="text-xl font-bold text-white">{cabin.bedrooms}</p>
        </div>
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Гостей</p>
          <p className="text-xl font-bold text-white">до {cabin.guests}</p>
        </div>
        <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-white/60">Заезд</p>
          <p className="text-xl font-bold text-white">{cabin.checkInTime}</p>
        </div>
      </div>
    </section>
  );
}
