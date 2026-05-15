import * as fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  try {
    await pool.query('create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())');
    for (const migration of migrations) {
      const alreadyApplied = await pool.query('select 1 from schema_migrations where filename = $1', [migration]);
      if (alreadyApplied.rowCount) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, migration), 'utf8');
      await pool.query('begin');
      try {
        await pool.query(sql);
        await pool.query('insert into schema_migrations (filename) values ($1)', [migration]);
        await pool.query('commit');
        console.log(`Applied migration ${migration}`);
      } catch (error) {
        await pool.query('rollback');
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
