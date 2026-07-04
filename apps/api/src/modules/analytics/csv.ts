/**
 * apps/api/src/modules/analytics/csv.ts
 * Generic JSON→CSV flattener for the analytics export endpoint.
 *
 * The 9 analytics views have heterogeneous shapes (each carries scalars plus one
 * or more breakdown arrays — byOrgUnit, byJobRole, monthly, scatter, cells, …).
 * Rather than a per-view serialiser, this walks the response object generically:
 *   - scalar / nested-object props → a "# summary" section as key,value rows
 *     (nested objects flattened with dot-notation, e.g. scope.kind)
 *   - each array-of-objects prop    → its own "# <prop>" section, header = the
 *     union of object keys (first-seen order), one row per element
 *   - each array-of-scalars prop    → a "# <prop>" section with a single "value" column
 *
 * Sections are separated by a blank line. Values are RFC-4180 escaped (quote when
 * they contain a comma, quote, CR or LF; embedded quotes are doubled). This keeps
 * the export deterministic and view-agnostic — no decision logic per view.
 */

type Json = unknown;

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Neutralize spreadsheet formula / DDE injection: a cell whose text begins with a
 * formula trigger (`= + @`, or a leading TAB/CR) — or a leading `-` that is NOT a plain
 * number — is prefixed with a single quote so Excel/Sheets/LibreOffice render it as text,
 * never as a live formula (e.g. `=cmd|'/c calc'!A1`). Plain negative numbers pass through
 * unchanged. F-004 (OWASP CSV injection).
 */
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;
function neutralizeFormula(s: string): string {
  if (s === "") return s;
  const first = s[0]!;
  const isTrigger =
    first === "=" || first === "+" || first === "@" || first === "\t" || first === "\r" ||
    (first === "-" && !PLAIN_NUMBER.test(s));
  return isTrigger ? `'${s}` : s;
}

/** RFC-4180 cell escaping + formula-injection neutralization. null/undefined → "". */
export function csvCell(value: Json): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const s = neutralizeFormula(raw);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values: Json[]): string {
  return values.map(csvCell).join(",");
}

/** Flatten scalars + nested objects into dot-notation key/value pairs (arrays skipped). */
function flattenScalars(obj: Record<string, Json>, prefix = ""): Array<[string, Json]> {
  const out: Array<[string, Json]> = [];
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(val)) continue; // arrays become their own sections
    if (isPlainObject(val)) {
      out.push(...flattenScalars(val, path));
    } else {
      out.push([path, val]);
    }
  }
  return out;
}

/** Header = union of object keys across the array, in first-seen order. */
function unionKeys(rows: Array<Record<string, Json>>): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

/**
 * Serialise an analytics view payload to a multi-section CSV string.
 * Top-level only — breakdown arrays are never nested deeper in these responses.
 */
export function toCsv(payload: Record<string, Json>): string {
  const sections: string[] = [];

  // 1. summary — every non-array top-level prop (scalars + nested objects).
  const scalars = flattenScalars(payload);
  if (scalars.length > 0) {
    const lines = ["# summary", "key,value", ...scalars.map(([k, v]) => csvRow([k, v]))];
    sections.push(lines.join("\n"));
  }

  // 2. one section per array prop.
  for (const [key, val] of Object.entries(payload)) {
    if (!Array.isArray(val)) continue;
    const lines = [`# ${key}`];
    if (val.length === 0) {
      lines.push("(empty)");
    } else if (val.every(isPlainObject)) {
      const cols = unionKeys(val as Array<Record<string, Json>>);
      lines.push(cols.join(","));
      for (const row of val as Array<Record<string, Json>>) {
        lines.push(csvRow(cols.map((c) => row[c])));
      }
    } else {
      // array of scalars
      lines.push("value");
      for (const v of val) lines.push(csvCell(v));
    }
    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n") + "\n";
}
