# Wave 4 Execution Runbook

## Advanced Intelligence + Cross-Tenant Aggregation + Governance

> **Status**: DRAFT (planning deliverable per RD-22, forensic DOC-7 2026-05-26). Awaiting Wave 3 closure + cross-tenant ADR + Enzo sign-off.
> **Owner**: Enzo Spenuso (single decider, single executor + PI for human approval — RD-30 default).
> **Predecessor**: `wave_3_runner.md` (sensitive tenant data — must be COMPLETE before Wave 4).
> **Successor**: nessuno (Wave 4 è final wave del brownfield import strategy).
> **Parent plan**: `BROWNFIELD_IMPORT_PLAN.md` §6 (Wave 4 specification).
> **Roadmap context**: `MVP_4_ROADMAP.md` stream 2.3.

---

## §0 Scope

**Goal**: importare advanced intelligence layer — career paths, succession pools, talent scores, compensation band assignments, engagement evidence, AI config — per i 4 tenant legacy + cross-tenant aggregation views. Pattern: human gate mandatory (sensitivity policy, non privacy).

**Source**: ~55 source tables (TRANSFORM class) del legacy `heuresys_platform.public` per i domain `TALPIPE` (27 tables career/succession), `PULSAR` (29 tables engagement/wellbeing), `SMERTO` (1 table salary band assignment), `EPRA` (1 table AI tenant config subset). Riferimento `BROWNFIELD_IMPORT_PLAN.md` §6.1.

**Target**: ~20 `sys.*` canonical tables:
- `sys.sys_career_paths` (template paths)
- `sys.sys_career_path_steps` (path nodes)
- `sys.sys_user_career_plans` (user × target path)
- `sys.sys_talent_scores` (normalized [0..1])
- `sys.sys_succession_pools` (critical position pools)
- `sys.sys_successor_candidates` (pool members)
- `sys.sys_successor_readiness` (readiness assessment)
- `sys.sys_user_assessment_evidence` (engagement subset)
- `sys.sys_gap_closure_plans` (engagement-driven plans)
- `sys.sys_position_compensation_profiles` (band assignment only, no amounts)
- `sys.sys_tenancies.tenant_metadata.ai_config` (JSONB extension)

**Plus cross-tenant aggregation views**:
- `sys.v_cross_tenant_engagement_summary` (read-only, API-filtered per role)
- `sys.v_cross_tenant_talent_pool_summary` (read-only, PLATFORM_ADMIN scope only)

**Approval**: **human gate mandatory** (PI sign-off — default approver `PLATFORM_ADMIN` = Enzo per RD-30). No auto-approval indipendentemente da confidence.

**Threshold**: ≥ 80% target tables completion (più basso di Wave 2/3 perché data quality TALPIPE/PULSAR ha più gaps).

---

## §1 Pre-flight

### §1.1 Infrastructure required

Identici a Wave 3 (§1.1 di `wave_3_runner.md`) + WAL space ≥ 5 GB (engagement evidence volumes).

### §1.2 Wave 3 closure verification

**Mandatory**: Wave 3 deve essere COMPLETE prima di Wave 4. Verifica:

```sql
-- Wave 3 completion check
SELECT COUNT(DISTINCT tm.table_mapping_target_table) AS w3_completed,
       (SELECT COUNT(DISTINCT table_mapping_target_table)
          FROM brownfield.table_mappings
         WHERE table_mapping_wave = 3 AND table_mapping_approval_status = 'APPROVED') AS w3_approved
  FROM brownfield.table_mappings tm
  JOIN brownfield.import_runs ir
    ON ir.import_run_wave = 3
   AND ir.import_run_state = 'COMPLETE'
   AND ir.import_run_source_table_id = tm.table_mapping_source_table_id
 WHERE tm.table_mapping_wave = 3;
-- Expected: w3_completed / w3_approved ≥ 0.95 (Wave 3 acceptance threshold)
```

Plus check:
- `sys.sys_users` (synthetic) populato per 4 tenant (~270 rows minimo).
- `sys.sys_user_position_assignments` populato (career paths Wave 4 referenzia positions tramite users).
- `sys.sys_compensation_bands` Wave 1 populato (compensation profile Wave 4 FK).
- `sys.sys_position_succession_relevance.is_critical` flag exists per filter succession pools.

### §1.3 Backup pre-Wave-4

