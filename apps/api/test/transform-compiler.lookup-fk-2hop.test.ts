import { describe, it, expect } from "vitest";
import {
  compileTransform,
  InvalidLookupFkPayloadError,
} from "../src/modules/brownfield-wave-executor/transform-compiler.js";

// ADR-0017 (Cowork C9.2, SR_X9) — LOOKUP_FK_2HOP 5-test acceptance suite per
// spec §5. Reference: cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md

describe("compileTransform — LOOKUP_FK_2HOP (ADR-0017)", () => {
  // T1 — happy path
  it("emits 2-hop JOIN through legacy_mirror.esco_skills for certification_esco_skills.esco_skill_uri → sys_skills", () => {
    const result = compileTransform({
      transformCode: "LOOKUP_FK_2HOP",
      payload: {
        target_table: "sys_skills",
        match_on: "esco_skill_uri",
        lookup_2hop: {
          intermediate_schema: "legacy_mirror",
          intermediate_table: "esco_skills",
          intermediate_match_col: "uri",
          intermediate_pk_col: "id",
        },
      },
      srcExpr: "(staging_raw_record->>'esco_skill_uri')",
      targetColumn: "skill_id",
      mappingId: "test-2hop-T1",
    });
    expect(result.fragment).not.toBeNull();
    const sql = result.fragment!.sql;
    expect(sql).toContain("SELECT slr.source_lineage_target_record_id");
    // pg-format %I emits unquoted identifiers when safe (snake_case lowercase).
    expect(sql).toMatch(/FROM "?legacy_mirror"?\."?esco_skills"? lm/);
    expect(sql).toContain("JOIN sys.sys_source_lineage_records slr");
    expect(sql).toMatch(/lm\."?id"?::text/);
    expect(sql).toMatch(/lm\."?uri"?\s*=/);
    expect(sql).toContain("(staging_raw_record->>'esco_skill_uri')");
    expect(sql).toContain("slr.source_lineage_target_table_name = 'sys_skills'");
    expect(sql).toContain("LIMIT 1");
    expect(result.targetColumn).toBe("skill_id");
  });

  // T2 — payload missing lookup_2hop block → throws
  it("throws InvalidLookupFkPayloadError when lookup_2hop block missing", () => {
    expect(() =>
      compileTransform({
        transformCode: "LOOKUP_FK_2HOP",
        payload: {
          target_table: "sys_skills",
          match_on: "esco_skill_uri",
        },
        srcExpr: "src",
        targetColumn: "skill_id",
        mappingId: "test-2hop-T2",
      }),
    ).toThrow(InvalidLookupFkPayloadError);
  });

  // T3 — payload lookup_2hop missing one sub-field → throws
  it("throws InvalidLookupFkPayloadError when any lookup_2hop sub-field missing", () => {
    for (const omit of [
      "intermediate_schema",
      "intermediate_table",
      "intermediate_match_col",
      "intermediate_pk_col",
    ]) {
      const lookup_2hop: Record<string, string> = {
        intermediate_schema: "legacy_mirror",
        intermediate_table: "esco_skills",
        intermediate_match_col: "uri",
        intermediate_pk_col: "id",
      };
      delete lookup_2hop[omit];
      expect(
        () =>
          compileTransform({
            transformCode: "LOOKUP_FK_2HOP",
            payload: {
              target_table: "sys_skills",
              match_on: "esco_skill_uri",
              lookup_2hop,
            },
            srcExpr: "src",
            targetColumn: "skill_id",
            mappingId: `test-2hop-T3-${omit}`,
          }),
        `omit=${omit}`,
      ).toThrow(InvalidLookupFkPayloadError);
    }
  });

  // T4 — SQL injection escape via pg-format %I and %L
  it("escapes identifiers (%I) and target literal (%L) via pg-format", () => {
    const result = compileTransform({
      transformCode: "LOOKUP_FK_2HOP",
      payload: {
        target_table: "sys_skills",
        match_on: "esco_skill_uri",
        lookup_2hop: {
          intermediate_schema: "legacy_mirror",
          intermediate_table: "esco_skills",
          intermediate_match_col: "uri",
          intermediate_pk_col: "id",
        },
      },
      srcExpr: "(staging_raw_record->>'esco_skill_uri')",
      targetColumn: "skill_id",
      mappingId: "test-2hop-T4",
    });
    const sql = result.fragment!.sql;
    // pg-format %I quotes identifiers only when necessary; snake_case lowercase
    // is left unquoted. The contract is that identifiers come out safe, not that
    // they always carry quotes. We assert the structural shape stays correct.
    expect(sql).toMatch(/"?legacy_mirror"?\."?esco_skills"? lm/);
    expect(sql).toMatch(/lm\."?id"?::text/);
    expect(sql).toMatch(/lm\."?uri"?/);
    // Target table literal is single-quoted via %L
    expect(sql).toMatch(/= 'sys_skills'/);
    // Injection probe: a malicious schema name with embedded quote must be
    // fully quoted as a single SQL identifier — embedded `"` doubled to `""`
    // per pg-format %I behavior, so the payload becomes part of the name and
    // never closes the identifier or starts a new statement.
    const malicious = compileTransform({
      transformCode: "LOOKUP_FK_2HOP",
      payload: {
        target_table: "sys_skills",
        match_on: "esco_skill_uri",
        lookup_2hop: {
          intermediate_schema: 'legacy_mirror"; DROP TABLE sys_skills; --',
          intermediate_table: "esco_skills",
          intermediate_match_col: "uri",
          intermediate_pk_col: "id",
        },
      },
      srcExpr: "src",
      targetColumn: "skill_id",
      mappingId: "test-2hop-T4-injection",
    });
    const maliciousSql = malicious.fragment!.sql;
    // The whole dangerous schema is wrapped in a single double-quoted identifier
    // with the inner `"` doubled to `""` — verifying both confirms safe escape.
    expect(maliciousSql).toContain('"legacy_mirror""; DROP TABLE sys_skills; --"');
    // The unescaped `"; DROP TABLE` sequence (which would actually break out of
    // identifier quoting) must NOT appear anywhere.
    expect(maliciousSql).not.toMatch(/[^"]"; DROP TABLE/);
  });

  // T5 — SQL output structural shape: schema-qualified joins + LIMIT 1
  it("emits canonical SQL shape with schema-qualified joins and LIMIT 1", () => {
    const result = compileTransform({
      transformCode: "LOOKUP_FK_2HOP",
      payload: {
        target_table: "sys_skills",
        match_on: "esco_skill_uri",
        lookup_2hop: {
          intermediate_schema: "legacy_mirror",
          intermediate_table: "esco_skills",
          intermediate_match_col: "uri",
          intermediate_pk_col: "id",
        },
      },
      srcExpr: "(staging_raw_record->>'esco_skill_uri')",
      targetColumn: "skill_id",
      mappingId: "test-2hop-T5",
    });
    const sql = result.fragment!.sql;
    // Canonical structure: subselect wrapped in parens
    expect(sql.startsWith("(SELECT")).toBe(true);
    expect(sql.endsWith(")")).toBe(true);
    // Both required JOIN expressions present and in correct order
    const fromMatch = sql.match(/FROM "?legacy_mirror"?\."?esco_skills"?/);
    const fromIdx = fromMatch ? sql.indexOf(fromMatch[0]) : -1;
    const joinIdx = sql.indexOf("JOIN sys.sys_source_lineage_records slr");
    const whereIdx = sql.indexOf("WHERE");
    const limitIdx = sql.indexOf("LIMIT 1");
    expect(fromIdx).toBeGreaterThan(0);
    expect(joinIdx).toBeGreaterThan(fromIdx);
    expect(whereIdx).toBeGreaterThan(joinIdx);
    expect(limitIdx).toBeGreaterThan(whereIdx);
  });
});
