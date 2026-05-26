# Wave 3 Execution Runbook

## Sensitive Tenant Data Import — Demo Person Data + Human Approval Gates

> **Status**: DRAFT (planning deliverable per RD-22, forensic DOC-7 2026-05-26). Awaiting Wave 2 closure + ADR pre-requisite list closure + Enzo sign-off.
> **Owner**: Enzo Spenuso (single decider, single executor + PI for human approval).
> **Predecessor**: `wave_2_runner.md` (tenant operating model — must be COMPLETE before Wave 3).
> **Successor**: `wave_4_runner.md` (cross-tenant aggregation + governance).
> **Parent plan**: `BROWNFIELD_IMPORT_PLAN.md` §5 (Wave 3 specification).
> **Roadmap context**: `MVP_4_ROADMAP.md` stream 2.2.

---

## §0 Scope

**Goal**: importare la person data dei 4 tenant legacy (RTL_BANK 158, SmartFood 82, EcoNova 26, Heuresys System 4 = **270 employees / 274 users**) come `user_is_synthetic = true` con `user_type = 'SYNTHETIC_REFERENCE'`. Include user_position_assignments, skill evidence, learning evidence, KPI evidence, performance review evidence, certifications metadata. **Demo data** (no real PII, RD-02 confirmed) ma il pattern human-approval workflow viene shipped come paradigma per future import con real data.

**Source**: ~31 source tables (TRANSFORM class) del legacy `heuresys_platform.public` per i domain `RBP·DGOV`, `H2R`, `SKILGRO`, `GOKMER` (person-data subset). Riferimento `BROWNFIELD_IMPORT_PLAN.md` §5.1.

**Target**: ~15 `sys.*` canonical tables:
- `sys.sys_users` (synthetic, ~270 rows)
- `sys.sys_user_position_assignments` (employee × position assignments)
- `sys.sys_user_certifications` (certifications metadata)
- `sys.sys_user_skill_evidence` (skill assessments + history)
- `sys.sys_user_kpi_evidence` (KPI achievements)
- `sys.sys_user_assessment_evidence` (performance review evidence)
- `sys.sys_user_documents` (metadata only, no binaries)
- `sys.sys_user_education_records` (education history)
- `sys.sys_user_career_plans` (career goal targets)
- `sys.sys_kpi_targets` (user-specific KPI targets, evidence subset)
- `sys.sys_assessment_results` (per-user assessment outcomes, evidence subset)
- `sys.sys_auth_credentials` (placeholder hash, `must_rotate = true`)
- `sys.sys_inbox_notifications` (eventuali notifiche storiche, optional)

**Approval**: **auto-approval if confidence ≥ 0.80 + PASSED + no PII-pattern hit**, **human gate mandatory altrimenti**. Pattern human approval shipped come deliverable cardine di Wave 3 (UI + audit trail + role-based authorization).

**Threshold**: ≥ 95% dei 270 users importati con synthetic flag corretto (margin 5% per edge-case orphan o platform users senza tenant resolution).

---

## §1 Pre-flight

### §1.1 Infrastructure required

Identici a Wave 2 (§1.1 di `wave_2_runner.md`):
1. SSH tunnel 5433 UP.
2. Baseline test suite green.
3. Twice-run idempotency proof verde.
4. WAL space ≥ 3-5 GB (Wave 3 ha volume person data + evidence rows più piccoli).

### §1.2 Wave 2 closure verification

**Mandatory**: Wave 2 deve essere COMPLETE prima di Wave 3. Verifica:

```sql
-- Wave 2 completion check
SELECT COUNT(DISTINCT tm.table_mapping_target_table) AS w2_completed,
       (SELECT COUNT(DISTINCT table_mapping_target_table)
          FROM brownfield.table_mappings
         WHERE table_mapping_wave = 2 AND table_mapping_approval_status = 'APPROVED') AS w2_approved
  FROM brownfield.table_mappings tm
  JOIN brownfield.import_runs ir
    ON ir.import_run_wave = 2
   AND ir.import_run_state = 'COMPLETE'
   AND ir.import_run_source_table_id = tm.table_mapping_source_table_id
 WHERE tm.table_mapping_wave = 2;
-- Expected: w2_completed / w2_approved ≥ 0.85 (Wave 2 acceptance threshold)
```

