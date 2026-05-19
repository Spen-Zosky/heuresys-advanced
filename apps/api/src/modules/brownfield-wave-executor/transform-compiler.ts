/**
 * apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts
 *
 * Pure SQL-fragment compiler for `brownfield.column_mappings`. Converts a single
 * column-mapping row (transform_code + payload + source SQL expression) into a
 * PG SQL fragment safe for interpolation into an INSERT … SELECT statement.
 *
 * Goal 001a v4 scope: supports the 12 mechanical transform codes that appear
 * with count > 0 in `brownfield.column_mappings`. The 2 non-mechanical codes
 * (JSON_EXTRACT, LINEAGE_SOURCE_NK) and the 8 vocabulary entries in
 * transforms.ts that have 0 mappings (CAST_UUID, CAST_DATE, DEFAULT_IF_NULL,
 * HASH_SHA256, CONTENT_HASH, NATURAL_KEY, CONCAT, REGEX_EXTRACT,
 * SYNTHETIC_FLAG) throw `UnsupportedTransformError`, which the engine catches
 * and records as `SKIPPED_UNSUPPORTED_TRANSFORM_V1` in
 * `audit.import_validation_results` (per PLAN v4 §2.4).
 *
 * SQL-injection safety boundary:
 *   - All payload identifiers (target_table, lookup_col, return_col) are
 *     escaped via pg-format `%I`.
 *   - All payload literal values (CONSTANT.value) are escaped via pg-format
 *     `%L`.
 *   - `srcExpr` is caller-constructed (engine.ts) and is the trust boundary:
 *     it must be safely-constructed (e.g., via quote_ident on staging column
 *     names) before being passed in. The compiler interpolates it directly
 *     into SQL fragments — passing user-controlled strings here is a security
 *     bug at the caller.
 *   - CONSTANT.value also passes through a denylist of timestamp-aware and
 *     non-deterministic tokens (per idempotency requirement, PLAN v4 §2.8 R8).
 */
import format from "pg-format";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UnsupportedTransformError extends Error {
  constructor(
    public readonly transformCode: string,
    public readonly mappingId?: string,
  ) {
    super(
      `Transform "${transformCode}" is not supported in Goal 001a` +
        (mappingId ? ` (mapping_id=${mappingId})` : ""),
    );
    this.name = "UnsupportedTransformError";
  }
}

export class InvalidConstantPayloadError extends Error {
  constructor(
    public readonly value: unknown,
    public readonly reason: string,
    public readonly mappingId?: string,
  ) {
    super(
      `Invalid CONSTANT payload value: ${reason}` +
        (mappingId ? ` (mapping_id=${mappingId})` : ""),
    );
    this.name = "InvalidConstantPayloadError";
  }
}

export class InvalidLookupFkPayloadError extends Error {
  constructor(
    public readonly reason: string,
    public readonly mappingId?: string,
  ) {
    super(
      `Invalid LOOKUP_FK payload: ${reason}` +
        (mappingId ? ` (mapping_id=${mappingId})` : ""),
    );
    this.name = "InvalidLookupFkPayloadError";
  }
}

