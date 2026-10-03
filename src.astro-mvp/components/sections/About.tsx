import { Mountain, TreePine, Waves, Sun } from 'lucide-react';

const features = [
  {
    icon: Mountain,
    title: 'Горные пейзажи',
    description: 'Вид на Главный Кавказский хребет и знаменитые скалы',
  },
  {
    icon: TreePine,
    title: 'Чистый воздух',
    description: 'Хвойные леса и горный климат для вашего здоровья',
  },
  {
    icon: Waves,
    title: 'Горные реки',
    description: 'Кристально чистая вода для купания и рыбалки',
  },
  {
    icon: Sun,
    title: 'Всесезонный отдых',
    description: 'Летние походы и зимние развлечения круглый год',
  },
];

export function About() {
  return (
    <section id="about" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main About Section */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-20">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Почему Даховская?
            </h2>
            <p className="text-lg text-stone-300 mb-6 leading-relaxed">
              Станица Даховская расположена в самом сердце Республике Адыгея —
              одном из самых живописных уголков России. Здесь встречаются
              величественные горы, буйная растительность и чистейшие реки.
            </p>
            <p className="text-lg text-stone-300 mb-8 leading-relaxed">
              Наши домики находятся в окружении природы, но при этом имеют 
              всю необходимую инфраструктуру для комфортного отдыха. 
              Вы получите незабываемые впечатления и полноценный отдых 
              от городской суеты.
            </p>

            <div className="grid grid-cols-2 gap-6">
              <div className="text-center p-4 bg-stone-800 rounded-xl">
                <div className="text-3xl font-bold text-emerald-400 mb-1">50+</div>
                <div className="text-sm text-stone-300">Довольных гостей</div>
              </div>
              <div className="text-center p-4 bg-stone-800 rounded-xl">
                <div className="text-3xl font-bold text-emerald-400 mb-1">4</div>
                <div className="text-sm text-stone-300">Уютных домика</div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="p-6 bg-stone-800 rounded-2xl hover:bg-stone-700 transition-colors duration-300 group border border-stone-700"
              >
                <div className="w-12 h-12 bg-stone-700 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors">
                  <feature.icon className="w-6 h-6 text-emerald-400 group-hover:text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-stone-300 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