Plus check:
- `sys.sys_organization_units` populato per i 4 tenant (almeno 1 row per legacy tenant via `tenant_id_mappings`).
- `sys.sys_positions` populato (positions sono FK target per assignments Wave 3).
- `sys.sys_kpi_definitions` populato (KPI evidence Wave 3 FK).
- `sys.sys_skills` Wave 1 + `sys.sys_skill_proficiency_levels` populato (skill evidence Wave 3 FK).

### §1.3 Backup pre-Wave-3

Analogo Wave 2 §1.2, snapshot in `qa_artifacts/db_snapshots/heuresys_pre_wave3_<timestamp>.*.sql.gz`.

### §1.4 Pre-flight script

Deliverable: `db/scripts/brownfield-wave-3-preflight.{sh,ps1}` con check:

| # | Check | Expected |
|---|---|---|
| 1 | DB reachable | OK |
| 2 | Wave 2 completion ratio ≥ 0.85 | OK |
| 3 | `brownfield.table_mappings WHERE wave = 3 AND status = APPROVED` count | ≥ 25 (target ~31) |
| 4 | 4 legacy tenants resolved in `brownfield.tenant_id_mappings` | OK (RTL_BANK, SmartFood, EcoNova, Heuresys System) |
| 5 | All ~15 canonical Wave 3 target tables exist | OK |
| 6 | `sys.sys_positions` count per tenant > 0 (FK target) | OK |
| 7 | `audit.user_self_service_actions` table exists (ESS infra) | OK |
| 8 | `audit.import_approval_decisions` table exists + writable | OK |
| 9 | PII-pattern safety net check column list available | INFO |
| 10 | (Informational) source person-data row counts per tenant | INFO |

### §1.5 ADR pre-requisite list (mandatory before Wave 3 trigger)

Riferimento §11. Lista ADR che DEVONO essere ACCEPTED prima di Wave 3:

| ADR atteso | Topic | Status target |
|---|---|---|
| **ADR-0020** (proposed) | Wave 3 demo data import protocol formalization (no anonymization rationale) | ACCEPTED |
| **ADR-0021** (proposed) | Human approval workflow for brownfield imports (role-based authorization) | ACCEPTED |
| **ADR-0022** (proposed) | Password hash regeneration policy for imported synthetic users (`must_rotate = true`) | ACCEPTED |
| **ADR-0023** (proposed) | PII column safety net pattern (defensive for future real data) | ACCEPTED |

ADR numbering è suggested; numbering attuale post-MVP-3 è 0014..0018, next free è 0019+ → ADR-0019 sarà presumibilmente assegnato a stream 2.9 `@spen-zosky/ui` Path decision (MVP-4 roadmap §2.9). Wave 3 ADRs ipotesi range 0020..0023.

---

## §2 Registry preparation

### §2.1 `brownfield.table_mappings` Wave 3 population

Pattern analogo Wave 2 §2.1. Source tables Wave 3 dai domain:

| Domain | Source tables count | Target sys.* |
|---|---:|---|
| RBP·DGOV | 1 (`users`) | `sys_users` + `sys_auth_credentials` (placeholder) |
| H2R | ~18 (employee_*, assignments, certifications, kpi_targets, documents, contracts) | assignments, certifications, evidence, documents |
| SKILGRO | ~6 (employee_skill_*, certifications person) | skill evidence + certifications |
| GOKMER | ~6 (performance_reviews, check_ins) | assessment_results, kpi_evidence |
| **TOTAL** | **~31** | **~15** |