export class InvalidJsonExtractPayloadError extends Error {
  constructor(
    public readonly reason: string,
    public readonly mappingId?: string,
  ) {
    super(
      `Invalid JSON_EXTRACT payload: ${reason}` +
        (mappingId ? ` (mapping_id=${mappingId})` : ""),
    );
    this.name = "InvalidJsonExtractPayloadError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnMappingInput {
  /**
   * Transform code from `brownfield.column_mappings.column_mapping_transform`.
   * `null` is treated as `DIRECT_COPY` (passthrough).
   */
  transformCode: string | null;

  /**
   * The `transform_payload` JSONB from `brownfield.column_mappings`. May be
   * `{}` for transforms that don't need configuration.
   */
  payload: Record<string, unknown>;

  /**
   * Pre-constructed SQL expression for the source value. The caller
   * (engine.ts) is responsible for safe construction — typically via
   * `quote_ident` on the staging column name, or a jsonb-path extract like
   * `(staging_raw_record->>'col_name')`. The compiler interpolates this
   * verbatim into SQL fragments. DO NOT pass user-controlled strings here.
   */
  srcExpr: string;

  /**
   * Target column name in the destination `sys.*` table. Used for error
   * messages and result tagging only; not interpolated into the SQL fragment
   * by this compiler (caller wires it into the INSERT column list).
   */
  targetColumn: string;

  /**
   * Optional `brownfield.column_mappings.column_mapping_id` for error context.
   */
  mappingId?: string;
}

export interface SqlFragment {
  /** The SQL expression to use in the SELECT list of an INSERT … SELECT. */
  sql: string;
}

export interface CompileResult {
  /**
   * The compiled SQL fragment, or `null` if this column should be omitted
   * from the SELECT list (SKIP transform).
   */
  fragment: SqlFragment | null;
  /** Pass-through of `input.targetColumn` for caller convenience. */
  targetColumn: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Map from `CAST_*` transform code to the PG type to cast to. The whitelist
 * prevents injection via arbitrary type names.
 */
const CAST_TYPE_BY_CODE: Record<string, string> = {
  CAST_TIMESTAMPTZ: "TIMESTAMPTZ",
  CAST_INT: "INTEGER",
  CAST_VARCHAR: "VARCHAR",
  CAST_BOOLEAN: "BOOLEAN",
  CAST_NUMERIC: "NUMERIC",
};

/**
 * Tokens forbidden in `CONSTANT.value` to maintain run-to-run idempotency
 * (PLAN v4 §2.8 R8). Any of these substrings (case-insensitive) in the
 * trimmed value rejects compilation.
 */
const FORBIDDEN_CONSTANT_TOKENS: readonly string[] = [
  "now(",
  "current_timestamp",
  "current_date",
  "current_time",
  "localtimestamp",
  "localtime",
  "clock_timestamp(",
  "statement_timestamp(",
  "transaction_timestamp(",
  "timeofday(",
  "random()",
  "gen_random_uuid(",
  "nextval(",
  "currval(",
  "lastval(",
  "setval(",
];

/**
 * Transform codes supported by 001a's compiler — the 12 mechanical codes
 * from PLAN v4 §1 (plus `null` treated as DIRECT_COPY). Any other code
 * raises `UnsupportedTransformError`.
 */
export const SUPPORTED_TRANSFORMS: ReadonlySet<string | null> = new Set<string | null>([
  null,
  "DIRECT_COPY",
  "CAST_TIMESTAMPTZ",
  "CAST_INT",
  "CAST_VARCHAR",
  "CAST_BOOLEAN",
  "CAST_NUMERIC",
  "TRIM",
  "UPPERCASE",
  "LOWERCASE",
  "CONSTANT",
  "SKIP",
  "LOOKUP_FK",
  "JSON_EXTRACT",
  "LINEAGE_SOURCE_NK",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertConstantPayloadValue(v: unknown, mappingId?: string): void {
  if (v === null || v === undefined) return;
  const t = typeof v;
  if (t === "number" || t === "boolean") return;
  if (t === "string") {
    const lower = (v as string).trim().toLowerCase();
    for (const tok of FORBIDDEN_CONSTANT_TOKENS) {
      if (lower.includes(tok)) {
        throw new InvalidConstantPayloadError(
          v,
          `value contains forbidden token "${tok}" (non-deterministic / time-aware)`,
          mappingId,
        );
      }
    }
    return;
  }
  if (Array.isArray(v) || (t === "object" && v !== null)) {
    // JSON literal — `pg-format` `%L` will JSON-stringify and quote safely.
    return;
  }
  throw new InvalidConstantPayloadError(v, `unsupported value type "${t}"`, mappingId);
}

function assertSrcExpr(srcExpr: string, mappingId?: string): void {
  if (typeof srcExpr !== "string" || srcExpr.length === 0) {
    throw new Error(
      `compileTransform: srcExpr must be a non-empty string` +
        (mappingId ? ` (mapping_id=${mappingId})` : ""),
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile one column mapping into a SQL fragment.
 *
 * @throws UnsupportedTransformError if the transform code is not in
 *         {@link SUPPORTED_TRANSFORMS}.
 * @throws InvalidConstantPayloadError if a CONSTANT transform's payload
 *         contains a forbidden token or unsupported value type.
 * @throws InvalidLookupFkPayloadError if a LOOKUP_FK transform's payload
 *         is missing required fields.
 */
export function compileTransform(input: ColumnMappingInput): CompileResult {
  const { transformCode, payload, srcExpr, targetColumn, mappingId } = input;

  assertSrcExpr(srcExpr, mappingId);

  if (!SUPPORTED_TRANSFORMS.has(transformCode)) {
    throw new UnsupportedTransformError(
      transformCode ?? "<null-not-routed>",
      mappingId,
    );
  }

  switch (transformCode) {
    case null:
    case "DIRECT_COPY":
      return { fragment: { sql: srcExpr }, targetColumn };

    case "TRIM":
      return { fragment: { sql: `TRIM(${srcExpr})` }, targetColumn };

    case "UPPERCASE":
      return { fragment: { sql: `UPPER(${srcExpr})` }, targetColumn };

    case "LOWERCASE":
      return { fragment: { sql: `LOWER(${srcExpr})` }, targetColumn };

    case "CAST_TIMESTAMPTZ":
    case "CAST_INT":
    case "CAST_VARCHAR":
    case "CAST_BOOLEAN":
    case "CAST_NUMERIC": {
      const pgType = CAST_TYPE_BY_CODE[transformCode];
      // pgType is from internal whitelist, no injection risk
      return { fragment: { sql: `CAST(${srcExpr} AS ${pgType})` }, targetColumn };
    }

    case "CONSTANT": {
      const v = payload?.value;
      assertConstantPayloadValue(v, mappingId);
      // %L safely quotes string / number / boolean / null / json
      const literalSql = format("%L", v ?? null);
      return { fragment: { sql: literalSql }, targetColumn };
    }

    case "SKIP":
      return { fragment: null, targetColumn };

    case "LINEAGE_SOURCE_NK":
      // Goal 002 Item B: legacy PK is captured by the lineage write path
      // (upsert-sql.ts lineage JOIN populates source_lineage_source_record_id
      // via staging_source_record_id). The compiler emits no fragment;
      // engine.ts pre-filter records audit row HANDLED_VIA_LINEAGE_WRITE_V1.
      return { fragment: null, targetColumn };

    case "JSON_EXTRACT": {
      // Goal 002 Item A: extract a jsonb subtree from the raw record by
      // traversing `payload.path` ($.<seg1>.<seg2>...) via the PG `->`
      // operator chain. Each segment escaped via pg-format %L for SQL-injection
      // safety. Path semantics match JS-side transforms.ts:109-124 (depth>=1,
      // bracket-notation segments treated as literal keys returning NULL).
      const path = payload?.path;
      if (typeof path !== "string") {
        throw new InvalidJsonExtractPayloadError(
          `payload.path missing or not a string`,
          mappingId,
        );
      }
      const stripped = path.replace(/^\$\.?/, "");
      const segments = stripped.split(".").filter((s) => s.length > 0);
      if (segments.length === 0) {
        // Empty path or only "$" prefix: NULL::jsonb fallback per PLAN §2.4.2.
        return { fragment: { sql: "NULL::jsonb" }, targetColumn };
      }
      let chain = `(${srcExpr})`;
      for (const seg of segments) {
        chain = `${chain} -> ${format("%L", seg)}`;
      }
      return { fragment: { sql: `(${chain})` }, targetColumn };
    }

    case "LOOKUP_FK": {
      // Goal 002 Item C: read payload.match_on from the registry instead of
      // inventing column names via target_table convention. Accepted forms
      // (real-data observed in Goal 002 EXEC step 0 R2 pre-check):
      //   - plain column:    "legacy_tenant_id"                     (33/49)
      //   - jsonb extract:   "metadata->>legacy_id" (NO quotes)     (16/49)
      // PLAN §2.4.1 regex amended to also accept the quoted variant
      // "metadata->>'legacy_id'" for forward compatibility; quotes auto-added
      // during compile so SQL emission is uniform.
      const targetTable = payload?.target_table;
      if (typeof targetTable !== "string" || targetTable.length === 0) {
        throw new InvalidLookupFkPayloadError(
          `payload.target_table missing or not a non-empty string`,
          mappingId,
        );
      }
      const matchOn = payload?.match_on;
      if (typeof matchOn !== "string" || matchOn.length === 0) {
        throw new InvalidLookupFkPayloadError(
          `payload.match_on missing or not a non-empty string`,
          mappingId,
        );
      }
      const matchOnRegex = /^([a-z_][a-z0-9_]*)(?:->>'?([a-z_][a-z0-9_]*)'?)?$/;
      const matched = matchOnRegex.exec(matchOn);
      if (!matched) {
        throw new InvalidLookupFkPayloadError(
          `payload.match_on "${matchOn}" does not match accepted forms ` +
            `(plain column or single-step jsonb extract)`,
          mappingId,
        );
      }
      const matchCol = matched[1]!;
      const matchKey = matched[2]; // undefined for plain-column form
      const short = targetTable.replace(/^sys_/, "");
      // Depluralize the table-name short form to derive the conventional PK:
      //   sys_tenancies   → tenancy_id   (was tenancies_id, did not exist)
      //   sys_skills      → skill_id     ✓ (simple "s" plural)
      //   sys_users       → user_id      ✓
      //   sys_learning_modules → learning_module_id ✓
      //   sys_blueprint_process_registry → blueprint_process_registry_id ✓ (no plural)
      // Bug uncovered post-Goal-002 Item C activation of the 49 LOOKUP_FK
      // mappings (was latent in Goal 001a because the codes were SKIPPED).
      const singular = short.endsWith("ies")
        ? short.slice(0, -3) + "y"
        : short.endsWith("s") && !short.endsWith("ss")
          ? short.slice(0, -1)
          : short;
      // PK overrides for tables whose PK name doesn't follow the depluralized
      // <short>_id convention. Verified via pg_constraint scan EXEC step 8:
      //   sys_tenancies                  → tenant_id      (NOT tenancy_id)
      //   sys_blueprint_process_registry → blueprint_process_id (drops "registry")
      const PK_OVERRIDES: Record<string, string> = {
        sys_tenancies: "tenant_id",
        sys_blueprint_process_registry: "blueprint_process_id",
      };
      const returnCol =
        typeof payload?.return_col === "string" && (payload.return_col as string).length > 0
          ? (payload.return_col as string)
          : (PK_OVERRIDES[targetTable] ?? `${singular}_id`);
      if (!/^[a-z_][a-z0-9_]*$/.test(returnCol)) {
        throw new InvalidLookupFkPayloadError(
          `payload.return_col "${returnCol}" must be a plain column name ` +
            `(PK columns are always plain)`,
          mappingId,
        );
      }
      // pg-format: %I escapes identifiers, %L escapes literals,
      // %s interpolates already-safe srcExpr.
      const whereClause = matchKey
        ? format("%I->>%L = (%s)", matchCol, matchKey, srcExpr)
        : format("%I = (%s)", matchCol, srcExpr);
      const sql = format(
        "(SELECT %I FROM sys.%I WHERE %s LIMIT 1)",
        returnCol,
        targetTable,
        whereClause,
      );
      return { fragment: { sql }, targetColumn };
    }

    default:
      // Unreachable: SUPPORTED_TRANSFORMS check above blocks any other value.
      // Re-throw for exhaustive typing.
      throw new UnsupportedTransformError(transformCode, mappingId);
  }
}
