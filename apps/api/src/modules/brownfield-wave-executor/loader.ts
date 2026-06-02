/**
 * apps/api/src/modules/brownfield-wave-executor/loader.ts
 *
 * Ensures the `legacy_mirror` schema is present and the 88 Wave 1 source
 * tables are loaded. The loader is idempotent: it can re-run safely. It is
 * called by the wave executor's STAGING phase before reading source rows
 * into the jsonb-buffer staging tables.
 *
 * Data path:
 *   db/seeds/brownfield/wave1/legacy_data/wave1_<domain>(_<table>)?.sql
 *     ↓ (sed-replace `INSERT INTO public.` → `INSERT INTO legacy_mirror.`)
 *   legacy_mirror.<source_table>
 *     ↓ (SELECT * → jsonb)
 *   staging.wave1_<target>.staging_raw_record
 */
import type { Pool, PoolClient } from "pg";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type DbConnector = Pool | PoolClient;

/**
 * Resolve the legacy_data directory relative to repo root. Falls back to the
 * conventional path (`D:\heuresys-advanced\db\seeds\brownfield\wave1\legacy_data`)
 * when running locally on Windows. The env var WAVE1_LEGACY_DATA_DIR overrides.
 */
export function resolveLegacyDataDir(): string {
  if (process.env.WAVE1_LEGACY_DATA_DIR) return process.env.WAVE1_LEGACY_DATA_DIR;
  // From apps/api/dist or apps/api/src, walk up to repo root + db/seeds/brownfield/wave1/legacy_data
  const here = path.dirname(fileURLToPath(import.meta.url));
  let cur = here;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(cur, "db", "seeds", "brownfield", "wave1", "legacy_data");
    if (existsSync(candidate)) return candidate;
    cur = path.dirname(cur);
  }
  // Final fallback for Windows dev box
  return "D:/heuresys-advanced/db/seeds/brownfield/wave1/legacy_data";
}

/**
 * Generate CREATE TABLE statements for the legacy_mirror schema from the
 * Wave 1 source_tables + source_columns we already loaded. We sacrifice
 * fidelity (NOT NULL, defaults, FK, CHECKs) and just declare columns
 * permissive — the goal is to receive any INSERT from pg_dump without
 * constraint conflicts.
 */
/**
 * Per-wave legacy source-domain whitelist. Wave 1 = the 7 domains whose tables back the Wave-1
 * mappings. A wave with no entry has no source domains loaded yet (source-discovery-gated) →
 * ensureLegacyMirrorDDL mirrors 0 tables for it (additive, Wave-1-safe).
 */
const WAVE_SOURCE_DOMAINS: Record<number, readonly string[]> = {
  1: ["ESKAP", "SKILGRO", "INDOOR", "ITLAB", "PROGOV", "OPOURSKA", "H2R"],
};

export async function ensureLegacyMirrorDDL(q: DbConnector, wave: number): Promise<{ tables: number }> {
  await q.query(`CREATE SCHEMA IF NOT EXISTS legacy_mirror`);

  const domains = WAVE_SOURCE_DOMAINS[wave] ?? [];
  if (domains.length === 0) return { tables: 0 };

  // Pull source_tables + source_columns from brownfield.* (already populated by subagent A).
  const sourceTables = await q.query<{ source_table_id: string; source_table_name: string }>(
    `SELECT source_table_id, source_table_name
       FROM brownfield.source_tables
      WHERE source_table_domain = ANY($1::text[])
      ORDER BY source_table_name`,
    [domains],
  );

  let created = 0;
  for (const t of sourceTables.rows) {
    const cols = await q.query<{
      source_column_name: string;
      source_column_data_type: string;
      source_column_is_nullable: boolean;
      source_column_metadata: Record<string, unknown>;
    }>(
      `SELECT source_column_name, source_column_data_type,
              source_column_is_nullable, source_column_metadata
         FROM brownfield.source_columns
        WHERE source_column_table_id = $1
        ORDER BY (source_column_metadata->>'position')::int NULLS LAST, source_column_name`,
      [t.source_table_id],
    );

    if (cols.rows.length === 0) {
      // Empty table — skip (we'll log it once).
      continue;
    }

    const colDefs = cols.rows.map((c) => {
      // Map common PG types to permissive equivalents in legacy_mirror.
      // We INTENTIONALLY drop NOT NULL and use text/jsonb fallbacks for
      // any complex type so pg_dump INSERTs always land.
      const udt = (c.source_column_metadata?.udt_name as string | undefined) ?? c.source_column_data_type;
      const lower = udt.toLowerCase();
      let pgType = "text";
      if (lower === "uuid") pgType = "uuid";
      else if (lower === "int4" || lower === "integer") pgType = "integer";
      else if (lower === "int8" || lower === "bigint") pgType = "bigint";
      else if (lower === "int2" || lower === "smallint") pgType = "smallint";
      else if (lower === "bool" || lower === "boolean") pgType = "boolean";
      else if (lower === "numeric" || lower === "decimal") pgType = "numeric";
      else if (lower.startsWith("varchar")) pgType = "text";
      else if (lower === "timestamptz" || lower === "timestamp with time zone") pgType = "timestamptz";
      else if (lower === "timestamp" || lower === "timestamp without time zone") pgType = "timestamp";
      else if (lower === "date") pgType = "date";
      else if (lower === "jsonb" || lower === "json") pgType = "jsonb";
      else if (lower === "vector") pgType = "text";   // pgvector — store as text; we don't query it via similarity in import
      else if (lower.startsWith("_")) pgType = "text"; // arrays — store as text
      else if (lower === "tsvector") pgType = "text";
      else if (lower === "bytea") pgType = "bytea";
      else pgType = "text";
      // Quote identifier to handle reserved words / camelCase
      return `"${c.source_column_name}" ${pgType}`;
    });

    // Plain CREATE TABLE — no constraints, no PK. The mirror is a raw drop zone.
    await q.query(
      `CREATE TABLE IF NOT EXISTS legacy_mirror."${t.source_table_name}" (
         ${colDefs.join(",\n         ")}
       )`,
    );
    created += 1;
  }

  return { tables: created };
}

