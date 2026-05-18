/**
 * apps/api/src/modules/brownfield-wave-executor/transforms.ts
 *
 * Pure transformation functions referenced by brownfield.column_mappings.
 * Each function takes the raw legacy row + transform_payload and returns the
 * target column value. Functions are stateless; the engine wires them together.
 */
import { createHash } from "node:crypto";

export type RawRow = Record<string, unknown>;
export type TransformPayload = Record<string, unknown>;

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Format a pattern like `ESCO_SKILL::{uri}` by replacing `{col}` tokens with
 * the source row's column values.
 */
function formatPattern(pattern: string, row: RawRow): string {
  return pattern.replace(/\{([^}]+)\}/g, (_match, col: string) => {
    const v = row[col];
    return v === null || v === undefined ? "" : asString(v) ?? "";
  });
}

export interface TransformInput {
  sourceColumn: string;
  targetColumn: string;
  transform: string | null;
  payload: TransformPayload;
  row: RawRow;
}

export interface TransformOutput {
  // null → skip this column (don't include in upsert)
  skip: boolean;
  value: unknown;
}

export function applyTransform(input: TransformInput): TransformOutput {
  const { sourceColumn, transform, payload, row } = input;
  const raw = row[sourceColumn];

  switch (transform) {
    case null:
    case undefined:
    case "DIRECT_COPY":
      return { skip: false, value: raw };
    case "TRIM":
      return { skip: false, value: typeof raw === "string" ? raw.trim() : raw };
    case "LOWERCASE":
      return { skip: false, value: typeof raw === "string" ? raw.toLowerCase() : raw };
    case "UPPERCASE":
      return { skip: false, value: typeof raw === "string" ? raw.toUpperCase() : raw };
    case "CAST_UUID":
    case "CAST_NUMERIC":
    case "CAST_BOOLEAN":
    case "CAST_TIMESTAMPTZ":
    case "CAST_DATE":
    case "CAST_INT":
      // Leave the cast to PG via parameter binding — return raw, type-coerced if obviously possible.
      return { skip: false, value: raw };
    case "DEFAULT_IF_NULL":
      if (raw === null || raw === undefined) {
        return { skip: false, value: payload.default ?? null };
      }
      return { skip: false, value: raw };
    case "HASH_SHA256": {
      const s = asString(raw);
      return { skip: false, value: s === null ? null : sha256(s) };
    }
    case "CONTENT_HASH":
      // Hash over entire raw row JSON
      return { skip: false, value: sha256(JSON.stringify(row)) };
    case "NATURAL_KEY":
      if (typeof payload.pattern === "string") {
        return { skip: false, value: formatPattern(payload.pattern, row) };
      }
      return { skip: false, value: asString(raw) };
    case "CONSTANT":
      return { skip: false, value: payload.value ?? null };
    case "CONCAT": {
      const sources = Array.isArray(payload.sources) ? (payload.sources as string[]) : [];
      const sep = typeof payload.sep === "string" ? payload.sep : "";
      const parts = sources.map((c) => asString(row[c]) ?? "");
      return { skip: false, value: parts.join(sep) };
    }
    case "REGEX_EXTRACT": {
      const re = typeof payload.regex === "string" ? new RegExp(payload.regex) : null;
      const grp = typeof payload.group === "number" ? payload.group : 1;
      if (!re) return { skip: false, value: raw };
      const s = asString(raw);
      if (s === null) return { skip: false, value: null };
      const m = re.exec(s);
      return { skip: false, value: m && m[grp] !== undefined ? m[grp] : null };
    }
    case "JSON_EXTRACT": {
      const path = typeof payload.path === "string" ? payload.path : "";
      // Minimal path support: `$.a.b.c` only (dot-segment).
      if (!path || !path.startsWith("$")) return { skip: false, value: raw };
      const parts = path.slice(1).split(".").filter((p) => p.length > 0);
      let cur: unknown = raw;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          cur = null;
          break;
        }
      }
      return { skip: false, value: cur };
    }
    case "LINEAGE_SOURCE_NK":
      // Engine handles this externally — return raw as a fallback.
      return { skip: false, value: raw };
    case "SYNTHETIC_FLAG":
      return { skip: false, value: true };
    case "LOOKUP_FK":
      // Engine resolves FKs in a separate pass (see service.ts). Skip here;
      // the value will be patched in post-transform.
      return { skip: true, value: null };
    case "SKIP":
      return { skip: true, value: null };
    default:
      // Unknown transform → pass through with no modification.
      return { skip: false, value: raw };
  }
}

/**
 * Compute a deterministic content hash for a row — used for change detection.
 */
export function rowContentHash(row: RawRow): string {
  return sha256(JSON.stringify(row, Object.keys(row).sort()));
}

/**
 * Compute the natural key for a source row given a pattern from
 * brownfield.table_mappings.metadata.natural_key_pattern.
 */
export function computeNaturalKey(
  pattern: string | null,
  row: RawRow,
  fallbackTable: string,
  fallbackId: string,
): string {
  if (pattern && pattern.includes("{")) {
    const filled = formatPattern(pattern, row);
    if (filled && !filled.endsWith("::") && !filled.endsWith("::{}")) return filled;
  }
  // Generic fallback: OLDDB::<source_table>::<source_id>
  return `OLDDB::${fallbackTable}::${fallbackId}`;
}
