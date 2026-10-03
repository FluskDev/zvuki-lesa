import { SiteMap } from '@/components/SiteMap/SiteMap';

export function Services() {
  return (
    <section id="services" className="min-h-screen flex items-center py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Расположение на участке
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Интерактивная карта нашего глэмпинга
          </p>
        </div>

        <div className="relative w-full h-[60vh] min-h-[420px] max-h-[640px] lg:h-[600px] lg:max-h-none rounded-2xl overflow-hidden">
          <SiteMap />
        </div>
      </div>
    </section>
  );
}
