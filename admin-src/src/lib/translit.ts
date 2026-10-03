/**
 * Максимальная длина результата. Совпадает с `slug` varchar(80) и zod
 * `cottageCreateSchema.slug.max(80)` в backend/src/routes/cottages.ts.
 */
const MAX_SLUG_LEN = 80;

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: 'y', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Транслитерирует русский текст в URL-slug.
 * - Латиница и цифры сохраняются.
 * - Не-буквенно-цифровые символы → '-'.
 * - Повторяющиеся '-' схлопываются, крайние обрезаются.
 * - Длина ограничена 80 символами (тримминг выполняется после обрезки,
 *   чтобы на границе не оставался висячий '-').
 */
export function transliterate(input: string): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (MAP[ch] !== undefined) {
      out += MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += '-';
    }
  }
  return out
    .replace(/-+/g, '-')
    .slice(0, MAX_SLUG_LEN)
    .replace(/^-|-$/g, '');
}