Script: `db/scripts/brownfield-wave-3-register.{ts,sh}` (deliverable).

### §2.2 Column mappings Wave 3

Estensione `brownfield.column_mappings`: +400-800 nuovi mappings (person data ha più colonne per entity rispetto a operating model).

**Critical mapping rules** (Wave 3-specific):
- `users.password_hash` → **NOT mapped** (placeholder generated fresh).
- `users.fiscal_code, iban, passport_number, bank_account_*` → **NOT mapped** (I8 out-of-scope + PII safety net).
- `users.email` → preserved as-is (demo addresses).
- `users.is_active` → mapped to `user_status` enum.
- `users.tenant_id` → resolved via `tenant_id_mappings`.
- Tutti i campi import devono avere `user_is_synthetic = true` enforced post-transform.

### §2.3 Expected row counts

| Target table | Expected rows | Notes |
|---|---:|---|
| `sys_users` | ~270 (+ 4 platform) | RTL 158 + SmartFood 82 + EcoNova 26 + Heuresys 4 |
| `sys_user_position_assignments` | ~270-320 | 1 PRIMARY per user + qualche SECONDARY/INTERIM |
| `sys_user_certifications` | ~500-1000 | media 2-4 per user (demo distribution) |
| `sys_user_skill_evidence` | ~2000-4000 | media 10-20 per user (skill matrix sparse) |
| `sys_user_kpi_evidence` | ~800-1500 | KPI evidence per quarter × user |
| `sys_user_assessment_evidence` | ~300-600 | performance review per user annuale |
| `sys_auth_credentials` | ~270 | 1 per user, all `must_rotate = true` |

---

## §3 Staging migration

### §3.1 Staging tables Wave 3

Migrations attese in range **000051+** (post Wave 2 range 000044-000050):

| Migration suggerita | Content |
|---|---|
| `000051_staging_wave3_users.sql` | `staging.wave3_users` + `staging.wave3_user_metadata` |
| `000052_staging_wave3_assignments.sql` | `staging.wave3_user_position_assignments`, `staging.wave3_user_position_history` |
| `000053_staging_wave3_certifications.sql` | `staging.wave3_user_certifications` |
| `000054_staging_wave3_skills_evidence.sql` | `staging.wave3_user_skill_evidence`, `staging.wave3_user_skill_history` |
| `000055_staging_wave3_kpi_evidence.sql` | `staging.wave3_user_kpi_evidence`, `staging.wave3_user_kpi_targets` |
| `000056_staging_wave3_assessment_evidence.sql` | `staging.wave3_user_assessment_evidence`, `staging.wave3_performance_reviews` |
| `000057_staging_wave3_documents.sql` | `staging.wave3_user_documents` (metadata only) |
| `000058_brownfield_table_mappings_wave_3_backfill.sql` | idempotent UPDATE backfill |
| `000059_audit_brownfield_approval_decisions_ext.sql` | extension audit.import_approval_decisions con approver_role + reason_code |

### §3.2 Idempotency

Stesso pattern Wave 2 §3.2.

---

## §4 Execution steps

### §4.1 Trigger (analogo Wave 2 §4.1, wave=3)

```bash
curl -X POST http://localhost:3001/v1/brownfield/import-runs \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b cookies.txt \
  -d '{"wave": 3, "mode": "EXECUTE"}'
```

### §4.2 State machine (stessi 8 states Wave 2)

Differenza chiave: state `APPROVED` può richiedere **human gate** invece di `auto-approval` (vedi §9 human approval workflow).

### §4.3 Audit watch live

Stesso pattern Wave 2 §4.3 + watch dedicato per approval decisions:

```sql
-- Pending human approvals
SELECT iad.import_approval_decision_id,
       iad.import_approval_decision_run_id,
       iad.import_approval_decision_status,
       iad.import_approval_decision_approver,
       iad.import_approval_decision_reason
  FROM audit.import_approval_decisions iad
 WHERE iad.import_approval_decision_run_id IN (
   SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 3
 )
 AND iad.import_approval_decision_status = 'PENDING'
 ORDER BY iad.import_approval_decision_created_at DESC;
```