Analogo Wave 3 §1.3, snapshot in `qa_artifacts/db_snapshots/heuresys_pre_wave4_<timestamp>.*.sql.gz`.

### §1.4 Pre-flight script

Deliverable: `db/scripts/brownfield-wave-4-preflight.{sh,ps1}` con check:

| # | Check | Expected |
|---|---|---|
| 1 | DB reachable | OK |
| 2 | Wave 3 completion ratio ≥ 0.95 | OK |
| 3 | `brownfield.table_mappings WHERE wave = 4 AND status = APPROVED` count | ≥ 50 (target ~55) |
| 4 | All ~20 canonical Wave 4 target tables exist | OK |
| 5 | `sys.sys_compensation_bands` populated | ≥ 75 rows (Wave 1 baseline) |
| 6 | `sys.sys_position_succession_relevance` view exists | OK |
| 7 | Cross-tenant view migrations applied | OK |
| 8 | Human approval workflow UI live (post Wave 3) | OK |
| 9 | (Informational) source TALPIPE/PULSAR/SMERTO row counts | INFO |

### §1.5 Cross-tenant ADR pre-requisite

**Mandatory**: ADR-0024 (proposed) — Cross-tenant aggregation strategy — deve essere ACCEPTED prima di Wave 4. Vedi §9.

---

## §2 Registry preparation

### §2.1 `brownfield.table_mappings` Wave 4 population

Pattern analogo Wave 3 §2.1. Source tables Wave 4 dai domain:

| Domain | Source tables count | Target sys.* |
|---|---:|---|
| TALPIPE | 27 (career_paths, career_path_levels, career_goals, ninebox_*, succession_pools, successor_*, promotion_*, mobility_*) | ~10 (career/succession tables) |
| PULSAR | 29 (pulse_*, engagement_*, burnout_assessments, club_*, retention_*) | ~5 (assessment_evidence, gap_closure_plans, talent_scores) |
| SMERTO | 1 (salary_band_assignments) | 1 (position_compensation_profiles) |
| EPRA | 1 subset (ai_tenant_config) | inline JSONB extension on sys_tenancies.tenant_metadata.ai_config |
| **TOTAL** | **~58 → 55 mapped** | **~20** |

Script: `db/scripts/brownfield-wave-4-register.{ts,sh}` (deliverable).

### §2.2 Column mappings Wave 4

Estensione `brownfield.column_mappings`: +500-1000 nuovi mappings (TALPIPE/PULSAR hanno schemas complessi).

**Critical mapping rules** (Wave 4-specific):
- `salary_band_assignments.amount_min, amount_max` → **NOT mapped** (only band_id reference, amounts in catalog).
- `compensation_*_amount_*` → **NOT mapped** indipendentemente da contesto.
- `talent_scores.raw_score` → mapped a `sys.sys_talent_scores.talent_score_value` con normalization [0..1] via transform.
- `engagement_responses.free_text` → NOT mapped (PII risk anche se demo, defensive pattern continued).
- `succession_pools.is_active` → mapped + filter `is_active = true` only.

### §2.3 Expected row counts

| Target table | Expected rows | Notes |
|---|---:|---|
| `sys_career_paths` | ~50-100 | template paths cross-tenant |
| `sys_career_path_steps` | ~300-600 | media 5-10 steps per path |
| `sys_user_career_plans` | ~100-200 | subset of users con target path |
| `sys_talent_scores` | ~270-500 | media ~1-2 score per user |
| `sys_succession_pools` | ~20-50 | per critical positions |
| `sys_successor_candidates` | ~100-300 | 3-5 candidates per pool |
| `sys_successor_readiness` | ~100-300 | 1 per candidate |
| `sys_user_assessment_evidence` (engagement subset) | ~500-1000 | pulse surveys |
| `sys_gap_closure_plans` | ~50-150 | targeted closures |
| `sys_position_compensation_profiles` | ~55-100 | one per position |

---

## §3 Staging migration

### §3.1 Staging tables Wave 4

Migrations attese in range **000060+** (post Wave 3 range 000051-000059):

