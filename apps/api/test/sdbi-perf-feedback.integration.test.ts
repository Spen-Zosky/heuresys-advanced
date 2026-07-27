import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// D6 — SDBI Option-B slice: PerformanceReviews + Feedback360 (4 sys.* base tables + 1 VIEW).
// Data-level validation (no API module is in scope for D6 — the slice is the data substrate).
// Asserts: RTL-resolvable counts, 0 NULL on NOT-NULL cols, all non-NULL employee FKs resolve,
// I5 tenant isolation = canonical RTL, nine_box VIEW = COMPLETED + both-boxes rows only,
// SDBI lineage + audit provenance, and 0 UNCLASSIFIED in the reconciliation registry.
//
// Measured-RTL expectations (docs/kb/D6_SDBI_OPTION_B_DESIGN.md §3, re-verified live S961):
//   PR=161 (subject 159, reviewer 157) · CRR=465 · F360=390 · CF=474 (to 474, from 473, goal 146)
//   nine_box VIEW = 159 (the 159 'completed' PR with both box coords)

const RTL_TENANT = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

const count = async (sql: string, params: unknown[] = []): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql, params);
  return rows[0]?.n ?? -1;
};

describe('SDBI Option-B — perf reviews + feedback360', () => {
  it('the 4 sys.* tables hold exactly the RTL-resolvable IMPORT counts', async () => {
    // Scoped to SDBI-import provenance: the storia36 backfill (natural keys
    // STORIA36::*) legitimately grows these tables — asserting bare totals
    // would re-introduce the banned photograph-count anti-pattern.
    // 159 (era 161): 2 review cross-tenant (subject HEURESYS in tenant RTL)
    // eliminate dal repair storia36 C2 del 2026-07-28 (violazione I5).
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_performance_reviews
      WHERE review_natural_key NOT LIKE 'STORIA36%'`)).toBe(159);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_performance_review_competency_ratings
      WHERE rating_natural_key NOT LIKE 'STORIA36%'`)).toBe(465);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_feedback_360_responses
      WHERE response_natural_key NOT LIKE 'STORIA36%'`)).toBe(390);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_continuous_feedback
      WHERE feedback_natural_key NOT LIKE 'STORIA36%'`)).toBe(474);
  });

  it('I5 — every row belongs to the single canonical RTL tenant (FK + middleware, never RLS)', async () => {
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_reviews WHERE review_tenant_id <> $1`, [RTL_TENANT])).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_review_competency_ratings WHERE rating_tenant_id <> $1`, [RTL_TENANT])).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_feedback_360_responses WHERE response_tenant_id <> $1`, [RTL_TENANT])).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_continuous_feedback WHERE feedback_tenant_id <> $1`, [RTL_TENANT])).toBe(0);
  });

  it('0 NULL on NOT-NULL columns', async () => {
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_reviews
        WHERE review_natural_key IS NULL OR review_tenant_id IS NULL
           OR review_period_start IS NULL OR review_period_end IS NULL
           OR review_type IS NULL OR review_status IS NULL OR review_self_assessment_status IS NULL`)).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_review_competency_ratings
        WHERE rating_natural_key IS NULL OR rating_tenant_id IS NULL
           OR rating_review_id IS NULL OR rating_competency_name IS NULL OR rating_weight IS NULL`)).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_feedback_360_responses
        WHERE response_natural_key IS NULL OR response_tenant_id IS NULL
           OR response_is_anonymous IS NULL OR response_status IS NULL`)).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_continuous_feedback
        WHERE feedback_natural_key IS NULL OR feedback_tenant_id IS NULL
           OR feedback_message IS NULL OR feedback_type IS NULL OR feedback_visibility IS NULL`)).toBe(0);
  });

  it('I14 — every non-NULL employee FK resolves to a real sys_users row (no orphans)', async () => {
    // PR: subject / reviewer / calibrated_by / finalized_by
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_reviews p
        WHERE p.review_subject_user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = p.review_subject_user_id)`)).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_reviews p
        WHERE p.review_reviewer_user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = p.review_reviewer_user_id)`)).toBe(0);
    // CRR subject + parent review must resolve
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_review_competency_ratings r
        WHERE NOT EXISTS (SELECT 1 FROM sys.sys_performance_reviews pr WHERE pr.review_id = r.rating_review_id)`)).toBe(0);
    // F360 target + reviewer
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_feedback_360_responses f
        WHERE (f.response_target_user_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = f.response_target_user_id))
           OR (f.response_reviewer_user_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = f.response_reviewer_user_id))`)).toBe(0);
    // CF from + to + related_goal
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_continuous_feedback c
        WHERE (c.feedback_from_user_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = c.feedback_from_user_id))
           OR (c.feedback_to_user_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = c.feedback_to_user_id))
           OR (c.feedback_related_goal_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM sys.sys_goals g WHERE g.goal_id = c.feedback_related_goal_id))`)).toBe(0);
  });

  it('I14 — unresolved employee rows are kept (NULL FK + legacy id in metadata), never dropped', async () => {
    // 2 PR subjects + 1 cf author dropped in the S950 collapse: FK NULL, metadata carries the legacy id.
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_reviews WHERE review_subject_user_id IS NULL`)).toBe(2);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_reviews
        WHERE review_subject_user_id IS NULL AND review_metadata ? 'unresolved_employee'`)).toBe(2);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_continuous_feedback WHERE feedback_from_user_id IS NULL`)).toBe(1);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_continuous_feedback
        WHERE feedback_from_user_id IS NULL AND feedback_metadata ? 'unresolved_from'`)).toBe(1);
  });

  it('resolved FK counts match the measured RTL crosswalk (import rows)', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_performance_reviews
      WHERE review_natural_key NOT LIKE 'STORIA36%' AND review_subject_user_id IS NOT NULL`)).toBe(157);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_performance_reviews
      WHERE review_natural_key NOT LIKE 'STORIA36%' AND review_reviewer_user_id IS NOT NULL`)).toBe(157);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_continuous_feedback
      WHERE feedback_natural_key NOT LIKE 'STORIA36%' AND feedback_to_user_id IS NOT NULL`)).toBe(474);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_continuous_feedback
      WHERE feedback_natural_key NOT LIKE 'STORIA36%' AND feedback_from_user_id IS NOT NULL`)).toBe(473);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_continuous_feedback
      WHERE feedback_natural_key NOT LIKE 'STORIA36%' AND feedback_related_goal_id IS NOT NULL`)).toBe(146);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_feedback_360_responses
        WHERE response_natural_key NOT LIKE 'STORIA36%'
          AND response_target_user_id IS NOT NULL AND response_reviewer_user_id IS NOT NULL`)).toBe(390);
  });

  it('I9 — sys_nine_box_grid is a VIEW returning only COMPLETED reviews with both box coords', async () => {
    // it is a view, not a base table
    expect(await count(
      `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
        WHERE nsp.nspname='sys' AND c.relname='sys_nine_box_grid' AND c.relkind='v'`)).toBe(1);
    // the grid mirrors its source EXACTLY: expected derived live, never photographed
    const qualifying = await count(
      `SELECT count(*)::int AS n FROM sys.sys_performance_reviews
        WHERE review_status='COMPLETED'
          AND review_performance_box IS NOT NULL AND review_potential_box IS NOT NULL`);
    expect(qualifying).toBeGreaterThanOrEqual(159);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_nine_box_grid`)).toBe(qualifying);
    // every grid row's underlying PR is COMPLETED with both boxes set
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_nine_box_grid g
        WHERE NOT EXISTS (
          SELECT 1 FROM sys.sys_performance_reviews pr
          WHERE pr.review_tenant_id = g.tenant_id
            AND pr.review_status='COMPLETED'
            AND pr.review_performance_box IS NOT NULL AND pr.review_potential_box IS NOT NULL)`)).toBe(0);
    // category is always assigned (boxes are 1..3, never 'Not Rated' here)
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_nine_box_grid WHERE nine_box_category='Not Rated'`)).toBe(0);
  });

  it('SDBI provenance — lineage rows carry the first-class SDBI columns + audit markers', async () => {
    // one lineage row per imported sys.* row (161+465+390+474 = 1490)
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_source_lineage_records
        WHERE source_lineage_target_table_name IN
          ('sys_performance_reviews','sys_performance_review_competency_ratings',
           'sys_feedback_360_responses','sys_continuous_feedback')`)).toBe(1490);
    // every such lineage row populates the first-class SDBI columns (mig 000063), not just jsonb
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_source_lineage_records
        WHERE source_lineage_target_table_name IN
          ('sys_performance_reviews','sys_performance_review_competency_ratings',
           'sys_feedback_360_responses','sys_continuous_feedback')
          AND (source_lineage_sdbi_mapping_card_id IS NULL OR source_lineage_sdbi_confidence IS NULL
               OR source_lineage_sdbi_ai_model_id IS NULL)`)).toBe(0);
    // the SDBI consolidation-complete audit marker fired for all 4 targets
    expect(await count(
      `SELECT count(DISTINCT (import_validation_result_payload->>'target_table'))::int AS n
        FROM audit.import_validation_results
        WHERE import_validation_result_rule_code='SDBI_CONSOLIDATION_COMPLETE_V1'
          AND import_validation_result_payload->>'target_table' IN
            ('sys_performance_reviews','sys_performance_review_competency_ratings',
             'sys_feedback_360_responses','sys_continuous_feedback')`)).toBe(4);
  });

  it('registry — 4 new base tables registered, 0 UNCLASSIFIED, nine_box VIEW not registered', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED'`)).toBe(0);
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name IN ('sys_performance_reviews','sys_performance_review_competency_ratings',
                             'sys_feedback_360_responses','sys_continuous_feedback')
          AND resolved_status='POPULATED'`)).toBe(4);
    // the nine_box VIEW is a view: fn_reconciliation_status only enumerates relkind='r', so it is absent
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE table_name='sys_nine_box_grid'`)).toBe(0);
    // and it was NOT inserted into the registry table either
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_table_name='sys_nine_box_grid'`)).toBe(0);
  });
});
