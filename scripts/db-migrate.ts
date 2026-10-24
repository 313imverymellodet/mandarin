/**
 * Creates/updates every table Mandarin needs on the Railway Postgres:
 *   1. Better Auth tables (user, session, account, verification)
 *   2. App tables from db/schema.sql (idempotent)
 *
 * Usage: npm run db:migrate   (reads DATABASE_URL + BETTER_AUTH_SECRET from .env.local)
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { getMigrations } from "better-auth/db/migration"
import { getAuth } from "@/lib/auth"
import { getPool } from "@/lib/db"

async function main() {
  const pool = getPool()
  const auth = getAuth()
  if (!pool || !auth) {
    throw new Error("Set DATABASE_URL and BETTER_AUTH_SECRET (e.g. in .env.local) before migrating.")
  }

  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options)
  console.log(
    `auth tables: ${toBeCreated.length} to create (${toBeCreated.map((t) => t.table).join(", ") || "none"}), ${toBeAdded.length} to alter`,
  )
  await runMigrations()

  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8")
  await pool.query(schema)

  const { rows } = await pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  )
  console.log(`done — tables: ${rows.map((r) => r.table_name).join(", ")}`)
  await pool.end()
}

main().catch((error) => {
  console.error("migration failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
