// scripts/optimize-images.mjs
// Сжимает JPEG/PNG в dist/ и генерирует WebP-версии.
// Hero: max 1920px, JPEG 80%. Галерея: max 1600px, JPEG 75%.
// Не трогает: og-image.jpg, favicon*, logo*, service-* (≤500 КБ), файлы < 200 КБ.

import { readdir, stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import sharp from '../backend/node_modules/sharp/dist/index.mjs';

const DIST = resolve('dist');
const SKIP_NAMES = [
  /^og-image\.(jpg|jpeg|png)$/i,
  /^favicon/i,
  /^logo/i,
  /^apple-touch/i,
  /manifest/i,
];
const HERO_FILES = [
  'cabin-1-enhanced.jpg',
  'Home1.jpg',
  'Home2.jpg',
];

const isHero = (rel) => HERO_FILES.includes(rel.split(/[\\/]/).pop());

const fmt = (n) => (n / 1024).toFixed(0) + ' КБ';

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__home' || e.name === 'node_modules' || e.name === '.git') continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

async function processFile(filePath) {
  const name = filePath.split(/[\\/]/).pop();
  if (SKIP_NAMES.some((re) => re.test(name))) return null;
  if (!/\.(jpe?g|png)$/i.test(name)) return null;

  const rel = relative(DIST, filePath);
  const st = await stat(filePath);
  const sizeIn = st.size;

  // Hero: 1920px, JPEG 80; Gallery: 1600px, JPEG 75
  const hero = isHero(rel);
  const maxWidth = hero ? 1920 : 1600;
  const jpegQuality = hero ? 80 : 75;

  // Skip small files (< 200 KB) unless they're hero
  if (!hero && sizeIn < 200 * 1024) return null;

  const buf = await readFile(filePath);
  const img = sharp(buf, { failOn: 'none' });
  const meta = await img.metadata();
  const origW = meta.width || maxWidth;
  const targetW = Math.min(origW, maxWidth);

  // 1) перезаписать JPEG (или PNG→JPEG, если был PNG и >1MB)
  const matchedExt = name.match(/\.(jpe?g|png)$/i)[0].toLowerCase().replace('jpeg', 'jpg');
  const outExt = (name.toLowerCase().endsWith('.png') && sizeIn > 1024 * 1024) ? 'jpg' : matchedExt.replace(/^\./, '');
  const newName = name.replace(/\.(jpe?g|png)$/i, '.' + outExt);
  const newPath = join(dirname(filePath), newName);

  let pipeline = img.clone().rotate(); // учитываем EXIF-ориентацию
  if (targetW < origW) pipeline = pipeline.resize({ width: targetW });
  pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true, progressive: true });

  const jpegBuf = await pipeline.toBuffer();
  await writeFile(newPath, jpegBuf);

  // удалить старый PNG, если переименовали
  if (newPath !== filePath) {
    await import('node:fs/promises').then((m) => m.unlink(filePath));
  }

  // 2) сгенерить WebP рядом
  const webpName = newName.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  const webpPath = join(dirname(filePath), webpName);
  let wpPipeline = sharp(buf, { failOn: 'none' }).rotate();
  if (targetW < origW) wpPipeline = wpPipeline.resize({ width: targetW });
  wpPipeline = wpPipeline.webp({ quality: hero ? 78 : 72 });
  await writeFile(webpPath, await wpPipeline.toBuffer());

  const stOut = await stat(newPath);
  const stWebp = await stat(webpPath);
  return {
    rel,
    inSize: sizeIn,
    outSize: stOut.size,
    webpSize: stWebp.size,
    srcW: origW,
    outW: targetW,
  };
}

async function main() {
  console.log('Сканирую', DIST);
  const results = [];
  for await (const p of walk(DIST)) {
    try {
      const r = await processFile(p);
      if (r) results.push(r);
    } catch (err) {
      console.error('  ERR', relative(DIST, p), err.message);
    }
  }

  results.sort((a, b) => b.inSize - a.inSize);

  let inTotal = 0, outTotal = 0, webpTotal = 0;
  for (const r of results) {
    inTotal += r.inSize;
    outTotal += r.outSize;
    webpTotal += r.webpSize;
  }

  console.log('');
  console.log('Топ-15 изменений:');
  console.log('─'.repeat(100));
  console.log('  было     → JPEG      WebP     W        файл');
  console.log('─'.repeat(100));
  for (const r of results.slice(0, 15)) {
    const pct = ((1 - r.outSize / r.inSize) * 100).toFixed(0);
    const wpct = ((1 - r.webpSize / r.inSize) * 100).toFixed(0);
    console.log(
      `  ${fmt(r.inSize).padStart(8)} → ${fmt(r.outSize).padStart(8)} (-${pct}%)  ${fmt(r.webpSize).padStart(8)} (-${wpct}%)  ${String(r.outW).padStart(4)}px  ${r.rel}`,
    );
  }
  console.log('─'.repeat(100));
  console.log(`Итого: ${results.length} файлов`);
  console.log(`  было:    ${fmt(inTotal)} (${(inTotal / 1024 / 1024).toFixed(1)} МБ)`);
  console.log(`  JPEG:    ${fmt(outTotal)} (${(outTotal / 1024 / 1024).toFixed(1)} МБ)  экономия ${((1 - outTotal / inTotal) * 100).toFixed(0)}%`);
  console.log(`  WebP:    ${fmt(webpTotal)} (${(webpTotal / 1024 / 1024).toFixed(1)} МБ)  экономия ${((1 - webpTotal / inTotal) * 100).toFixed(0)}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
