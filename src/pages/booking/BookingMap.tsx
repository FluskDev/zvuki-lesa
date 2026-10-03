import { SiteMap } from '@/components/SiteMap/SiteMap';

export function BookingMap() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-3xl font-bold text-white mb-6">Карта участка</h2>
      <p className="text-white/70 mb-6">
        Расположение домика на участке.
      </p>
      <div className="aspect-[16/10] bg-[#1A1A1E] border border-white/5 rounded-2xl overflow-hidden">
        <SiteMap />
      </div>
    </section>
  );
}