| Migration suggerita | Content |
|---|---|
| `000060_staging_wave4_career.sql` | `staging.wave4_career_paths`, `staging.wave4_career_path_steps`, `staging.wave4_user_career_plans` (TALPIPE career subset) |
| `000061_staging_wave4_succession.sql` | `staging.wave4_succession_pools`, `staging.wave4_successor_candidates`, `staging.wave4_successor_readiness` (TALPIPE succession subset) |
| `000062_staging_wave4_talent.sql` | `staging.wave4_talent_scores`, `staging.wave4_ninebox_assessments` |
| `000063_staging_wave4_engagement.sql` | `staging.wave4_pulse_surveys`, `staging.wave4_engagement_responses`, `staging.wave4_burnout_assessments` (PULSAR) |
| `000064_staging_wave4_compensation.sql` | `staging.wave4_salary_band_assignments` (SMERTO) |
| `000065_staging_wave4_ai_config.sql` | `staging.wave4_ai_tenant_config` (EPRA) |
| `000066_brownfield_table_mappings_wave_4_backfill.sql` | idempotent UPDATE backfill |
| `000067_sys_cross_tenant_views.sql` | `sys.v_cross_tenant_engagement_summary`, `sys.v_cross_tenant_talent_pool_summary` (read-only views) |

### §3.2 Idempotency

Stesso pattern Wave 3 §3.2.

---

## §4 Execution steps

### §4.1 Trigger (analogo Wave 3 §4.1, wave=4)

```bash
curl -X POST http://localhost:3001/v1/brownfield/import-runs \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b cookies.txt \
  -d '{"wave": 4, "mode": "EXECUTE"}'
```

### §4.2 State machine

Stessi 8 states Wave 2/3. **Differenza Wave 4**: state `APPROVED` richiede **sempre human gate** (no auto-approval, indipendentemente da confidence). Executor pausa run in stato `VALIDATING → PENDING_APPROVAL` (sub-stato) finché human decision non arriva.

### §4.3 Audit watch live + decisions backlog

Stesso Wave 3 §4.3 + dashboard view per pending Wave 4 decisions:

```sql
-- Wave 4 pending decisions count + age
SELECT iad.import_approval_decision_id,
       AGE(now(), iad.import_approval_decision_created_at) AS pending_age,
       ir.import_run_started_at,
       iad.import_approval_decision_status
  FROM audit.import_approval_decisions iad
  JOIN brownfield.import_runs ir ON ir.import_run_id = iad.import_approval_decision_run_id
 WHERE ir.import_run_wave = 4
   AND iad.import_approval_decision_status IN ('PENDING', 'NEEDS_REVIEW')
 ORDER BY iad.import_approval_decision_created_at ASC;
```

### §4.4 Post-run validation

Stesso Wave 3 §4.4 + check normalization:

```sql
-- Talent scores normalized [0..1]
SELECT COUNT(*) FROM sys.sys_talent_scores ts
 WHERE ts.talent_score_value < 0 OR ts.talent_score_value > 1;
-- Expected: 0

-- Compensation profiles never store amounts
SELECT COUNT(*) FROM sys.sys_position_compensation_profiles
 WHERE compensation_amount_min IS NOT NULL OR compensation_amount_max IS NOT NULL;
-- Expected: 0
```

---

## §5 Acceptance criteria

### §5.1 Quantitative

```sql
-- AC-W4-01: ≥ 80% target tables Wave 4 COMPLETE
SELECT COUNT(DISTINCT tm.table_mapping_target_table) FILTER (WHERE ir.import_run_state = 'COMPLETE') * 1.0 /
       NULLIF(COUNT(DISTINCT tm.table_mapping_target_table), 0) AS completion_ratio
  FROM brownfield.table_mappings tm
  LEFT JOIN brownfield.import_runs ir
    ON ir.import_run_wave = 4
   AND ir.import_run_source_table_id = tm.table_mapping_source_table_id
 WHERE tm.table_mapping_wave = 4
   AND tm.table_mapping_approval_status = 'APPROVED';
-- Expected: completion_ratio ≥ 0.80
```

```sql
-- AC-W4-02: every imported career path has at least one step (no orphan)
SELECT COUNT(*) FROM sys.sys_career_paths cp
 WHERE cp.career_path_id IN (
   SELECT source_lineage_target_record_id FROM sys.sys_source_lineage_records
    WHERE source_lineage_target_table_name = 'sys_career_paths'
      AND source_lineage_import_run_id IN (
        SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 4
      )
 )
 AND NOT EXISTS (
   SELECT 1 FROM sys.sys_career_path_steps WHERE career_path_id = cp.career_path_id
 );
-- Expected: 0
```

```sql
-- AC-W4-03: talent scores normalized [0..1]
SELECT COUNT(*) FROM sys.sys_talent_scores
 WHERE talent_score_value < 0 OR talent_score_value > 1;
-- Expected: 0
```