/**
 * Apply each legacy_data SQL dump after sed-replacing the schema prefix.
 * The dumps were produced with `pg_dump --column-inserts --rows-per-insert=1000`
 * targeting `public.*`. We rewrite to `legacy_mirror.*` and apply via psql-like
 * semicolon split (the pg client `query` doesn't accept multi-statement strings
 * with COPY in some modes; --column-inserts produces only INSERT, which works).
 *
 * For idempotency: legacy_mirror tables have no PK, so re-running an INSERT
 * will duplicate rows. We therefore TRUNCATE each table before applying.
 */
export async function loadLegacyMirrorData(
  pool: Pool,
  options?: { onProgress?: (msg: string) => void },
): Promise<{ files: number; statements: number }> {
  const dir = resolveLegacyDataDir();
  if (!existsSync(dir)) {
    throw new Error(`Wave 1 legacy_data directory not found: ${dir}`);
  }
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("wave1_") && f.endsWith(".sql"))
    .sort();

  // Truncate every legacy_mirror.* table referenced in these dumps. We can
  // get a list from the brownfield.source_tables rows.
  const tablesRes = await pool.query<{ source_table_name: string }>(
    `SELECT source_table_name FROM brownfield.source_tables
      WHERE source_table_domain IN
        ('ESKAP','SKILGRO','INDOOR','ITLAB','PROGOV','OPOURSKA','H2R')`,
  );
  const tableNames = tablesRes.rows.map((r) => r.source_table_name);
  if (tableNames.length > 0) {
    const escaped = tableNames.map((t) => `legacy_mirror."${t}"`).join(", ");
    await pool.query(`TRUNCATE ${escaped}`);
  }

  let statements = 0;
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const size = statSync(fullPath).size;
    options?.onProgress?.(`loading ${f} (${(size / (1024 * 1024)).toFixed(1)} MB)`);
    const sql = readFileSync(fullPath, "utf8");
    // Rewrite public.* references to legacy_mirror.* and drop pg_dump
    // session directives that the node-postgres client doesn't accept
    // (SET, \restrict, \unrestrict).
    const rewritten = sql
      .replace(/INSERT INTO public\./g, 'INSERT INTO legacy_mirror.')
      .replace(/^\s*SET\s+.*?;\s*$/gm, "")
      .replace(/^\\restrict.*$/gm, "")
      .replace(/^\\unrestrict.*$/gm, "")
      .replace(/^--.*$/gm, "");
    // Split into INSERT batches. We can't run multi-statement SQL in one go
    // reliably through node-postgres; chunk by `;\n` and execute one at a time.
    const stmts = rewritten
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^INSERT\s+INTO/i.test(s));
    // legacy_mirror tables are declared without FKs/CHECK constraints (loader.ts
    // ensureLegacyMirrorDDL) so we do NOT need to defer triggers via
    // session_replication_role (which requires superuser anyway). Plain
    // transaction with batched inserts is enough.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const stmt of stmts) {
        await client.query(stmt);
        statements += 1;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(`Failed loading ${f}: ${(e as Error).message}`);
    } finally {
      client.release();
    }
  }

  return { files: files.length, statements };
}

/**
 * Read a slice of legacy rows. The engine iterates with offset/limit pagination
 * to avoid pulling everything into memory at once.
 */
export async function readLegacySlice(
  q: DbConnector,
  sourceTable: string,
  offset: number,
  limit: number,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const totalRes = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM legacy_mirror."${sourceTable}"`,
  );
  const dataRes = await q.query<Record<string, unknown>>(
    `SELECT * FROM legacy_mirror."${sourceTable}" ORDER BY 1 LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return { rows: dataRes.rows, total: Number(totalRes.rows[0]?.total ?? 0) };
}
