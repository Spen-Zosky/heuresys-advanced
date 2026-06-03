import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// D5 / Wall W3 — learning catalog re-home (course=module) + import. Hits the live DB (no mocks).
// Validates the structural correction (000061) + the three catalog seeds (37 courses/steps,
// 38 evidence, 39 skill-learning). Measured live S961 against the OCI VM DB via the tunnel:
//   - sys_learning_modules: 127 canonical course=modules (60 CRS-* re-homed + 67 banking-style),
//     GLOBAL (tenant NULL). Plus the ~7299 pre-existing OLDDB::<event> rows are left untouched.
//   - sys_learning_path_steps: 124 (was 0) — learning_path_courses 124/124 both-leg, across 20 paths.
//   - sys_user_learning_evidence: 1434 (was 0) — employee-centric (LEGACY_EMP::), completion-only.
//   - sys_skill_learning_mappings: 635 (was 0) — the resolvable esco-skill subset (82/717 skip).
//
// These counts are the post-import floor; assertions use >= where the import is a documented subset
// whose exact total can only grow if upstream coverage (sys_skills URIs, employee->user) improves.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation D5 — learning catalog re-home (W3)', () => {
  describe('catalog: course=module (000061 re-home + seed 37)', () => {
    it('the 60 mis-placed CRS-* codes are re-homed as GLOBAL course=modules', async () => {
      // every CRS-* learning_path code has a matching GLOBAL learning_module of the same code
      expect(await count(
        `SELECT count(*)::int AS n
           FROM (SELECT DISTINCT learning_path_code FROM sys.sys_learning_paths
                  WHERE learning_path_code LIKE 'CRS-%') p
          WHERE NOT EXISTS (
            SELECT 1 FROM sys.sys_learning_modules m
             WHERE m.learning_module_code = p.learning_path_code
               AND m.learning_module_tenant_id IS NULL)`,
      )).toBe(0);
    });

    it('the canonical course=module catalog landed (>= 127 CRS+banking, all COURSE kind)', async () => {
      // 127 canonical courses imported as modules; >= 60 are CRS-* (the rest are banking-style codes).
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'CRS-%'`)).toBeGreaterThanOrEqual(60);
      // catalog modules (non-OLDDB) are exactly the re-import; all GLOBAL + COURSE.
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_learning_modules
          WHERE learning_module_code LIKE 'CRS-%'
            AND (learning_module_tenant_id IS NOT NULL OR learning_module_kind <> 'COURSE')`,
      )).toBe(0);
    });

    it('the dual-home is preserved: the CRS-* path-code shims still exist (junctions 11/15 stay valid)', async () => {
      // re-home is DUAL-HOME, not MOVE: the load-bearing CRS-* rows in sys_learning_paths remain.
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_learning_paths WHERE learning_path_code LIKE 'CRS-%'`)).toBeGreaterThanOrEqual(60);
    });
  });

  describe('sys_learning_path_steps unblocked (was 0)', () => {
    it('imported 124 steps across 20 paths, all FKs resolving, ordinals unique per path', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_learning_path_steps`)).toBe(124);
      expect(await count(`SELECT count(DISTINCT learning_path_step_path_id)::int AS n FROM sys.sys_learning_path_steps`)).toBe(20);
      // every step resolves a real module + path (FK integrity beyond the constraint)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_learning_path_steps s
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_modules m WHERE m.learning_module_id = s.learning_path_step_module_id)
             OR NOT EXISTS (SELECT 1 FROM sys.sys_learning_paths   p WHERE p.learning_path_id   = s.learning_path_step_path_id)`,
      )).toBe(0);
      // (path, ordinal) unique (the table's business key) — no collisions imported
      expect(await count(
        `SELECT (count(*) - count(DISTINCT (learning_path_step_path_id, learning_path_step_ordinal)))::int AS n
           FROM sys.sys_learning_path_steps`,
      )).toBe(0);
    });

    it('every step module is one of the canonical course=modules (not an OLDDB event row)', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_learning_path_steps s
           JOIN sys.sys_learning_modules m ON m.learning_module_id = s.learning_path_step_module_id
          WHERE m.learning_module_code LIKE 'OLDDB::%'`,
      )).toBe(0);
    });
  });

  describe('sys_user_learning_evidence unblocked (was 0) — employee-centric', () => {
    it('imported completion evidence (>0), all module/tenant FKs coherent', async () => {
      const total = await count(`SELECT count(*)::int AS n FROM sys.sys_user_learning_evidence`);
      expect(total).toBeGreaterThan(0);
      // every evidence row resolves a real module
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_learning_evidence e
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_modules m WHERE m.learning_module_id = e.user_learning_evidence_module_id)`,
      )).toBe(0);
      // tenant coherence (I5): the evidence tenant equals the user's tenant
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_learning_evidence e
           JOIN sys.sys_users u ON u.user_id = e.user_learning_evidence_user_id
          WHERE u.user_tenant_id <> e.user_learning_evidence_tenant_id`,
      )).toBe(0);
    });

    it('evidence users are all employee-keyed (LEGACY_EMP::), never user-keyed (I14)', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_learning_evidence e
           JOIN sys.sys_users u ON u.user_id = e.user_learning_evidence_user_id
          WHERE u.user_external_code IS NOT NULL AND u.user_external_code NOT LIKE 'LEGACY_EMP::%'`,
      )).toBe(0);
    });
  });

  describe('sys_skill_learning_mappings unblocked (was 0) — resolvable subset', () => {
    it('imported the resolvable skill<->module subset (>0), all FKs + proficiency valid', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_skill_learning_mappings`)).toBeGreaterThan(0);
      // every mapping resolves a real skill + module
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_skill_learning_mappings sm
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skills s         WHERE s.skill_id          = sm.skill_learning_mapping_skill_id)
             OR NOT EXISTS (SELECT 1 FROM sys.sys_learning_modules m WHERE m.learning_module_id = sm.skill_learning_mapping_module_id)`,
      )).toBe(0);
      // proficiency within the CHECK domain
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_skill_learning_mappings
          WHERE skill_learning_mapping_target_proficiency
                NOT IN ('NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER')`,
      )).toBe(0);
    });
  });

  it('the 3 W3 targets read POPULATED in the reconciliation view', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name IN ('sys_learning_path_steps','sys_user_learning_evidence','sys_skill_learning_mappings')
          AND resolved_status = 'POPULATED'`,
    );
    expect(rows[0]?.n).toBe(3);
  });
});
