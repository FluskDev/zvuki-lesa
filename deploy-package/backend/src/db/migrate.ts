import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client.js';

console.log('[migrate] applying migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('[migrate] done');
process.exit(0);
