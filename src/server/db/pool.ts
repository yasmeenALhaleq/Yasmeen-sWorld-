import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";
import { env } from "@/server/env";

// One pool per server process. In `next dev` modules are re-evaluated on every
// edit, so the pool is parked on globalThis to avoid leaking connections.
const globalForPool = globalThis as unknown as { __bwPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.__bwPool) {
    const pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      charset: "utf8mb4",
      timezone: "Z", // DATETIME columns are UTC
      decimalNumbers: true, // return DECIMAL as numbers, not strings
      dateStrings: ["DATE"], // delivery dates stay "YYYY-MM-DD" (no time zone shifting)
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10_000,
    });
    // Make NOW() / CURRENT_TIMESTAMP defaults UTC for every connection.
    pool.pool.on("connection", (conn) => {
      conn.query("SET time_zone = '+00:00'");
    });
    globalForPool.__bwPool = pool;
  }
  return globalForPool.__bwPool;
}

type Params = unknown[];
type Executor = Pick<PoolConnection, "execute"> | Pool;

/** SELECT many rows. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: Params = [],
  conn: Executor = getPool(),
): Promise<T[]> {
  const [rows] = await conn.execute(sql, params as never[]);
  return rows as T[];
}

/** SELECT a single row (or null). */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: Params = [],
  conn: Executor = getPool(),
): Promise<T | null> {
  const rows = await query<T>(sql, params, conn);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE. */
export async function execute(sql: string, params: Params = [], conn: Executor = getPool()): Promise<ResultSetHeader> {
  const [result] = await conn.execute(sql, params as never[]);
  return result as ResultSetHeader;
}

/**
 * Runs `fn` inside a transaction. Commits when it resolves, rolls back when it
 * throws. Pass the provided connection to query()/execute() so every statement
 * joins the transaction.
 */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

/** `?, ?, ?` for IN (...) lists. Never call with an empty array. */
export const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

export type Tx = PoolConnection;
