/**
 * apps/api/test/transform-compiler.test.ts
 *
 * Unit tests for `transform-compiler.ts`. Covers all 12 supported mechanical
 * codes + UnsupportedTransformError paths + adversarial SQL-injection tests
 * (PLAN v4 §2.6 A14 acceptance criterion).
 */
import { describe, it, expect } from "vitest";
import {
  compileTransform,
  UnsupportedTransformError,
  InvalidConstantPayloadError,
  InvalidLookupFkPayloadError,
  SUPPORTED_TRANSFORMS,
  type ColumnMappingInput,
} from "../src/modules/brownfield-wave-executor/transform-compiler.js";

const SRC = "src_col";

function baseInput(
  transformCode: string | null,
  payload: Record<string, unknown> = {},
  overrides: Partial<ColumnMappingInput> = {},
): ColumnMappingInput {
  return {
    transformCode,
    payload,
    srcExpr: SRC,
    targetColumn: "target_col",
    mappingId: "test-mapping-id",
    ...overrides,
  };
}

describe("compileTransform — basic mechanical transforms", () => {
  it("null → DIRECT_COPY passthrough", () => {
    const r = compileTransform(baseInput(null));
    expect(r.fragment?.sql).toBe(SRC);
    expect(r.targetColumn).toBe("target_col");
  });

  it("DIRECT_COPY → passthrough", () => {
    const r = compileTransform(baseInput("DIRECT_COPY"));
    expect(r.fragment?.sql).toBe(SRC);
  });

  it("TRIM → TRIM(src)", () => {
    const r = compileTransform(baseInput("TRIM"));
    expect(r.fragment?.sql).toBe(`TRIM(${SRC})`);
  });

  it("UPPERCASE → UPPER(src)", () => {
    const r = compileTransform(baseInput("UPPERCASE"));
    expect(r.fragment?.sql).toBe(`UPPER(${SRC})`);
  });

  it("LOWERCASE → LOWER(src)", () => {
    const r = compileTransform(baseInput("LOWERCASE"));
    expect(r.fragment?.sql).toBe(`LOWER(${SRC})`);
  });

  it("SKIP → fragment = null", () => {
    const r = compileTransform(baseInput("SKIP"));
    expect(r.fragment).toBeNull();
    expect(r.targetColumn).toBe("target_col");
  });
});

describe("compileTransform — CAST family", () => {
  const cases: Array<[string, string]> = [
    ["CAST_TIMESTAMPTZ", "TIMESTAMPTZ"],
    ["CAST_INT", "INTEGER"],
    ["CAST_VARCHAR", "VARCHAR"],
    ["CAST_BOOLEAN", "BOOLEAN"],
    ["CAST_NUMERIC", "NUMERIC"],
  ];
  for (const [code, pgType] of cases) {
    it(`${code} → CAST(src AS ${pgType})`, () => {
      const r = compileTransform(baseInput(code));
      expect(r.fragment?.sql).toBe(`CAST(${SRC} AS ${pgType})`);
    });
  }
});

describe("compileTransform — CONSTANT", () => {
  it("string value quoted via %L", () => {
    const r = compileTransform(baseInput("CONSTANT", { value: "PRIMARY" }));
    expect(r.fragment?.sql).toBe(`'PRIMARY'`);
  });

  it("number value emitted as quoted literal (pg-format %L behaviour)", () => {
    const r = compileTransform(baseInput("CONSTANT", { value: 42 }));
    // pg-format `%L` quotes ALL scalar values as SQL string literals; PG
    // coerces `'42'::int` at runtime if the target column type requires it.
    expect(r.fragment?.sql).toBe(`'42'`);
  });

  it("boolean true is safely quoted", () => {
    const r = compileTransform(baseInput("CONSTANT", { value: true }));
    // pg-format emits booleans; accept any form that round-trips to true (TRUE / 't' / etc.)
    expect(r.fragment?.sql.toLowerCase()).toMatch(/(true|'t')/);
  });

  it("null value → NULL", () => {
    const r = compileTransform(baseInput("CONSTANT", { value: null }));
    expect(r.fragment?.sql).toBe(`NULL`);
  });

  it("undefined / missing value → NULL", () => {
    const r = compileTransform(baseInput("CONSTANT", {}));
    expect(r.fragment?.sql).toBe(`NULL`);
  });

  it("single-quote in value escaped via doubling (no injection)", () => {
    const r = compileTransform(baseInput("CONSTANT", { value: "O'Brien" }));
    // pg-format escapes ' to '' inside single-quoted literal
    expect(r.fragment?.sql).toContain("O''Brien");
    expect(r.fragment?.sql).toMatch(/^'.+'$/);
  });

  it("JSON object value → safely serialized", () => {
    const r = compileTransform(baseInput("CONSTANT", { value: { foo: "bar" } }));
    expect(r.fragment).not.toBeNull();
    expect(r.fragment!.sql).toContain("foo");
    expect(r.fragment!.sql).toContain("bar");
  });
});

