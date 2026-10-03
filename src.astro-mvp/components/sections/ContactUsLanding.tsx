import { useState } from 'react';
import { MapPin, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { YandexMap } from '@/components/YandexMap';
import { toast } from 'sonner';

export function ContactUsLanding() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error('Пожалуйста, заполните все поля');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });

      if (response.ok) {
        toast.success('Спасибо! Мы перезвоним вам в течение 5 минут');
        setName('');
        setPhone('');
      } else {
        throw new Error('Failed to submit');
      }
    } catch (error) {
      toast.error('Произошла ошибка. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact-us" className="h-screen bg-[#141414] flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 lg:gap-16 items-center">
          {/* Left Column - Contact Form */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
                Свяжитесь с нами
              </h1>
              <p className="text-lg sm:text-xl text-stone-400 max-w-lg">
                Если есть вопросы, оставьте телефон и мы перезвоним вам в течение пяти минут
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-stone-300">
                    Имя
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ваше имя"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#1a1a1a] border-stone-800 text-white placeholder:text-stone-500 h-12 rounded-xl focus:border-stone-600 focus:ring-stone-700"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-stone-300">
                    Телефон
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-[#1a1a1a] border-stone-800 text-white placeholder:text-stone-500 h-12 rounded-xl focus:border-stone-600 focus:ring-stone-700"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-stone-200 text-stone-900 hover:bg-stone-300 rounded-xl text-base font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </Button>

              <p className="text-xs text-stone-500 text-center leading-relaxed">
                Нажимая кнопку «Отправить», вы даёте согласие на обработку персональных данных
                в соответствии с{' '}
                <a href="/privacy" className="underline hover:text-stone-400 transition-colors">
                  политикой конфиденциальности
                </a>
              </p>
            </form>

            <div className="border-t border-stone-800 pt-8">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
                <p className="text-stone-400 text-sm leading-relaxed">
                  ул. Короткая, 17, ст-ца Даховская, Республика Адыгея, 385792
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Map */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[400px] aspect-square">
              {/* Decorative glow */}
              <div className="absolute inset-0 bg-gradient-radial from-emerald-900/20 via-transparent to-transparent rounded-full blur-xl" />

              {/* Circular map container */}
              <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-stone-800 shadow-2xl shadow-emerald-900/10">
                <YandexMap
                  center={[44.223140, 40.199615]}
                  zoom={16}
                  width="100%"
                  height="100%"
                />
              </div>

              {/* Decorative ring */}
              <div className="absolute inset-0 rounded-full border border-stone-800 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
      `}</style>
    </section>
  );
}