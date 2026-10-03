import sharp from 'sharp';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
export async function processImage(buffer, options) {
    mkdirSync(options.destDir, { recursive: true });
    const outPath = path.join(options.destDir, `${options.filenameBase}.webp`);
    const image = sharp(buffer);
    const meta = await image.metadata();
    await image.webp({ quality: options.quality ?? 80 }).toFile(outPath);
    return { path: outPath, width: meta.width ?? 0, height: meta.height ?? 0 };
}
