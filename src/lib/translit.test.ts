import { describe, it, expect } from 'vitest';
import { transliterate } from './translit';

describe('transliterate', () => {
  it('converts simple Russian to Latin', () => {
    expect(transliterate('Шале Уют')).toBe('shale-uyut');
  });

  it('handles ё and й', () => {
    expect(transliterate('Ёлки-Палки')).toBe('yolki-palki');
  });

  it('handles ь and ъ', () => {
    expect(transliterate('Подъезд')).toBe('podyezd');
  });

  it('replaces spaces and punctuation with hyphens', () => {
    expect(transliterate('Дом у реки №3!')).toBe('dom-u-reki-3');
  });

  it('collapses multiple hyphens', () => {
    expect(transliterate('А   Б   В')).toBe('a-b-v');
  });

  it('strips leading/trailing hyphens', () => {
    expect(transliterate('---тест---')).toBe('test');
  });

  it('preserves already-Latin characters and digits', () => {
    expect(transliterate('Cottage 42')).toBe('cottage-42');
  });

  it('returns empty string for empty input', () => {
    expect(transliterate('')).toBe('');
  });

  it('truncates to 80 characters', () => {
    const long = 'а'.repeat(200);
    expect(transliterate(long).length).toBeLessThanOrEqual(80);
  });

  it('does not leave a trailing hyphen when slice lands on a hyphen boundary', () => {
    // 'а-а-' × 30 → output 'a-a-' × 30 = 120 chars; slice(0,80) берёт ровно
    // 20 повторов «a-a-» (80 chars) и заканчивается на '-'. Трим ПОСЛЕ slice
    // обязан это убрать.
    const input = 'а-а-'.repeat(30);
    const result = transliterate(input);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).not.toMatch(/-$/);
    expect(result).not.toMatch(/^-/);
  });
});