### §4.4 Post-run validation

Stesso pattern Wave 2 §4.4 + check synthetic flag:

```sql
-- Check tutti gli imported users hanno user_is_synthetic = true
SELECT COUNT(*) FROM sys.sys_users u
 WHERE u.user_id IN (
   SELECT source_lineage_target_record_id FROM sys.sys_source_lineage_records
    WHERE source_lineage_target_table_name = 'sys_users'
      AND source_lineage_import_run_id IN (
        SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 3
      )
 )
 AND (u.user_is_synthetic = false OR u.user_type <> 'SYNTHETIC_REFERENCE');
-- Expected: 0
```

---

## §5 Acceptance criteria

### §5.1 Quantitative

```sql
-- AC-W3-01: ≥ 95% target users imported con synthetic flag corretto
SELECT
  COUNT(*) FILTER (WHERE user_is_synthetic = true) AS synthetic_users,
  COUNT(*) AS imported_users,
  COUNT(*) FILTER (WHERE user_is_synthetic = true) * 1.0 /
    NULLIF(COUNT(*), 0) AS synthetic_ratio
  FROM sys.sys_users u
 WHERE u.user_id IN (
   SELECT source_lineage_target_record_id FROM sys.sys_source_lineage_records
    WHERE source_lineage_target_table_name = 'sys_users'
      AND source_lineage_import_run_id IN (
        SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 3
      )
 );
-- Expected: synthetic_ratio ≥ 0.95, imported_users ~270
```

```sql
-- AC-W3-02: 0 password hash legacy importati (tutti placeholder + must_rotate)
SELECT COUNT(*) FROM sys.sys_auth_credentials c
 WHERE c.user_id IN (
   SELECT source_lineage_target_record_id FROM sys.sys_source_lineage_records
    WHERE source_lineage_target_table_name = 'sys_users'
      AND source_lineage_import_run_id IN (
        SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 3
      )
 )
 AND (c.credential_must_rotate = false OR c.credential_hash NOT LIKE '<placeholder>%');
-- Expected: 0
```

```sql
-- AC-W3-03: 0 PII column populated (defensive safety net)
-- (esempio per fiscal_code in user_metadata JSONB)
SELECT COUNT(*) FROM sys.sys_users
 WHERE user_id IN (... Wave 3 imported ...)
   AND (user_metadata ? 'fiscal_code'
        OR user_metadata ? 'iban'
        OR user_metadata ? 'passport_number'
        OR user_metadata ? 'bank_account');
-- Expected: 0
```

```sql
-- AC-W3-04: at most 1 ACTIVE PRIMARY assignment per user
SELECT COUNT(*) FROM sys.v_active_primary_assignment_per_user;
-- Expected: 0 violations
```

```sql
-- AC-W3-05: human approval audit trail completo
SELECT COUNT(*) FROM audit.import_approval_decisions
 WHERE import_approval_decision_run_id IN (
   SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 3
 )
 AND import_approval_decision_approver IS NULL;
-- Expected: 0 (every decision has approver assigned, AUTO or human email)
```

### §5.2 Qualitative

- **AC-W3-06**: Twice-run idempotency Wave 3 verde.
- **AC-W3-07**: Test suite globale + Playwright ≥ baseline.
- **AC-W3-08**: ADR pre-requisite list (§11) tutti ACCEPTED.
- **AC-W3-09**: Human approval UI live + tested (Playwright E2E `brownfield-approval.spec.ts`).
- **AC-W3-10**: Acceptance log linked nel runner doc con run_id + final_state + approval decisions count.

---

## §6 Rollback procedure

### §6.1 Light rollback (wave-scoped corrective)

Stesso pattern Wave 2 §6.1, scope Wave 3 lineage:

