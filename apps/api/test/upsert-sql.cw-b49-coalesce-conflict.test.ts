/**
 * apps/api/test/upsert-sql.cw-b49-coalesce-conflict.test.ts
 *
 * CW-B49 (X10, 2026-05-23) — verify that the new paren-aware substitution
 * helper `replaceTargetColsInConflictInference` correctly produces a
 * DISTINCT ON / ON CONFLICT key expression for the following 4 cases:
 *   T1 — sys_learning_paths UQ (COALESCE nullable-NK + flat col)
 *   T2 — sys_skill_taxonomy_edges UQ (flat NK regression check)
 *   T3 — sys_skill_aliases UQ (lower() wrap + COALESCE composition)
 *   T4 — edge case: target col is a sub-string of another col
 *
 * Spec authority: cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md §4-5
 */
import { describe, it, expect } from "vitest";
import {
  replaceTargetColsInConflictInference,
  type ColEntry,
} from "../src/modules/brownfield-wave-executor/upsert-sql.js";

describe("replaceTargetColsInConflictInference — CW-B49 split-on-COALESCE fix", () => {
  // T1 — sys_learning_paths (nullable-NK COALESCE wrap + flat col)
  it("substitutes targets inside COALESCE(col, sentinel) wrap without breaking the expression", () => {
    const conflictInference =
      "COALESCE(learning_path_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), learning_path_code";
    const colEntries: ColEntry[] = [
      { targetCol: "learning_path_tenant_id", sql: "NULL::uuid" },
      {
        targetCol: "learning_path_code",
        sql: "TRIM(staging_raw_record->>'code')",
      },
    ];
    const out = replaceTargetColsInConflictInference(conflictInference, colEntries);
    expect(out).toBe(
      "COALESCE((NULL::uuid), '00000000-0000-0000-0000-000000000000'::uuid), (TRIM(staging_raw_record->>'code'))",
    );
    // Sanity: no leftover raw bare reference to either NK column
    expect(out).not.toMatch(/(?<!\()learning_path_tenant_id(?!\))/);
    expect(out).not.toMatch(/(?<!\()learning_path_code(?!\))/);
  });

  // T2 — sys_skill_taxonomy_edges (flat 3-col UQ — regression check, no COALESCE)
  it("regression: flat comma-separated NK UQ still substitutes 1:1 (no COALESCE)", () => {
    const conflictInference =
      "skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id, skill_taxonomy_edge_kind";
    const colEntries: ColEntry[] = [
      {
        targetCol: "skill_taxonomy_edge_parent_id",
        sql: "(SELECT skill_id FROM sys.sys_skills LIMIT 1)",
      },
      {
        targetCol: "skill_taxonomy_edge_child_id",
        sql: "(SELECT skill_id FROM sys.sys_skills LIMIT 1)",
      },
      { targetCol: "skill_taxonomy_edge_kind", sql: "'IS_A'::varchar" },
    ];
    const out = replaceTargetColsInConflictInference(conflictInference, colEntries);
    expect(out).toBe(
      "((SELECT skill_id FROM sys.sys_skills LIMIT 1)), ((SELECT skill_id FROM sys.sys_skills LIMIT 1)), ('IS_A'::varchar)",
    );
  });

  // T3 — sys_skill_aliases (lower() function wrap composed with COALESCE)
  it("substitutes inside nested function calls (lower((col)::text)) preserving the wrap", () => {
    const conflictInference =
      "COALESCE(skill_alias_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower((skill_alias_label)::text)";
    const colEntries: ColEntry[] = [
      { targetCol: "skill_alias_tenant_id", sql: "NULL::uuid" },
      {
        targetCol: "skill_alias_label",
        sql: "TRIM(staging_raw_record->>'alias')",
      },
    ];
    const out = replaceTargetColsInConflictInference(conflictInference, colEntries);
    expect(out).toBe(
      "COALESCE((NULL::uuid), '00000000-0000-0000-0000-000000000000'::uuid), lower(((TRIM(staging_raw_record->>'alias')))::text)",
    );
    // The lower() and the ::text cast must still wrap the expression
    expect(out).toMatch(/lower\(/);
    expect(out).toMatch(/::text\)/);
  });

  // T4 — edge case: target col is a substring of another col
  it("word-boundary regex prevents partial replacement (sub-string targets stay distinct)", () => {
    // `code` is a substring of `learning_path_code`. If we used a naive
    // String.replace without \b, replacing `code` first would corrupt
    // `learning_path_code`. The helper must respect word boundaries.
    const conflictInference = "learning_path_code, code";
    const colEntries: ColEntry[] = [
      { targetCol: "code", sql: "UPPER(staging_raw_record->>'c')" },
      {
        targetCol: "learning_path_code",
        sql: "TRIM(staging_raw_record->>'code')",
      },
    ];
    const out = replaceTargetColsInConflictInference(conflictInference, colEntries);
    // The longer name must be substituted using its own entry; the shorter
    // `code` token must only replace the standalone occurrence, not the
    // suffix of `learning_path_code`.
    expect(out).toContain("(TRIM(staging_raw_record->>'code'))");
    expect(out).toContain("(UPPER(staging_raw_record->>'c'))");
    // No leftover bare `learning_path_code` token outside parens
    expect(out).not.toMatch(/(?<!\()learning_path_code(?!\))/);
    // The trailing standalone `, code` becomes `, (UPPER(...))`
    expect(out).toMatch(/,\s*\(UPPER\(staging_raw_record->>'c'\)\)\s*$/);
  });
});
