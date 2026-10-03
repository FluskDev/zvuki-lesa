import { Wind, Waves, TreePine, Mountain, Snowflake, Check, Gift, Percent, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const amenities = [
  { icon: Wind, text: 'Кондиционер в номере' },
  { icon: Waves, text: 'Теплый бассейн' },
  { icon: TreePine, text: 'Беседка у леса' },
  { icon: Mountain, text: 'Мангал и качели' },
  { icon: Snowflake, text: 'Все необходимое для проживания' },
  { icon: Check, text: 'Панорамные окна с видом' },
];

const promotions = [
  {
    icon: Gift,
    title: 'Скидка в день рождения',
    discount: '15%',
    description: 'Скидка действует до дня рождения и после 7 дней! (Необходим паспорт с подтверждением)',
    period: 'с 20.08.2025 по 20.09.2026',
  },
  {
    icon: Calendar,
    title: 'Скидка на длительное проживание',
    discount: '10%',
    description: 'Скидка 10% при проживании от 4 дней!',
    period: 'Постоянная акция',
  },
];

export function Amenities() {
  return (
    <section id="amenities" className="py-20 lg:pt-36 lg:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Amenities Section */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Что есть в нашем домике
            </h3>
            <p className="text-stone-400">
              Всё необходимое для комфортного отдыха
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {amenities.map((amenity, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-4 bg-stone-800 rounded-xl"
              >
                <div className="w-10 h-10 bg-stone-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <amenity.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-stone-100 font-medium text-sm">{amenity.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Promotions Section */}
        <div>
          <div className="text-center mb-10">
            <Badge className="bg-emerald-500 text-white mb-4 px-4 py-1">
              <Percent className="w-4 h-4 mr-1" />
              Акции и скидки
            </Badge>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Специальные предложения
            </h3>
            <p className="text-stone-400">
              Воспользуйтесь нашими выгодными предложениями
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {promotions.map((promo, idx) => (
              <Card key={idx} className="bg-stone-800 border-stone-700 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <promo.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-bold text-white">
                          {promo.title}
                        </h4>
                        <span className="text-3xl font-bold text-emerald-600">
                          {promo.discount}
                        </span>
                      </div>
                      <p className="text-stone-300 text-sm mb-3">
                        {promo.description}
                      </p>
                      <p className="text-xs text-stone-400">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {promo.period}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}