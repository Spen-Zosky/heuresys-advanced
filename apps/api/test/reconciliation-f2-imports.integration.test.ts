import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F2 of the reconciliation-closure cycle: bucket-A imports. One block per imported table.
// Hits the live DB (no mocks). Verifies the imported state, not the seed mechanics
// (seeds load from staging under a supervised run — see db/seeds/reconciliation/0N_*.sql headers).
// gap_analysis_results (#4) is intentionally deferred: it needs a semantic decision (kind + payload).

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation F2 imports', () => {
  describe('career_paths (#1)', () => {
    it('imported 28 RTL rows with deterministic legacy code, valid kind, single tenant', async () => {
      const { rows } = await pool.query<{ n: number; bad_code: number; bad_kind: number; tenants: number }>(
        `SELECT count(*)::int AS n,
                count(*) FILTER (WHERE career_path_code NOT LIKE 'LEGACY_CP::%')::int AS bad_code,
                count(*) FILTER (WHERE career_path_kind NOT IN
                  ('VERTICAL','LATERAL','SPECIALIST','MANAGERIAL','CROSS_FUNCTIONAL'))::int AS bad_kind,
                count(DISTINCT career_path_tenant_id)::int AS tenants
           FROM sys.sys_career_paths`,
      );
      expect(rows[0]?.n).toBe(28);
      expect(rows[0]?.bad_code).toBe(0);
      expect(rows[0]?.bad_kind).toBe(0);
      expect(rows[0]?.tenants).toBe(1);
    });
    it('shows POPULATED in the reconciliation view', async () => {
      const { rows } = await pool.query<{ s: string }>(
        `SELECT resolved_status AS s FROM sys.v_reconciliation_status WHERE table_name = 'sys_career_paths'`,
      );
      expect(rows[0]?.s).toBe('POPULATED');
    });
  });

  describe('user_career_plans (#2) — employee-centric', () => {
    it('imported 113 rows, all linked to a career_path, valid status, tenant-coherent', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_user_career_plans`)).toBe(113);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_career_plans WHERE user_career_plan_path_id IS NULL`,
      )).toBe(0);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_career_plans
          WHERE user_career_plan_status NOT IN ('ACTIVE','COMPLETED','PAUSED','CANCELLED')`,
      )).toBe(0);
      // tenant of the plan must equal the tenant of its user (I5)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_career_plans p
           JOIN sys.sys_users u ON u.user_id = p.user_career_plan_user_id
          WHERE p.user_career_plan_tenant_id <> u.user_tenant_id`,
      )).toBe(0);
    });
  });

  describe('user_documents (#3) — employee-centric', () => {
    it('imported 657 rows with valid kind and a uri', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_user_documents`)).toBe(657);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_documents WHERE user_document_kind NOT IN
          ('CV','CERTIFICATE','CONTRACT_REFERENCE','TRAINING_RECORD','EVIDENCE_PROOF','OTHER')`,
      )).toBe(0);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_documents WHERE user_document_uri = '' OR user_document_uri IS NULL`,
      )).toBe(0);
    });
  });

  describe('bonus_pools (#5) — RTL subset', () => {
    it('imported 6 RTL rows, scope TENANT, period bounds set', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_bonus_pools`)).toBe(6);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_bonus_pools WHERE bonus_pool_scope <> 'TENANT'`,
      )).toBe(0);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_bonus_pools
          WHERE bonus_pool_period_start IS NULL OR bonus_pool_period_end IS NULL`,
      )).toBe(0);
    });
  });

  describe('gap_analysis_results (#4) — semantic import', () => {
    it('imported 270 rows, kind=SKILL, all scored, payload carries the gap composition', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_gap_analysis_results`)).toBe(270);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_gap_analysis_results WHERE gap_analysis_result_kind <> 'SKILL'`,
      )).toBe(0);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_gap_analysis_results
          WHERE NOT (gap_analysis_result_payload ? 'skill_gaps') OR gap_analysis_result_overall_score IS NULL`,
      )).toBe(0);
    });
  });

  it('all 5 imported bucket-A tables now read POPULATED in the view', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name IN ('sys_career_paths','sys_user_career_plans','sys_user_documents','sys_bonus_pools','sys_gap_analysis_results')
          AND resolved_status = 'POPULATED'`,
    );
    expect(rows[0]?.n).toBe(5);
  });
});