describe("compileTransform — CONSTANT idempotency rejection (R8)", () => {
  const forbidden = [
    "now()",
    "current_timestamp",
    "CURRENT_TIMESTAMP",
    "random()",
    "gen_random_uuid()",
    "nextval('foo_seq')",
    "select random()",
  ];
  for (const v of forbidden) {
    it(`rejects forbidden token "${v}"`, () => {
      expect(() => compileTransform(baseInput("CONSTANT", { value: v }))).toThrow(
        InvalidConstantPayloadError,
      );
    });
  }

  it("rejects unsupported value type (e.g. function)", () => {
    expect(() =>
      compileTransform(baseInput("CONSTANT", { value: () => 42 } as Record<string, unknown>)),
    ).toThrow(InvalidConstantPayloadError);
  });
});

describe("compileTransform — LOOKUP_FK (Goal 002 Item C: match_on payload)", () => {
  it("plain column match_on=legacy_tenant_id → WHERE legacy_tenant_id, return_col depluralized to tenancy_id", () => {
    const r = compileTransform(
      baseInput("LOOKUP_FK", { target_table: "sys_tenancies", match_on: "legacy_tenant_id" }),
    );
    expect(r.fragment).not.toBeNull();
    const sql = r.fragment!.sql;
    expect(sql).toContain("sys_tenancies");
    expect(sql).toContain("legacy_tenant_id");
    // Depluralization fix: sys_tenancies → tenancy_id (not tenancies_id)
    expect(sql).toContain("tenancy_id");
    expect(sql).not.toContain("tenancies_id");
    expect(sql).toContain(`= (${SRC})`);
    expect(sql).toContain("LIMIT 1");
    // No multi-OR clause anymore — secondary convention removed (PLAN §2.2 Item C)
    expect(sql).not.toContain(" OR ");
  });

  it("expression form with quoted key: match_on=metadata->>'legacy_id' → escaped %L", () => {
    const r = compileTransform(
      baseInput("LOOKUP_FK", {
        target_table: "sys_learning_modules",
        match_on: "learning_module_metadata->>'legacy_id'",
      }),
    );
    const sql = r.fragment!.sql;
    expect(sql).toContain("learning_module_metadata->>'legacy_id'");
    expect(sql).toContain("sys_learning_modules");
  });

  it("expression form WITHOUT quoted key (real-data form): match_on=metadata->>legacy_id → auto-quoted", () => {
    // R2 amendment: real payloads in brownfield.column_mappings have NO quotes
    // around the jsonb key (e.g. "learning_module_metadata->>legacy_id").
    // Compiler auto-quotes the key during SQL emission for uniformity.
    const r = compileTransform(
      baseInput("LOOKUP_FK", {
        target_table: "sys_learning_modules",
        match_on: "learning_module_metadata->>legacy_id",
      }),
    );
    const sql = r.fragment!.sql;
    expect(sql).toContain("learning_module_metadata->>'legacy_id'");
  });

  it("explicit return_col override (plain column form)", () => {
    const r = compileTransform(
      baseInput("LOOKUP_FK", {
        target_table: "sys_skill_categories",
        match_on: "skill_category_code",
        return_col: "skill_category_id",
      }),
    );
    const sql = r.fragment!.sql;
    expect(sql).toContain("skill_category_id");
    expect(sql).toContain("skill_category_code");
    expect(sql).toContain("sys_skill_categories");
  });

  it("rejects missing match_on", () => {
    expect(() =>
      compileTransform(baseInput("LOOKUP_FK", { target_table: "sys_users" })),
    ).toThrow(InvalidLookupFkPayloadError);
  });

  it("adversarial: match_on with quote-injection → InvalidLookupFkPayloadError", () => {
    expect(() =>
      compileTransform(
        baseInput("LOOKUP_FK", {
          target_table: "sys_users",
          match_on: "legacy';DROP TABLE--",
        }),
      ),
    ).toThrow(InvalidLookupFkPayloadError);
  });

  it("adversarial: match_on chained extract col->>'a'->>'b' → InvalidLookupFkPayloadError", () => {
    expect(() =>
      compileTransform(
        baseInput("LOOKUP_FK", {
          target_table: "sys_users",
          match_on: "metadata->>'a'->>'b'",
        }),
      ),
    ).toThrow(InvalidLookupFkPayloadError);
  });

  it("adversarial: match_on appended statement col->>'k';DROP-- → InvalidLookupFkPayloadError", () => {
    expect(() =>
      compileTransform(
        baseInput("LOOKUP_FK", {
          target_table: "sys_users",
          match_on: "col->>'k';DROP--",
        }),
      ),
    ).toThrow(InvalidLookupFkPayloadError);
  });

  it("rejects missing target_table", () => {
    expect(() => compileTransform(baseInput("LOOKUP_FK", { match_on: "x" }))).toThrow(
      InvalidLookupFkPayloadError,
    );
  });

  it("rejects non-string target_table", () => {
    expect(() =>
      compileTransform(
        baseInput("LOOKUP_FK", { target_table: 123, match_on: "x" } as Record<string, unknown>),
      ),
    ).toThrow(InvalidLookupFkPayloadError);
  });

  it("rejects empty target_table", () => {
    expect(() =>
      compileTransform(baseInput("LOOKUP_FK", { target_table: "", match_on: "x" })),
    ).toThrow(InvalidLookupFkPayloadError);
  });
});