```sql
-- AC-W4-04: compensation profiles never store amounts
SELECT COUNT(*) FROM sys.sys_position_compensation_profiles
 WHERE compensation_amount_min IS NOT NULL OR compensation_amount_max IS NOT NULL;
-- Expected: 0
```

```sql
-- AC-W4-05: cross-tenant view governance — TENANT_ADMIN cannot read other tenant
-- (test via API impersonation, not SQL — vedi AC-W4-08 E2E)
```

```sql
-- AC-W4-06: every decision Wave 4 has human approver (no AUTO)
SELECT COUNT(*) FROM audit.import_approval_decisions
 WHERE import_approval_decision_run_id IN (
   SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 4
 )
 AND import_approval_decision_approver = 'AUTO';
-- Expected: 0
```

### §5.2 Qualitative

- **AC-W4-07**: Twice-run idempotency Wave 4 verde.
- **AC-W4-08**: Playwright E2E `cross-tenant-view-isolation.spec.ts` verde — TENANT_ADMIN A login + GET cross-tenant view → vede solo own tenant data; PLATFORM_ADMIN → vede aggregato.
- **AC-W4-09**: ADR-0024 (cross-tenant) ACCEPTED + sign-off Enzo.
- **AC-W4-10**: Human approval audit log linked + decisions count documentato.

---

## §6 Rollback procedure

### §6.1 Light rollback (wave-scoped corrective)

Stesso pattern Wave 3 §6.1, scope Wave 4 lineage.

**Cascade order** (FK dependency):
1. `sys.sys_successor_readiness` (depends on candidates)
2. `sys.sys_successor_candidates` (depends on pools)
3. `sys.sys_succession_pools` (depends on positions)
4. `sys.sys_user_career_plans` (depends on paths + users)
5. `sys.sys_career_path_steps` (depends on paths)
6. `sys.sys_career_paths`
7. `sys.sys_talent_scores`
8. `sys.sys_user_assessment_evidence` (Wave 4 subset only — preserve Wave 3 assessment_results)
9. `sys.sys_gap_closure_plans`
10. `sys.sys_position_compensation_profiles`
11. JSONB extension `sys.sys_tenancies.tenant_metadata.ai_config` → UNSET

Pre lineage scope filter via `source_lineage_import_run_id IN (Wave 4 runs)`.

### §6.2 Cross-tenant view DROP

```sql
-- Wave 4 introduces 2 cross-tenant views; rollback should DROP if compromised
DROP VIEW IF EXISTS sys.v_cross_tenant_engagement_summary;
DROP VIEW IF EXISTS sys.v_cross_tenant_talent_pool_summary;
-- (next re-run recreates via migration 000067)
```

### §6.3 Heavy rollback

Stesso Wave 3 §6.2 con scope Wave 4. **Più rischioso** se talent scores + succession pools sono già stati consumati da feature downstream (è MVP-4 stream, quindi presumibilmente nessuna prod feature dipende ancora, riducendo rischio).

---

## §7 Known risks

### §7.1 Cascade chain Wave 3 → Wave 4

Wave 4 dipende da Wave 3 (users, assignments). Pre-flight check §1.4 enforces.

### §7.2 Cross-tenant boundary leak (I5)

