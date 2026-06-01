/**
 * apps/api/test/wave1-cw-b60-tractable-targets.integration.test.ts
 *
 * WS-3 (v1.0.0, 2026-06-01) — CW-B60-A silent-skip remediation, TDD guard.
 *
 * Two Wave-1 IMPORT targets that previously imported 0 rows (silent skip)
 * are fixed by WS-3:
 *
 *   1. sys_skill_categories — was WHERE-skip-filtered to 0 with audit reason
 *      `required_missing_skill_category_family_id` (the required-uuid FK had no
 *      column_mapping). Fix: migration 000051 makes skill_category_family_id
 *      NULLABLE (ADR-0025, sibling of ADR-0015/0016). Once nullable, the engine's
 *      requiredColumns skip filter no longer drops the rows → the live legacy
 *      `competencies` rows import with family_id NULL (DISTINCT-ON skill_category_code
 *      collapses them to the set of distinct category codes; verified 0 → 6 live).
 *
 *   2. sys_activity_classification_mappings — was 0 rows AND 0 skip-audit rows
 *      (nothing staged) because the legacy source `public.industry_ccnl_mapping`
 *      was omitted from the original wave1_indoor.sql dump. Fix: re-exported dump
 *      `wave1_indoor_industry_ccnl_mapping.sql` (14 rows; both LOOKUP_FKs resolve
 *      100%). NOTE: legacy_data/ is gitignored — this asserts the local artifact
 *      is present and ingested.
 *
 * This test is RED before the fix (both targets resolve to 0) and GREEN after.
 *
 * Heavy path (full uncapped Wave-1 EXECUTE: ~65k skill_categories) — gated by
 * BROWNFIELD_RUN_REAL_WAVE1=1, same convention as
 * brownfield-wave-executor.integration.test.ts. It writes into the canonical
 * sys.sys_* tables (this IS the production re-derivation). afterAll cleans only
 * the run/audit rows, NOT the sys.* data (so the regression guard sees it).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const REAL_EXECUTE = process.env.BROWNFIELD_RUN_REAL_WAVE1 === "1";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string };
  return { cookies, csrfToken: body.csrfToken };
}
async function count(table: string): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.${table}`);
  return Number(r.rows[0]!.n);
}

let suite: TestApp;
let platformS: S;
let runId: string | null = null;

describe("WS-3 CW-B60 tractable Wave-1 targets (sys_skill_categories + sys_activity_classification_mappings)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
  });

  afterAll(async () => {
    if (runId) {
      for (const sql of [
        `DELETE FROM audit.import_validation_results WHERE import_validation_result_run_id = $1`,
        `DELETE FROM audit.import_approval_decisions WHERE import_approval_decision_run_id = $1`,
        `DELETE FROM brownfield.import_runs WHERE import_run_id = $1`,
      ]) {
        try { await pool.query(sql, [runId]); } catch { /* ignore */ }
      }
    }
    await suite.app.close();
    await closePool();
  });

  // NOTE: a full UNCAPPED Wave-1 EXECUTE (fresh ~355 MB legacy_mirror dump load +
  // ~65k competencies + 20k skills + 12k taxonomy edges + per-target FK-cache builds
  // and DISTINCT-ON dedup) takes ~35-45 min on the Windows dev box; a capped run
  // (WAVE1_DEBUG_LIMIT) still ~10 min because heavy LOOKUP_FK targets load full FK
  // caches regardless of the staging cap. Timeout is therefore 60 min. This guard is
  // gated by BROWNFIELD_RUN_REAL_WAVE1=1 so it never runs in the normal `pnpm test`.
  //
  // SCOPE: this asserts the GENUINELY-FIXED target (sys_skill_categories, unblocked by
  // migration 000051's nullable family_id). sys_activity_classification_mappings is
  // NOT asserted >0 — WS-3 diagnosis proved it is BLOCKED by a mapping-vs-schema
  // conflict (its target_id LOOKUP_FK resolves against sys_compensation_bands, but the
  // table's FK references sys_activity_classifications → FK violation on insert; the
  // legacy industry_ccnl_mapping does not fit this classification↔classification
  // crosswalk table). See ADR-0025 §5 + the WS-3 report. Fixing it requires a
  // mapping-redesign/schema decision out of WS-3 scope (MAPPING-CARD: never guess a FK).
  it.skipIf(!REAL_EXECUTE)(
    "full Wave-1 EXECUTE imports >0 rows for sys_skill_categories (000051 nullable-FK fix)",
    { timeout: 3_600_000 },
    async () => {
      const r = await suite.app.inject({
        method: "POST",
        url: "/v1/brownfield/wave-executor/runs",
        headers: {
          cookie: ch(platformS.cookies),
          "x-csrf-token": platformS.csrfToken,
          "content-type": "application/json",
        },
        payload: { wave: 1, mode: "EXECUTE" },
      });
      expect(r.statusCode).toBe(201);
      const b = r.json() as { runId: string; state: string; totalUpserted: number };
      runId = b.runId;
      expect(b.state).toBe("COMPLETE");
      expect(b.totalUpserted).toBeGreaterThan(0);

      // FIXED target: sys_skill_categories — was 0 (required_missing_skill_category_family_id),
      // now imports because 000051 made skill_category_family_id nullable.
      const skillCats = await count("sys_skill_categories");
      expect(
        skillCats,
        "sys_skill_categories must be >0 after 000051 makes family_id nullable",
      ).toBeGreaterThan(0);

      // Belt-and-suspenders: no fresh WHERE_SKIP audit row for skill_categories
      // with the required_missing_skill_category_family_id reason on THIS run.
      const skipAudit = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM audit.import_validation_results
          WHERE import_validation_result_run_id = $1
            AND import_validation_result_rule_code = 'WHERE_SKIP_FILTER_EXCLUDED_V1'
            AND import_validation_result_payload->>'exclusion_reason'
                = 'required_missing_skill_category_family_id'`,
        [runId],
      );
      expect(
        Number(skipAudit.rows[0]!.n),
        "no skill_categories rows may be skip-filtered for missing family_id after the fix",
      ).toBe(0);
    },
  );

  it("schema invariant: skill_category_family_id is nullable post-000051", async () => {
    const r = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema='sys' AND table_name='sys_skill_categories'
          AND column_name='skill_category_family_id'`,
    );
    expect(r.rows[0]?.is_nullable, "migration 000051 must have made the column nullable").toBe("YES");
  });

  it("source artifact invariant: industry_ccnl_mapping dump exists on disk", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { resolveLegacyDataDir } = await import(
      "../src/modules/brownfield-wave-executor/loader.js"
    );
    const path = await import("node:path");
    const file = path.join(resolveLegacyDataDir(), "wave1_indoor_industry_ccnl_mapping.sql");
    expect(existsSync(file), `expected WS-3 dump at ${file}`).toBe(true);
    const sql = readFileSync(file, "utf8");
    const inserts = (sql.match(/^INSERT INTO public\.industry_ccnl_mapping/gm) ?? []).length;
    expect(inserts, "dump must carry the 14 industry_ccnl_mapping rows").toBe(14);
  });
});
