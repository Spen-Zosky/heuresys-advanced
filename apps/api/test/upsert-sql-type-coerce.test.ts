/**
 * apps/api/test/upsert-sql-type-coerce.test.ts
 *
 * Goal 003 Item K: TYPE_CAST_MAP completeness coverage.
 *
 * Tests the `applyTypeCoerceWrap` helper extracted from `buildUpsertSql` in
 * `upsert-sql.ts`. Verifies:
 *   - Goal 003 Item K NEW types: interval, time, timetz, bytea
 *   - Goal 002 Item E regression: existing types (int2, numeric, bool, jsonb)
 *   - Negative cases: non-passthrough transform, unknown colType, undefined colType
 */
import { describe, it, expect } from "vitest";
import { applyTypeCoerceWrap } from "../src/modules/brownfield-wave-executor/upsert-sql.js";

const FRAG = "(staging_raw_record->>'col')";

describe("applyTypeCoerceWrap — Goal 003 Item K NEW types", () => {
  it("interval (PG) → CAST(... AS INTERVAL)", () => {
    expect(applyTypeCoerceWrap(FRAG, "interval", "DIRECT_COPY")).toBe(
      `CAST(${FRAG} AS INTERVAL)`,
    );
  });

  it("time (PG) → CAST(... AS TIME)", () => {
    expect(applyTypeCoerceWrap(FRAG, "time", "DIRECT_COPY")).toBe(
      `CAST(${FRAG} AS TIME)`,
    );
  });

  it("timetz (PG) → CAST(... AS TIMETZ)", () => {
    expect(applyTypeCoerceWrap(FRAG, "timetz", "DIRECT_COPY")).toBe(
      `CAST(${FRAG} AS TIMETZ)`,
    );
  });

  it("bytea (PG) → CAST(... AS BYTEA)", () => {
    expect(applyTypeCoerceWrap(FRAG, "bytea", "DIRECT_COPY")).toBe(
      `CAST(${FRAG} AS BYTEA)`,
    );
  });
});

describe("applyTypeCoerceWrap — Goal 002 Item E regression (existing types)", () => {
  it("int2 → SMALLINT", () => {
    expect(applyTypeCoerceWrap(FRAG, "int2", "DIRECT_COPY")).toBe(
      `CAST(${FRAG} AS SMALLINT)`,
    );
  });

  it("numeric → NUMERIC", () => {
    expect(applyTypeCoerceWrap(FRAG, "numeric", "TRIM")).toBe(
      `CAST(${FRAG} AS NUMERIC)`,
    );
  });

  it("bool → BOOLEAN (null transform = passthrough)", () => {
    expect(applyTypeCoerceWrap(FRAG, "bool", null)).toBe(
      `CAST(${FRAG} AS BOOLEAN)`,
    );
  });

  it("jsonb → JSONB", () => {
    expect(applyTypeCoerceWrap(FRAG, "jsonb", "DIRECT_COPY")).toBe(
      `CAST(${FRAG} AS JSONB)`,
    );
  });
});

describe("applyTypeCoerceWrap — Goal 003 Item B CAST_* compat-target wrap", () => {
  it("CAST_INT + int2 (smallint) → outer CAST AS SMALLINT (was the blocker case from Goal 002 REPORT §3.5)", () => {
    expect(applyTypeCoerceWrap(FRAG, "int2", "CAST_INT")).toBe(
      `CAST(${FRAG} AS SMALLINT)`,
    );
  });

  it("CAST_INT + int8 (bigint) → outer CAST AS BIGINT", () => {
    expect(applyTypeCoerceWrap(FRAG, "int8", "CAST_INT")).toBe(
      `CAST(${FRAG} AS BIGINT)`,
    );
  });

  it("CAST_INT + int4 (integer, same type) → outer CAST AS INTEGER (redundant but harmless)", () => {
    expect(applyTypeCoerceWrap(FRAG, "int4", "CAST_INT")).toBe(
      `CAST(${FRAG} AS INTEGER)`,
    );
  });

  it("CAST_NUMERIC + numeric target → outer CAST AS NUMERIC", () => {
    expect(applyTypeCoerceWrap(FRAG, "numeric", "CAST_NUMERIC")).toBe(
      `CAST(${FRAG} AS NUMERIC)`,
    );
  });

  it("CAST_BOOLEAN + bool target → outer CAST AS BOOLEAN", () => {
    expect(applyTypeCoerceWrap(FRAG, "bool", "CAST_BOOLEAN")).toBe(
      `CAST(${FRAG} AS BOOLEAN)`,
    );
  });

  it("CAST_TIMESTAMPTZ + timestamptz target → outer CAST AS TIMESTAMPTZ", () => {
    expect(applyTypeCoerceWrap(FRAG, "timestamptz", "CAST_TIMESTAMPTZ")).toBe(
      `CAST(${FRAG} AS TIMESTAMPTZ)`,
    );
  });

  it("CAST_TIMESTAMPTZ + timestamp target (downgrade) → outer CAST AS TIMESTAMP", () => {
    expect(applyTypeCoerceWrap(FRAG, "timestamp", "CAST_TIMESTAMPTZ")).toBe(
      `CAST(${FRAG} AS TIMESTAMP)`,
    );
  });
});

describe("applyTypeCoerceWrap — Goal 003 Item B negative cases (NO wrap)", () => {
  it("CAST_INT + numeric target (incompatible per compat map) → returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, "numeric", "CAST_INT")).toBe(FRAG);
  });

  it("CAST_INT + bool target (incompatible) → returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, "bool", "CAST_INT")).toBe(FRAG);
  });

  it("CAST_VARCHAR + any (compat map empty — varchar handled by truncation wrapper, not here) → returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, "varchar", "CAST_VARCHAR")).toBe(FRAG);
  });
});

describe("applyTypeCoerceWrap — negative / no-op cases (preserved from Item K)", () => {
  it("non-CAST transform (JSON_EXTRACT) returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, "jsonb", "JSON_EXTRACT")).toBe(FRAG);
  });

  it("non-CAST transform (LOOKUP_FK) returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, "int4", "LOOKUP_FK")).toBe(FRAG);
  });

  it("unknown colType returns frag unchanged (e.g., uuid intentionally excluded)", () => {
    expect(applyTypeCoerceWrap(FRAG, "uuid", "DIRECT_COPY")).toBe(FRAG);
  });

  it("unknown colType (text) returns frag unchanged (text targets handled by varchar wrapper, not here)", () => {
    expect(applyTypeCoerceWrap(FRAG, "text", "DIRECT_COPY")).toBe(FRAG);
  });

  it("undefined colType returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, undefined, "DIRECT_COPY")).toBe(FRAG);
  });
});
