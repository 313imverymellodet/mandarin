import { Pool, type QueryResultRow } from "pg"
import { config } from "@/lib/config"

/**
 * Postgres connection pool (Railway). Server-only — the connection string is a
 * credential and must never reach the browser. Returns null when DATABASE_URL
 * is unset so every DB-backed feature degrades gracefully instead of crashing.
 *
 * The pool is cached on globalThis so dev hot-reloads and warm serverless
 * invocations reuse connections instead of opening new ones each time.
 */

const globalForDb = globalThis as unknown as { __mandarinPool?: Pool | null }

/** Railway's public proxy uses a self-signed cert; private/local URLs need no TLS. */
function sslFor(url: string): false | { rejectUnauthorized: false } {
  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return ""
    }
  })()
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".railway.internal")
  if (isLocal || /[?&]sslmode=disable/.test(url)) return false
  return { rejectUnauthorized: false }
}

export function getPool(): Pool | null {
  if (globalForDb.__mandarinPool !== undefined) return globalForDb.__mandarinPool
  const url = config.database.url
  if (!url) {
    globalForDb.__mandarinPool = null
    return null
  }
  const pool = new Pool({
    connectionString: url,
    ssl: sslFor(url),
    // Small per-instance pool: serverless runs many instances side by side.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  })
  pool.on("error", (error) => console.error("postgres pool error:", error.message))
  globalForDb.__mandarinPool = pool
  return pool
}

/** Run a parameterized query. Throws if the database isn't configured. */
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const pool = getPool()
  if (!pool) throw new Error("Database is not configured (DATABASE_URL).")
  return pool.query<T>(text, params)
}

/**
 * Bulk insert in ONE round trip: rows travel as a JSON array and Postgres maps
 * them onto the table's column types (incl. arrays/timestamps). `table` and
 * `columns` are trusted identifiers from our own code — never user input.
 */
export async function insertRows(
  table: string,
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
  onConflict?: { target: readonly string[]; action: "nothing" },
): Promise<number> {
  if (rows.length === 0) return 0
  const pool = getPool()
  if (!pool) return 0
  const cols = columns.join(", ")
  const conflict = onConflict ? ` on conflict (${onConflict.target.join(", ")}) do nothing` : ""
  const result = await pool.query(
    `insert into ${table} (${cols})
     select ${cols} from json_populate_recordset(null::${table}, $1::json)${conflict}`,
    [JSON.stringify(rows)],
  )
  return result.rowCount ?? 0
}