describe("compileTransform — UnsupportedTransformError", () => {
  const unsupported = [
    // JSON_EXTRACT + LINEAGE_SOURCE_NK promoted to supported in Goal 002 (Items A/B)
    "CAST_UUID",          // 0 mappings (vocabulary only)
    "CAST_DATE",          // 0 mappings
    "DEFAULT_IF_NULL",    // 0 mappings
    "HASH_SHA256",        // 0 mappings
    "CONTENT_HASH",       // 0 mappings
    "NATURAL_KEY",        // 0 mappings
    "CONCAT",             // 0 mappings
    "REGEX_EXTRACT",      // 0 mappings
    "SYNTHETIC_FLAG",     // 0 mappings
    "TOTALLY_BOGUS_CODE", // never existed
  ];
  for (const code of unsupported) {
    it(`throws UnsupportedTransformError for "${code}"`, () => {
      try {
        compileTransform(baseInput(code));
        expect.fail(`expected UnsupportedTransformError for ${code}`);
      } catch (e) {
        expect(e).toBeInstanceOf(UnsupportedTransformError);
        const err = e as UnsupportedTransformError;
        expect(err.transformCode).toBe(code);
        expect(err.mappingId).toBe("test-mapping-id");
      }
    });
  }
});

describe("compileTransform — srcExpr validation", () => {
  it("rejects empty srcExpr", () => {
    expect(() => compileTransform(baseInput("DIRECT_COPY", {}, { srcExpr: "" }))).toThrow();
  });
});

