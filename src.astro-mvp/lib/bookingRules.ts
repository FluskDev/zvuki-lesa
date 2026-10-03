// Праздничные дни в России (месяц, день)
const RUSSIAN_HOLIDAYS: Array<{ month: number; day: number }> = [
  { month: 1, day: 1 }, { month: 1, day: 2 }, { month: 1, day: 3 },
  { month: 1, day: 4 }, { month: 1, day: 5 }, { month: 1, day: 6 },
  { month: 1, day: 7 }, { month: 1, day: 8 },
  { month: 2, day: 23 },
  { month: 3, day: 8 },
  { month: 5, day: 1 }, { month: 5, day: 9 },
  { month: 6, day: 12 },
  { month: 11, day: 4 },
];

const isWeekendOrHoliday = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return RUSSIAN_HOLIDAYS.some((h) => h.month === month && h.day === day);
};

/**
 * Проверяет, попадает ли диапазон дат на выходные или праздники (включая день выезда)
 */
export function hasWeekendOrHoliday(checkIn: Date | undefined, checkOut: Date | undefined): boolean {
  if (!checkIn || !checkOut) return false;
  const current = new Date(checkIn);
  current.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    if (isWeekendOrHoliday(current)) return true;
    current.setDate(current.getDate() + 1);
  }
  return false;
}

/**
 * Рассчитывает количество ночей между датами
 */
export function calculateNights(checkIn: Date | undefined, checkOut: Date | undefined): number {
  if (!checkIn || !checkOut) return 0;
  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Возвращает сообщение об ошибке минимального бронирования или null
 */
export function getMinNightsError(checkIn: Date | undefined, checkOut: Date | undefined): string | null {
  if (!checkIn || !checkOut) return null;
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 2 && hasWeekendOrHoliday(checkIn, checkOut)) {
    return 'В выходные и праздничные дни минимальное бронирование — от 2 суток';
  }
  return null;
}