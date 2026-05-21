import { describe, it, expect } from "vitest";
import { compileTransform } from "../src/modules/brownfield-wave-executor/transform-compiler.js";

describe("CAST_ENUM transform (CW-B32 fix)", () => {
  it("emits CASE statement with value_map and ELSE NULL default", () => {
    const result = compileTransform({
      transformCode: "CAST_ENUM",
      payload: {
        value_map: { "1": "ENTRY", "2": "JUNIOR", "3": "MID" },
        default: null,
      },
      srcExpr: "(staging_raw_record->>'org_level')",
      targetColumn: "job_role_seniority_level",
      mappingId: "test-uuid",
    });
    expect(result.fragment).not.toBeNull();
    expect(result.fragment!.sql).toContain("CASE");
    expect(result.fragment!.sql).toContain("WHEN '1' THEN 'ENTRY'");
    expect(result.fragment!.sql).toContain("WHEN '2' THEN 'JUNIOR'");
    expect(result.fragment!.sql).toContain("WHEN '3' THEN 'MID'");
    expect(result.fragment!.sql).toContain("ELSE NULL");
    expect(result.targetColumn).toBe("job_role_seniority_level");
  });

  it("emits CASE with custom default literal", () => {
    const result = compileTransform({
      transformCode: "CAST_ENUM",
      payload: { value_map: { "1": "X" }, default: "UNKNOWN" },
      srcExpr: "src",
      targetColumn: "col",
      mappingId: "test",
    });
    expect(result.fragment!.sql).toContain("ELSE 'UNKNOWN'");
  });

  it("throws if value_map missing from payload", () => {
    expect(() =>
      compileTransform({
        transformCode: "CAST_ENUM",
        payload: {},
        srcExpr: "src",
        targetColumn: "col",
        mappingId: "test",
      }),
    ).toThrow(/value_map/);
  });

  it("throws if value_map is not an object", () => {
    expect(() =>
      compileTransform({
        transformCode: "CAST_ENUM",
        payload: { value_map: "not_an_object" },
        srcExpr: "src",
        targetColumn: "col",
        mappingId: "test",
      }),
    ).toThrow();
  });

  it("escapes SQL-injection attempts in value_map via pg-format %L", () => {
    const result = compileTransform({
      transformCode: "CAST_ENUM",
      payload: { value_map: { "1'; DROP TABLE--": "OK" } },
      srcExpr: "src",
      targetColumn: "col",
      mappingId: "test",
    });
    // pg-format %L escapes single quotes by doubling them — produces
    // '1''; DROP TABLE--' (entire string wrapped in literal quotes, embedded
    // single quote doubled). Verify the doubled-quote escape is present AND
    // the literal is wrapped, so the substring "'; DROP TABLE" only appears
    // INSIDE the safe literal (after a doubled quote), not as standalone SQL.
    expect(result.fragment!.sql).toContain("''");
    // The escaped literal form: WHEN '1''; DROP TABLE--' THEN 'OK'
    expect(result.fragment!.sql).toContain("'1''; DROP TABLE--'");
  });
});
