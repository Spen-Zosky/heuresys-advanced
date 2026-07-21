/**
 * apps/api/src/lib/i18n/localize.ts
 * Reference-data i18n overlay (ADR-0029). Given already-fetched rows in the
 * canonical language (IT, in-row), swaps the requested locale's fields from
 * sys.sys_reference_translations. Fallback is automatic: any field without a
 * translation keeps its canonical in-row value.
 *
 * IT is the canonical language → for locale 'it' this is a no-op (no query).
 * One batched query per call (indexed on entity_table+field+locale).
 */

import type { Pool, PoolClient } from "pg";
import type { Locale } from "../../middleware/locale.js";

type Db = Pool | PoolClient;

/** field name (as stored in sys_reference_translations) → setter on the row. */
export type FieldSetters<T> = Record<string, (row: T, text: string) => void>;

export async function localize<T>(
  db: Db,
  locale: Locale,
  entityTable: string,
  rows: T[],
  idOf: (row: T) => string,
  setters: FieldSetters<T>,
): Promise<void> {
  if (locale === "it" || rows.length === 0) return; // IT canonical in-row
  const ids = [...new Set(rows.map(idOf))];
  const res = await db.query<{ entity_id: string; field: string; text: string }>(
    `SELECT entity_id, field, text
       FROM sys.sys_reference_translations
      WHERE entity_table = $1 AND locale = $2 AND entity_id = ANY($3::uuid[])`,
    [entityTable, locale, ids],
  );
  const map = new Map<string, string>();
  for (const r of res.rows) map.set(`${r.entity_id}|${r.field}`, r.text);
  for (const row of rows) {
    const id = idOf(row);
    for (const [field, set] of Object.entries(setters)) {
      const t = map.get(`${id}|${field}`);
      if (t !== undefined) set(row, t);
    }
  }
}

/** Convenience for a single row (find-by-id endpoints). */
export async function localizeOne<T>(
  db: Db,
  locale: Locale,
  entityTable: string,
  row: T | null,
  idOf: (row: T) => string,
  setters: FieldSetters<T>,
): Promise<void> {
  if (row === null) return;
  await localize(db, locale, entityTable, [row], idOf, setters);
}
