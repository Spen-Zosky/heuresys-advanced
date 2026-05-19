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

describe("applyTypeCoerceWrap — negative / no-op cases", () => {
  it("non-passthrough transform (CAST_INT) returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, "int2", "CAST_INT")).toBe(FRAG);
  });

  it("non-passthrough transform (JSON_EXTRACT) returns frag unchanged", () => {
    expect(applyTypeCoerceWrap(FRAG, "jsonb", "JSON_EXTRACT")).toBe(FRAG);
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