describe("compileTransform — SQL injection adversarial (A14)", () => {
  /**
   * Strip single-quoted literals and double-quoted identifiers, then check
   * whether the remainder contains executable tokens. pg-format wraps all
   * literals in '...' and all idents in "...", so anything outside these
   * regions should be only structural SQL (SELECT, FROM, WHERE, etc.).
   */
  function emittedSqlIsSafe(sql: string): boolean {
    let stripped = sql;
    // remove single-quoted literals (handle '' escape inside)
    stripped = stripped.replace(/'(?:[^']|'')*'/g, "''");
    // remove double-quoted identifiers (handle "" escape inside)
    stripped = stripped.replace(/"(?:[^"]|"")*"/g, '""');
    const upper = stripped.toUpperCase();
    if (upper.includes("DROP TABLE")) return false;
    if (upper.includes("DROP SCHEMA")) return false;
    if (upper.includes("DELETE FROM")) return false;
    if (/\bUPDATE\b/.test(upper)) return false;
    if (stripped.includes(";")) return false;
    if (stripped.includes("--")) return false;
    return true;
  }

  it("CONSTANT value attempts SQL break-out — quoted inert via %L", () => {
    const payload = { value: "'); DROP TABLE sys.sys_users; --" };
    const r = compileTransform(baseInput("CONSTANT", payload));
    expect(r.fragment).not.toBeNull();
    expect(emittedSqlIsSafe(r.fragment!.sql)).toBe(true);
    // confirm the dangerous tokens are quoted (inside a literal), not raw
    expect(r.fragment!.sql).toMatch(/^'.+'$/);
  });

  it("LOOKUP_FK target_table injection — rejected via return_col plain-name validation (Goal 002 Item C)", () => {
    // Defense-in-depth: malformed target_table cascades to a malformed default
    // return_col (`<short>_id`) which the plain-column whitelist regex rejects.
    // Throwing at compile time is preferable to emitting %I-quoted-but-still-
    // semantically-wrong SQL that PG would reject at runtime.
    const payload = {
      target_table: "sys; DROP TABLE sys_skills; --",
      match_on: "legacy_id",
    };
    expect(() => compileTransform(baseInput("LOOKUP_FK", payload))).toThrow(
      InvalidLookupFkPayloadError,
    );
  });

  it("LOOKUP_FK return_col injection attempt — rejected at compile time", () => {
    // Explicit return_col with injection payload must be rejected by the
    // plain-name regex (PK columns are always plain identifiers).
    const payload = {
      target_table: "sys_users",
      match_on: "legacy_id",
      return_col: "user_id\"; DROP TABLE sys_users; --",
    };
    expect(() => compileTransform(baseInput("LOOKUP_FK", payload))).toThrow(
      InvalidLookupFkPayloadError,
    );
  });

  it("CONSTANT idempotency violation: now() — rejected at compile time", () => {
    expect(() => compileTransform(baseInput("CONSTANT", { value: "now()" }))).toThrow(
      InvalidConstantPayloadError,
    );
  });

  it("all 12 mechanical transforms emit safe SQL", () => {
    const samples: Array<[string | null, Record<string, unknown>]> = [
      [null, {}],
      ["DIRECT_COPY", {}],
      ["TRIM", {}],
      ["UPPERCASE", {}],
      ["LOWERCASE", {}],
      ["CAST_TIMESTAMPTZ", {}],
      ["CAST_INT", {}],
      ["CAST_VARCHAR", {}],
      ["CAST_BOOLEAN", {}],
      ["CAST_NUMERIC", {}],
      ["CONSTANT", { value: "safe_value" }],
      ["LOOKUP_FK", { target_table: "sys_users", match_on: "legacy_id" }],
    ];
    for (const [code, payload] of samples) {
      const r = compileTransform(baseInput(code, payload));
      if (r.fragment) {
        expect(
          emittedSqlIsSafe(r.fragment.sql),
          `transform=${code}, sql=${r.fragment.sql}`,
        ).toBe(true);
      }
    }
  });
});