**Critical risk**. Cross-tenant aggregation views devono enforce API-level filter (NO RLS per I5 invariant). Se API middleware ha bug, TENANT_ADMIN può vedere data di altri tenant. Mitigation:
- View itself returns all tenants (no SQL filter — that's RLS, forbidden).
- API repository wraps view with `WHERE tenant_id IN (req.user.allowed_tenants)` filter.
- Decorator `requirePlatformScope()` su endpoint cross-tenant (solo PLATFORM_ADMIN).
- E2E Playwright AC-W4-08 verifica.

### §7.3 Talent score normalization edge cases

Source `talent_scores.raw_score` può essere su scala diversa per tenant (0-5, 0-10, 0-100). Transform deve detect scale + normalize a [0..1]. Mitigation: per-tenant scale detection + ADR-0025 (proposed) per normalization rule.

### §7.4 Engagement evidence PII risk

PULSAR pulse surveys hanno free-text responses potentially PII. Mitigation: free-text NOT mapped (vedi §2.2 critical mapping rules) — only structured scores + categorical responses imported.

### §7.5 Compensation amount leak (I8 + ADR pattern)

`salary_band_assignments.amount_*` NOT mapped. Verificare column_mappings Wave 4 NON dichiarano transform per amount fields. Mitigation: AC-W4-04 enforces zero amount in target.

### §7.6 Materialized view performance

Cross-tenant views su engagement data possono essere lente (full table scan per aggregation). Decision: VIEW vs MATERIALIZED VIEW.
- VIEW: real-time, slower (~secondi su 10k+ rows).
- MV: faster, requires refresh policy.

Default RD-15 baseline: VIEW per MVP-4 ship, MV fallback documentato per future tuning. Mitigation: indici su engagement tables + EXPLAIN ANALYZE pre-ship.

### §7.7 AI config import (EPRA)

`ai_tenant_config` source può contenere reference a old AI services discontinued. Mitigation: filter only fields with current platform meaning (es. `ai_skill_recommendation_enabled`, `ai_career_path_suggestion_enabled`), skip legacy.

---

## §8 Authorship + sign-off

### §8.1 Pre-execution checklist Wave 4-specific

- [ ] Runner doc reviewed Enzo + sign-off.
- [ ] Wave 3 completion ratio ≥ 0.95 verified.
- [ ] ADR-0024 (cross-tenant) + ADR-0025 (talent normalization) ACCEPTED.
- [ ] Cross-tenant views migration 000067 applied.
- [ ] API endpoints cross-tenant view registrati con `requirePlatformScope`.
- [ ] E2E Playwright cross-tenant isolation test verde.
- [ ] Pre-flight script wave-4-preflight deliverato + tested.
- [ ] Wave 4 staging migrations (000060+) applied idempotently.
- [ ] `brownfield.table_mappings` Wave 4 populated + column_mappings curated.
- [ ] Backup pre-Wave-4 effettuato.
- [ ] Compensation amount filter validation rule attivo + tested.

---

## §9 Cross-tenant boundary considerations

### §9.1 Invariant I5 (no RLS)

PostgreSQL RLS è prohibited (I5 invariant). Cross-tenant aggregation deve essere fatta a livello API middleware.

### §9.2 Aggregation pattern

Pattern proposto in ADR-0024:

```sql
-- View aggregata cross-tenant (read-only)
CREATE OR REPLACE VIEW sys.v_cross_tenant_engagement_summary AS
SELECT t.tenant_id,
       t.tenant_code,
       t.tenant_name,
       COUNT(DISTINCT u.user_id) AS active_users,
       AVG(uae.assessment_score) AS avg_engagement_score,
       COUNT(DISTINCT uae.user_id) FILTER (WHERE uae.assessment_score < 0.5) AS low_engagement_count
  FROM sys.sys_tenancies t
  LEFT JOIN sys.sys_users u ON u.user_tenant_id = t.tenant_id AND u.user_status = 'ACTIVE'
  LEFT JOIN sys.sys_user_assessment_evidence uae
    ON uae.user_id = u.user_id
   AND uae.assessment_kind = 'ENGAGEMENT_PULSE'
   AND uae.assessment_period_end > now() - interval '90 days'
 GROUP BY t.tenant_id, t.tenant_code, t.tenant_name;
```

API endpoint pattern:

```typescript
// PSEUDO-CODE — NOT SHIPPED YET
app.get('/v1/governance/cross-tenant/engagement', {
  preHandler: [app.verifyAuth, requirePlatformScope()]
}, async (req, reply) => {
  const result = await pool.query(`
    SELECT * FROM sys.v_cross_tenant_engagement_summary
    -- No WHERE tenant_id filter for PLATFORM_ADMIN (full access)
  `);
  return result.rows;
});

// TENANT_ADMIN access: same view, scoped to own tenant only
app.get('/v1/governance/own-tenant/engagement', {
  preHandler: [app.verifyAuth, requirePermission('governance:read')]
}, async (req, reply) => {
  const result = await pool.query(`
    SELECT * FROM sys.v_cross_tenant_engagement_summary
    WHERE tenant_id = $1
  `, [req.user.tenantId]);
  return result.rows;
});
```

### §9.3 Invariant compliance

- **I5 (no RLS)**: ✓ — view returns all tenants, filter is API-level.
- **I6 (tenant FK)**: ✓ — view uses tenant_id FK joins.
- **I8 (out of scope)**: ✓ — view excludes payroll/T&A/benefits aggregation.
- **I12 (brownfield enrichment)**: ✓ — views consume canonical post-import data, not raw legacy.

---

## §10 Aggregation strategy

### §10.1 View vs Materialized View decision

Default RD-15: VIEW (real-time, no refresh overhead). MV fallback if perf degraded.

| Aspect | VIEW | MATERIALIZED VIEW |
|---|---|---|
| Latency | High (full aggregation per query) | Low (pre-aggregated) |
| Freshness | Real-time | Refresh interval-dependent |
| Storage | Zero | High (duplicate aggregated data) |
| Refresh complexity | None | Periodic job + ADR for policy |

Per Wave 4 MVP: VIEW. Post-MVP-4 perf review può promuovere a MV se P99 > 600ms baseline (RD-15).

### §10.2 Application-side rollup alternative

Alternative pattern: aggregation in JavaScript/TypeScript service layer (in-memory). Pro: caching layer flexibility. Con: more memory pressure + non-SQL queryability.

Decision: SQL view (default) + application caching tier (TanStack Query frontend + Fastify response caching middleware via `@fastify/caching` se necessario).

### §10.3 Refresh policy (se MV in future)

Se Wave 4 perf review post-MVP-4 dimostra necessità MV:
- Trigger refresh: post Wave 3/4 run COMPLETE → `REFRESH MATERIALIZED VIEW CONCURRENTLY sys.mv_cross_tenant_engagement_summary;`
- Daily cron refresh: 02:00 UTC.
- Manual refresh API endpoint: `POST /v1/admin/refresh-cross-tenant-views` (PLATFORM_ADMIN only).

---

## §11 Governance (chi accede, audit, retention)

### §11.1 Access control

| Role | Cross-tenant engagement view | Cross-tenant talent pool | Own-tenant engagement |
|---|---|---|---|
| PLATFORM_ADMIN | Read | Read | Read |
| TENANT_ADMIN | None | None | Read (own tenant) |
| BLUEPRINT_MANAGER | None | None | Read (own tenant) |
| HRMS_MANAGER | None | None | Read (own tenant, aggregated only) |
| PROCESS_OWNER | None | None | None |
| MANAGER | None | None | None |
| USER | None | None | None |
| READ_ONLY | None | None | Read (own tenant, aggregated only) |

Permissions seeded in migration extension: `governance:read:cross_tenant` (PLATFORM_ADMIN), `governance:read:own_tenant` (TENANT_ADMIN+).

### §11.2 Audit trail

Ogni access a cross-tenant view → audit row in `audit.cross_tenant_view_access` (nuovo, deliverable):
- `access_id` (UUID)
- `access_user_id` (FK)
- `access_user_role` (RoleCode)
- `access_view_name` (es. `sys.v_cross_tenant_engagement_summary`)
- `access_query_filter` (JSON sintesi WHERE clause applied)
- `access_row_count_returned` (numeric)
- `access_at` (timestamptz)

Migration `000068_audit_cross_tenant_view_access.sql` per shipping audit table.

### §11.3 Retention

Cross-tenant access audit rows: retention 7 anni (compliance default per audit data). No PII in audit rows → no GDPR concern.

Brownfield Wave 4 import audit (existing `audit.import_*`): retention indefinite (audit immutabile per integrity invariant).

---

## §12 References

| Path | Use |
|---|---|
| `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` §6 | Wave 4 specification source |
| `docs/brownfield/wave_runners/wave_3_runner.md` | predecessor + human approval pattern reference |
| `docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md` | mapping spec |
| `docs/architecture/adr/0008_position_intelligence_profile_as_view.md` | view-vs-MV pattern reference (PIP precedent) |
| `docs/architecture/adr/0009_visualization_node_layouts_separate_table.md` | invariant I10 reference |
| `docs/MVP_4_ROADMAP.md` §2.3 | stream context |
| `apps/api/src/middleware/rbac.ts` | `requirePermission` + future `requirePlatformScope` |
| `apps/api/src/modules/brownfield-import-runs/` | extension target |
| ADR-0024 (proposed) | Cross-tenant aggregation strategy (to author pre-Wave-4) |
| ADR-0025 (proposed) | Talent score normalization rule (to author pre-Wave-4) |

---

**Fine wave_4_runner.md** — operational runbook, awaiting Wave 3 closure + ADR-0024/0025 ACCEPTED + cross-tenant view migration + E2E isolation test + sign-off.
