import "server-only";

import { Pool, type QueryResultRow } from "pg";
import { quoteIdentifier, type DbParam } from "@/lib/sql";

export { quoteIdentifier };
export type { DbParam };
export type DbRow = QueryResultRow & Record<string, unknown>;

const databaseUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

export function hasDatabaseConnection() {
  return Boolean(databaseUrl);
}

function getPool() {
  if (!databaseUrl) {
    throw new Error("Database connection string is not configured.");
  }
  pool ??= new Pool({
    connectionString: databaseUrl,
    max: 5,
  });
  return pool;
}

function postgresSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function queryRows<TRow extends DbRow>(
  sql: string,
  params: DbParam[] = [],
): Promise<TRow[]> {
  const result = await getPool().query<TRow>(postgresSql(sql), params);
  return result.rows;
}

export async function executeQuery(sql: string, params: DbParam[] = []): Promise<void> {
  await getPool().query(postgresSql(sql), params);
}
