import postgres from 'postgres';
import { loadEnv } from '../config/env.js';
import { runMigrations } from './migrate.js';

const env = loadEnv();
const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
await runMigrations(sql);
await sql.end();
console.log('Migrations appliquées.');