describe("compileTransform — SUPPORTED_TRANSFORMS export", () => {
  it("contains exactly 15 entries (12 mechanical + LOOKUP_FK + JSON_EXTRACT + LINEAGE_SOURCE_NK + null)", () => {
    expect(SUPPORTED_TRANSFORMS.size).toBe(15);
    expect(SUPPORTED_TRANSFORMS.has(null)).toBe(true);
    for (const code of [
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
    ]) {
      expect(SUPPORTED_TRANSFORMS.has(code)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Goal 002 Item A — JSON_EXTRACT compile fragment
// ---------------------------------------------------------------------------

describe("compileTransform — JSON_EXTRACT (Goal 002 Item A)", () => {
  it("happy path: $.legacy.tenant_id → ((src) -> 'legacy' -> 'tenant_id')", async () => {
    const { InvalidJsonExtractPayloadError: _ignore } = await import(
      "../src/modules/brownfield-wave-executor/transform-compiler.js"
    );
    void _ignore;
    const r = compileTransform(baseInput("JSON_EXTRACT", { path: "$.legacy.tenant_id" }));
    expect(r.fragment?.sql).toBe(`((${SRC}) -> 'legacy' -> 'tenant_id')`);
    expect(r.targetColumn).toBe("target_col");
  });

  it("depth 1: $.legacy → ((src) -> 'legacy')", () => {
    const r = compileTransform(baseInput("JSON_EXTRACT", { path: "$.legacy" }));
    expect(r.fragment?.sql).toBe(`((${SRC}) -> 'legacy')`);
  });

  it("bracket outlier $.phases[].order → literal jsonb key chain", () => {
    const r = compileTransform(baseInput("JSON_EXTRACT", { path: "$.phases[].order" }));
    expect(r.fragment?.sql).toBe(`((${SRC}) -> 'phases[]' -> 'order')`);
  });

  it("adversarial quote-injection: $.legacy.foo';DROP TABLE-- → escaped %L", () => {
    const r = compileTransform(
      baseInput("JSON_EXTRACT", { path: "$.legacy.foo';DROP TABLE--" }),
    );
    // pg-format %L doubles the embedded single quote
    expect(r.fragment?.sql).toBe(`((${SRC}) -> 'legacy' -> 'foo'';DROP TABLE--')`);
  });

  it("adversarial SQL keyword: $.legacy.SELECT → literal jsonb key 'SELECT'", () => {
    const r = compileTransform(baseInput("JSON_EXTRACT", { path: "$.legacy.SELECT" }));
    expect(r.fragment?.sql).toBe(`((${SRC}) -> 'legacy' -> 'SELECT')`);
  });

  it("adversarial dollar-quoting: $.legacy.$$evil$$ → literal jsonb key", () => {
    const r = compileTransform(baseInput("JSON_EXTRACT", { path: "$.legacy.$$evil$$" }));
    expect(r.fragment?.sql).toBe(`((${SRC}) -> 'legacy' -> '$$evil$$')`);
  });

  it("empty path string → NULL::jsonb fallback (no throw)", () => {
    const r = compileTransform(baseInput("JSON_EXTRACT", { path: "" }));
    expect(r.fragment?.sql).toBe("NULL::jsonb");
  });

  it("missing path key → InvalidJsonExtractPayloadError", async () => {
    const { InvalidJsonExtractPayloadError } = await import(
      "../src/modules/brownfield-wave-executor/transform-compiler.js"
    );
    expect(() => compileTransform(baseInput("JSON_EXTRACT", {}))).toThrowError(
      InvalidJsonExtractPayloadError,
    );
  });
});

// ---------------------------------------------------------------------------
// Goal 002 Item B — LINEAGE_SOURCE_NK compile fragment
// ---------------------------------------------------------------------------

describe("compileTransform — LINEAGE_SOURCE_NK (Goal 002 Item B)", () => {
  it("returns fragment=null (handled by lineage write path)", () => {
    const r = compileTransform(baseInput("LINEAGE_SOURCE_NK", { note: "legacy PK on lineage row" }));
    expect(r.fragment).toBeNull();
  });

  it("preserves targetColumn for caller routing", () => {
    const r = compileTransform(
      baseInput("LINEAGE_SOURCE_NK", { note: "x" }, { targetColumn: "skill_id" }),
    );
    expect(r.targetColumn).toBe("skill_id");
  });

  it("SUPPORTED_TRANSFORMS contains LINEAGE_SOURCE_NK", () => {
    expect(SUPPORTED_TRANSFORMS.has("LINEAGE_SOURCE_NK")).toBe(true);
  });
});
