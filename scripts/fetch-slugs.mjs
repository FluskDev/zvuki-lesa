import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRoutesFromManifest } from './fetch-slugs-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, 'routes.manifest.json');

try {
  const routes = generateRoutesFromManifest(manifestPath);
  console.log(JSON.stringify(routes));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fetch-slugs] ${message}`);
  process.exit(1);
}
