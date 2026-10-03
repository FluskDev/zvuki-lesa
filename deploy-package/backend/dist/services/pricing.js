import { eachDayOfInterval, format, isWeekend, parseISO } from 'date-fns';
function ruleApplies(rule, dateISO, cottageId) {
    if (rule.cottageId !== null && rule.cottageId !== cottageId)
        return false;
    return dateISO >= rule.startDate && dateISO <= rule.endDate;
}
function pickRule(rules, dateISO, cottageId) {
    const matches = rules.filter((r) => ruleApplies(r, dateISO, cottageId));
    if (matches.length === 0)
        return null;
    return matches.sort((a, b) => {
        if (b.priority !== a.priority)
            return b.priority - a.priority;
        // tie-breaker: cottage-specific (cottageId !== null) beats global (cottageId === null)
        const aSpecific = a.cottageId !== null ? 1 : 0;
        const bSpecific = b.cottageId !== null ? 1 : 0;
        return bSpecific - aSpecific;
    })[0];
}
function applyRule(base, rule, weekend) {
    let price = base;
    if (rule.modifierType === 'percent') {
        price = Math.round(base * (1 + rule.modifierValue / 100));
    }
    else {
        price = base + rule.modifierValue;
    }
    if (weekend && rule.weekendModifier !== null) {
        price = Math.round(price * (1 + rule.weekendModifier / 100));
    }
    return price;
}
/**
 * Рассчитывает стоимость проживания за диапазон дат.
 *
 * @param basePrice Базовая цена за ночь в рублях
 * @param checkIn Дата заезда (ISO `yyyy-MM-dd`)
 * @param checkOut Дата выезда (ISO `yyyy-MM-dd`), строго больше checkIn
 * @param rules Массив ценовых правил (глобальных и/или специфичных для домика)
 * @param cottageId ID домика — определяет, какие правила применимы
 *
 * Контракт входных данных:
 * - checkOut > checkIn (иначе вернётся пустой perNight и subtotal = 0)
 * - Невалидные ISO-строки дадут NaN-значения в результате
 * - Правила с одинаковым приоритетом разрешаются: правило для конкретного домика
 *   выигрывает у глобального
 */
export function calculateStayPrice(basePrice, checkIn, checkOut, rules, cottageId) {
    const nights = eachDayOfInterval({ start: parseISO(checkIn), end: parseISO(checkOut) });
    // exclude the last day (check-out day)
    const stayNights = nights.slice(0, -1);
    const perNight = stayNights.map((day) => {
        const date = format(day, 'yyyy-MM-dd');
        const rule = pickRule(rules, date, cottageId);
        const weekend = isWeekend(day);
        const final = rule ? applyRule(basePrice, rule, weekend) : basePrice;
        return { date, base: basePrice, final, rule: rule?.name ?? null };
    });
    const subtotal = perNight.reduce((sum, n) => sum + n.final, 0);
    return { perNight, subtotal };
}