```sql
-- 1. Mark run FAILED
UPDATE brownfield.import_runs SET import_run_state = 'FAILED', ...
 WHERE import_run_id = '<wave3_run_id>';

-- 2. Per target Wave 3, delete con NOT EXISTS check dipendenze
-- ORDINE IMPORTANTE: prima evidence + assignments, poi users (FK cascade)
DELETE FROM sys.sys_user_skill_evidence WHERE user_id IN (
  SELECT u.user_id FROM sys.sys_users u
  JOIN sys.sys_source_lineage_records lr
    ON lr.source_lineage_target_record_id = u.user_id
   AND lr.source_lineage_target_table_name = 'sys_users'
   AND lr.source_lineage_import_run_id = '<wave3_run_id>'
);
DELETE FROM sys.sys_user_position_assignments WHERE user_id IN (...);
-- ... ripeti per ogni evidence table
DELETE FROM sys.sys_auth_credentials WHERE user_id IN (...);
DELETE FROM sys.sys_users u USING sys.sys_source_lineage_records lr
 WHERE lr.source_lineage_target_record_id = u.user_id
   AND lr.source_lineage_import_run_id = '<wave3_run_id>'
   AND u.user_is_synthetic = true
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_user_position_assignments WHERE user_id = u.user_id
   );

-- 3. Truncate staging Wave 3
TRUNCATE TABLE staging.wave3_users, staging.wave3_user_position_assignments, ...
  RESTART IDENTITY CASCADE;
```

### §6.2 Heavy rollback

Stesso pattern Wave 2 §6.2 con scope esteso a sys.sys_users + auth tables. **Più rischioso** perché auth FK chain è critica per session validity → invalidare tutte le sessions post-rollback obbligatoriamente.

```sql
-- Post heavy rollback: invalidate all sessions to prevent stale JWT refs
DELETE FROM sys.sys_auth_refresh_tokens;
-- (next login user must re-authenticate)
```

---

## §7 Known risks

### §7.1 Cascade chain Wave 2 → Wave 3

Wave 3 dipende da Wave 2 (positions, org_units, KPI definitions). Pre-flight check §1.4 enforces Wave 2 completion ≥ 85%.

### §7.2 Tenant ID resolution failure

