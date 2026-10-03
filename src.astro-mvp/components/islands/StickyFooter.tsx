import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const NIGHTS_LABEL = ['ночь', 'ночи', 'ночей'];

function pluralize(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return NIGHTS_LABEL[0]!;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return NIGHTS_LABEL[1]!;
  return NIGHTS_LABEL[2]!;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowISO() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t.toISOString().slice(0, 10);
}

export default function StickyFooter() {
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [guests, setGuests] = useState<number>(1);
  const [isLoading, setLoading] = useState(false);

  // Инициализация значений по умолчанию после монтирования (избегаем SSR-mismatch)
  useEffect(() => {
    setCheckIn(todayISO());
    setCheckOut(tomorrowISO());
  }, []);

  const nights = (() => {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    const ms = b.getTime() - a.getTime();
    return Math.max(0, Math.round(ms / 86400000));
  })();

  const handleSearch = () => {
    if (!checkIn || !checkOut) {
      toast.error('Выберите даты заезда и выезда');
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      toast.error('Дата выезда должна быть позже даты заезда');
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      guests: String(guests),
    });
    setTimeout(() => {
      window.location.href = `/search?${params.toString()}`;
    }, 150);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[80] p-3 pb-4 pointer-events-none">
      <div className="max-w-5xl mx-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-2xl shadow-2xl pointer-events-auto px-4 py-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 flex items-center gap-2">
            <label className="text-xs text-stone-400 flex flex-col">
              Заезд
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-white text-sm"
              />
            </label>
            <label className="text-xs text-stone-400 flex flex-col">
              Выезд
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-white text-sm"
              />
            </label>
            {nights > 0 && (
              <span className="text-xs text-stone-300 self-end pb-1.5">
                {nights} {pluralize(nights)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-400 flex flex-col">
              Гостей
              <input
                type="number"
                min="1"
                max="10"
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-white text-sm w-16"
              />
            </label>
            <button
              type="button"
              onClick={handleSearch}
              disabled={isLoading}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-md transition-colors"
            >
              {isLoading ? 'Поиск...' : 'Найти'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
