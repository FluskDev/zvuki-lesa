import { describe, expect, it } from 'vitest';
import {
  STATIC_ROUTES,
  buildRoutes,
  generateRoutesFromManifest,
  loadManifest,
} from './fetch-slugs-core.mjs';

function jsonReader(payload) {
  return () => JSON.parse(payload);
}

describe('fetch-slugs manifest', () => {
  it('собирает routes из домиков + SEO + блога + статики без дублей', () => {
    expect(buildRoutes({
      cottages: ['shale-uyut', 'shale-uyut'],
      seoPages: ['otdyh-v-dahovskoy'],
      blogPosts: ['marshrut-na-rufabgo'],
    })).toEqual([
      ...STATIC_ROUTES,
      '/booking/shale-uyut',
      '/seo/otdyh-v-dahovskoy',
      '/blog/marshrut-na-rufabgo',
    ]);
  });

  it('возвращает статику если manifest пустой', () => {
    expect(buildRoutes({ cottages: [], seoPages: [], blogPosts: [] })).toEqual(STATIC_ROUTES);
  });

  it('читает manifest и валидирует структуру', () => {
    const manifest = loadManifest('ignored', jsonReader(JSON.stringify({
      cottages: ['shale-uyut', 'gorny-dom'],
      seoPages: ['termy'],
      blogPosts: ['gid-lagonaki'],
    })));

    expect(manifest).toEqual({
      cottages: ['shale-uyut', 'gorny-dom'],
      seoPages: ['termy'],
      blogPosts: ['gid-lagonaki'],
    });
  });

  it('допускает manifest без _comment и без отдельных полей', () => {
    const manifest = loadManifest('ignored', jsonReader(JSON.stringify({ seoPages: ['x'] })));
    expect(manifest).toEqual({
      cottages: [],
      seoPages: ['x'],
      blogPosts: [],
    });
  });

  it('отбивает manifest с cottages не-массивом', () => {
    expect(() => loadManifest('ignored', jsonReader(JSON.stringify({ cottages: 'shale-uyut' }))))
      .toThrow(/cottages должен быть массивом строк/);
  });

  it('отбивает manifest с элементом не-строкой', () => {
    expect(() => loadManifest('ignored', jsonReader(JSON.stringify({ seoPages: [1, 2] }))))
      .toThrow(/seoPages должен быть массивом строк/);
  });

  it('отбивает manifest-объект с null', () => {
    expect(() => loadManifest('ignored', jsonReader('null')))
      .toThrow(/manifest должен быть JSON-объектом/);
  });

  it('отбивает manifest-массив', () => {
    expect(() => loadManifest('ignored', jsonReader('[]')))
      .toThrow(/manifest должен быть JSON-объектом/);
  });

  it('пробрасывает ошибку чтения файла', () => {
    const brokenReader = () => { throw new Error('ENOENT'); };
    expect(() => loadManifest('/missing.json', brokenReader))
      .toThrow(/не удалось прочитать manifest \/missing\.json: ENOENT/);
  });

  it('возвращает статику если путь manifest не задан', () => {
    expect(loadManifest(undefined)).toEqual({
      cottages: [],
      seoPages: [],
      blogPosts: [],
    });
  });

  it('generateRoutesFromManifest собирает полный список маршрутов', () => {
    const routes = generateRoutesFromManifest('ignored', jsonReader(JSON.stringify({
      cottages: ['shale-uyut'],
      seoPages: ['termy-adygeya'],
      blogPosts: [],
    })));
    expect(routes).toEqual([
      '/', '/blog', '/404',
      '/booking/shale-uyut',
      '/seo/termy-adygeya',
    ]);
  });
});