I 2 platform users con `employee_id IS NULL` (vedi BROWNFIELD §5.2 #3) richiedono decision: attach to Heuresys System tenant o downgrade a PLATFORM_ADMIN scope. Mitigation: ADR-0022 (proposed) formalizza la decision pre-run.

### §7.3 Email uniqueness collisions

Email demo (`rtl-bank.org`, `smartfood.org`, ecc.) preservate as-is. Edge case: stesso email in 2+ tenant → vincolo UQ `(tenant, lower(email))` chiede tenant suffix. Mitigation: pre-staging validation + auto-rename con suffix.

### §7.4 Password hash regeneration

Legacy `users.password_hash` NOT mapped — tutti i synthetic users ricevono placeholder + `must_rotate = true`. Verificare che il login flow honor `must_rotate` (reset password mandatory). Mitigation: ADR-0022 documenta + E2E test verifica.

### §7.5 PII safety net (defensive)

Anche se demo data, il safety net pattern (ADR-0023) deve essere shipped per future real data import. Validation rule esplicita su column-name pattern match (`*fiscal*, *iban*, *passport*, *bank*`). Mitigation: rule embedded in staging validation phase.

### §7.6 Performance evidence volume

Skill evidence + KPI evidence + assessment evidence per ~270 users può generare ~5-10k canonical rows. Verificare batch size + transaction sizing per evitare lock contention.

### §7.7 Audit log inflation

Wave 3 può generare ~50k+ audit rows (`audit.import_validation_results` + `audit.import_run_logs` + `audit.import_approval_decisions`). Verificare disk space + indexing post-run.

---

## §8 Authorship + sign-off

Stesso pattern Wave 2 §8 + extra checklist gate:

### §8.1 Pre-execution checklist Wave 3-specific

- [ ] Runner doc reviewed Enzo + sign-off.
- [ ] Wave 2 completion ratio ≥ 0.85 verified.
- [ ] ADR pre-requisite list §11 tutti ACCEPTED.
- [ ] Human approval workflow UI deliverata + Playwright tested.
- [ ] Pre-flight script wave-3-preflight deliverato + tested.
- [ ] Wave 3 staging migrations (000051+) applied idempotently.
- [ ] `brownfield.table_mappings` Wave 3 populated + column_mappings curated.
- [ ] Backup pre-Wave-3 effettuato.
- [ ] Email collision pre-check eseguito.
- [ ] PII safety net rule attivo + tested.

---

## §9 Human approval workflow

### §9.1 Workflow overview

Quando `audit.import_validation_results.import_validation_result_status = NEEDS_REVIEW` o `confidence < 0.80`, la decision passa a human gate. UI deliverata in stream 2.2 MVP-4:

```
Brownfield Run Detail Page
└── /brownfield-adaptation/runs/[runId]/decisions
    ├── List pending decisions (filtered "needs review only")
    ├── Per decision card:
    │   ├── Source row preview (JSONB sample)
    │   ├── Proposed transform (mapping definition)
    │   ├── Validation messages (errors/warnings)
    │   ├── Confidence score
    │   ├── Actions: [Approve] [Reject + Comment] [Defer]
    │   └── Bulk actions: [Approve All Above 0.X Confidence]
    └── Audit log inline (chi ha approvato cosa quando)
```

### §9.2 RBAC

| Permission | Role |
|---|---|
| `brownfield:read` | TENANT_ADMIN+ |
| `brownfield:approve` | PLATFORM_ADMIN + TENANT_ADMIN (own tenant only) |
| `brownfield:reject` | PLATFORM_ADMIN + TENANT_ADMIN (own tenant only) |
| `brownfield:approve:bulk` | PLATFORM_ADMIN only |

Permission seeded in migration extension (post-MVP-3 nuovo subset di `sys.sys_auth_permissions`).

### §9.3 Backend endpoints

| Method | Path | RBAC | CSRF |
|---|---|---|---|
| `GET` | `/v1/brownfield/import-runs/:id/decisions` | `brownfield:read` | no |
| `POST` | `/v1/brownfield/import-runs/:id/decisions/:decisionId/approve` | `brownfield:approve` | yes |
| `POST` | `/v1/brownfield/import-runs/:id/decisions/:decisionId/reject` | `brownfield:reject` | yes |
| `POST` | `/v1/brownfield/import-runs/:id/decisions/bulk-approve` | `brownfield:approve:bulk` | yes |

Implementation in `apps/api/src/modules/brownfield-import-runs/` (extension) o nuovo modulo `brownfield-decisions/`.

### §9.4 Audit trail

Ogni decision write writes row in `audit.import_approval_decisions`:
- `import_approval_decision_id` (UUID)
- `import_approval_decision_run_id` (FK)
- `import_approval_decision_status` (`AUTO_APPROVED|HUMAN_APPROVED|HUMAN_REJECTED|DEFERRED`)
- `import_approval_decision_approver` (email | 'AUTO')
- `import_approval_decision_approver_role` (RoleCode | 'AUTO')
- `import_approval_decision_reason` (text)
- `import_approval_decision_confidence_at_decision` (numeric)
- `import_approval_decision_created_at` (timestamptz)

Audit table extension via migration `000059_audit_brownfield_approval_decisions_ext.sql` (vedi §3.1).

### §9.5 Notification (optional)

Out-of-scope Wave 3 MVP — ma pattern preparato per future: `sys.sys_inbox_notifications` insert per ogni TENANT_ADMIN del tenant interessato quando decisions pending count cross threshold (es. > 20). Mitigation cognitive load.

---

## §10 PII handling (defensive pattern)

### §10.1 Demo data context (current)

Per Wave 3 corrente, legacy `heuresys_platform` contiene **demo data owner-generated, no real PII** (RD-02 confirmed). Pattern PII handling resta defensive — per future real-data imports.

### §10.2 Defensive rules attivi

1. **Column-name pattern blacklist**: source columns matching pattern `*fiscal*|*iban*|*passport*|*bank_account*|*ssn*|*tax_id*|*medical*|*health*` NOT mapped a target. Verificare in column_mappings Wave 3 staging.
2. **Email domain preserved as-is**: demo domains kept (`rtl-bank.org`, ecc.). Future real data import deve override con anonymization step pre-staging.
3. **Password hash NOT imported**: placeholder + must_rotate (vedi §7.4).
4. **Document binaries NOT imported**: solo metadata URI in `sys.sys_user_documents`.
5. **Out-of-scope I8 columns**: payroll, T&A, benefits, bank details — NOT mapped indipendentemente da PII status.

### §10.3 Validation enforcement

Validation rule "PII column populated check" (AC-W3-03 §5.1) enforces zero PII in canonical rows. Pre-staging validation can also reject staging rows with PII pattern hits prima di reach upsert.

### §10.4 Audit logging PII attempts

Se PII pattern detected in source row durante staging, audit row con rule_code `PII_PATTERN_DETECTED_AND_EXCLUDED_V1` + source column hit + value redacted ("[REDACTED FOR AUDIT]").

---

## §11 ADR pre-requisite list

Lista ADR che devono essere ACCEPTED prima di Wave 3 trigger (riferimento §1.5):

### §11.1 ADR-0020 — Wave 3 demo data import protocol formalization

**Topic**: formalizza la decision RD-02 (no anonymization, demo data, no real PII) come ADR vincolante. Documenta i criteri sotto cui la decision è valid (fonte = owner-generated, scope = legacy `heuresys_platform` only) e quando deve essere revisited (real data ingestion futura).

### §11.2 ADR-0021 — Human approval workflow for brownfield imports

**Topic**: pattern human approval gate (workflow, RBAC, audit trail). Decision: 4-tier authorization (read/approve/reject/bulk-approve), tenant-scoped per TENANT_ADMIN, platform-scoped per PLATFORM_ADMIN. Audit table extension. Notification pattern (out-of-scope MVP, prepared).

### §11.3 ADR-0022 — Password hash regeneration policy

**Topic**: legacy password hash NOT imported. Placeholder hash generato fresh con `credential_must_rotate = true`. Login flow honor flag. Decision rationale: weak/unknown legacy algorithm + Argon2id v5 standard mandatory.

### §11.4 ADR-0023 — PII column safety net pattern

**Topic**: defensive column-name pattern blacklist + validation rule enforcement + audit logging redacted. Pattern shipped per future real data import.

ADR numbering provvisorio: range 0020..0023 assumendo 0019 = stream 2.9 `@spen-zosky/ui` Path. Definitive numbering post-MVP-4 stream apertura.

---

## §12 References

| Path | Use |
|---|---|
| `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` §5 | Wave 3 specification source |
| `docs/brownfield/wave_runners/wave_2_runner.md` | predecessor + template reference |
| `docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md` | mapping spec |
| `docs/architecture/adr/0011_ess_scope_inclusion.md` | self-scope hard enforcement reference |
| `docs/architecture/adr/0018_coalesce_uq_class_of_bug.md` | helper pattern |
| `docs/MVP_4_ROADMAP.md` §2.2 | stream context |
| `apps/api/src/modules/brownfield-import-runs/` | extension target per approval endpoints |
| `apps/api/src/modules/auth/` | auth credential pattern per `must_rotate` |
| `audit.import_approval_decisions` schema | audit table target extension |

---

**Fine wave_3_runner.md** — operational runbook + ADR pre-requisite gate, awaiting Wave 2 closure + 4 ADR ACCEPTED + sign-off.
