import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ENV, type Env } from '../config/config.module.js';
import * as schema from './schema.js';
import { runMigrations } from './migrate.js';

export const DB = Symbol('DB');
export const SQL = Symbol('SQL');
export type Db = PostgresJsDatabase<typeof schema>;

/** Postgres is required: the server stops at start when it can't reach it (external-services). */
@Global()
@Module({
  providers: [
    {
      provide: SQL,
      inject: [ENV],
      useFactory: async (env: Env) => {
        const sql = postgres(env.DATABASE_URL, { max: 10, onnotice: () => {} });
        try { await sql`select 1`; } catch (e) {
          console.error(`Postgres injoignable (${(e as Error).message}) : le serveur ne peut pas démarrer sans sa base.`);
          process.exit(1);
        }
        await runMigrations(sql);
        return sql;
      },
    },
    { provide: DB, inject: [SQL], useFactory: (sql: postgres.Sql) => drizzle(sql, { schema }) },
  ],
  exports: [DB, SQL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: postgres.Sql) {}
  async onApplicationShutdown() {
    await this.sql.end({ timeout: 5 });
    new Logger('Postgres').log('fermé');
  }
}
