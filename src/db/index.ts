import { neon } from "@neondatabase/serverless";

function createSql() {
  return neon(process.env.DATABASE_URL!);
}

let _sql: ReturnType<typeof createSql> | null = null;

export function getSql() {
  if (!_sql) _sql = createSql();
  return _sql;
}

let tableReady: Promise<unknown> | null = null;

export function ensureSharedListsTable() {
  if (!tableReady) {
    const sql = getSql();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS shared_lists (
        id TEXT PRIMARY KEY,
        todos JSONB NOT NULL DEFAULT '[]'::jsonb,
        events JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  }
  return tableReady;
}
