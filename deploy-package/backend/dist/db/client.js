import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// В тестах vitest.setup.ts ставит VITEST=true и подсовывает TEST_DATABASE_URL.
// Здесь мы принудительно используем test DB, чтобы `db` в тестах никогда
// не указывал на прод-БД, даже если Vite подхватил DATABASE_URL из .env.
const isTest = process.env.VITEST === 'true';
const url = isTest
    ? (process.env.TEST_DATABASE_URL
        ?? 'postgres://postgres:L0kijuhy!@192.168.1.103:5432/zvuki-lesa-test')
    : (process.env.DATABASE_URL
        ?? 'postgres://postgres:postgres@localhost:5432/zvuki-lesa');
// Disable noisy notice logs (PG logs INFO/NOTICE by default)
export const client = postgres(url, { onnotice: () => { } });
export const db = drizzle(client, { schema });
export { schema };
