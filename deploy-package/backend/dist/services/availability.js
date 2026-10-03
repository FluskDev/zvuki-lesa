import { eachDayOfInterval, parseISO, isWeekend, subDays } from 'date-fns';
const HOLIDAYS = [
    { month: 1, days: [1, 2, 3, 4, 5, 6, 7, 8] },
    { month: 2, days: [23] },
    { month: 3, days: [8] },
    { month: 5, days: [1, 9] },
    { month: 6, days: [12] },
    { month: 11, days: [4] },
];
export function isDateRangeAvailable(existingBookings, checkIn, checkOut) {
    const requestedStart = parseISO(checkIn);
    const requestedEnd = parseISO(checkOut);
    // Zero-night stay: нет ночей для проживания → нет конфликта
    if (requestedStart >= requestedEnd)
        return true;
    for (const b of existingBookings) {
        if (b.status === 'cancelled')
            continue;
        const existingStart = parseISO(b.checkInDate);
        const existingEnd = parseISO(b.checkOutDate);
        // Пересечение (включая день выезда как свободный)
        if (requestedStart < existingEnd && requestedEnd > existingStart) {
            return false;
        }
    }
    return true;
}
export function hasWeekendOrHoliday(checkIn, checkOut) {
    const start = parseISO(checkIn);
    const end = parseISO(checkOut);
    // Zero-night stay: nothing to check
    if (start >= end)
        return false;
    // Исключаем день выезда — это уже не ночь проживания.
    // Используем subDays вместо вычитания миллисекунд, чтобы не ломаться на DST.
    const lastNight = subDays(end, 1);
    const days = eachDayOfInterval({ start, end: lastNight });
    return days.some((d) => {
        if (isWeekend(d))
            return true;
        const month = d.getMonth() + 1;
        const day = d.getDate();
        return HOLIDAYS.some((h) => h.month === month && h.days.includes(day));
    });
}
