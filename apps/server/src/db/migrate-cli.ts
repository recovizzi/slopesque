import { loadEnv } from '../config/env.js';
import { runMigrations } from './migrate.js';

await runMigrations(loadEnv().DATABASE_URL);
console.log('Migrations appliquées.');
