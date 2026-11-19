// drizzle-kit: `pnpm db:generate` writes a new SQL migration in drizzle/ from src/db/schema.ts.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://slopesque:dev-only-postgres@localhost:55432/slopesque' },
});
