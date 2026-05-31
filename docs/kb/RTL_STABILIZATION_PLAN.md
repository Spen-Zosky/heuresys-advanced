# RTL Bank Stabilization — Definitive Plan (B-50 remediation)

**Owner**: CLI. **Status**: in execution (P0 done). Durable SoT for a multi-phase data-quality remediation (survives context compaction).
**Origin**: S953 — during R2 (role assignment) the RTL rebuild (S950) was found to have diffuse data-quality defects. User goal: **RTL Bank = the single, perfect case-study tenant** through which the role-based frontend is built and tested; **Heuresys = the superuser-admin tenant**.

## Authoritative source (resolved S953)
Two legacy Docker DBs exist; the **VM is the more up-to-date** → use it as source (ADR-0023):
- **`oracle-vm-default` / container `heuresys_evo_platform_db` / db `heuresys_platform`** (user `heuresys`) — `max(updated_at)=2026-05-11`, 1021 MB, 575 tables. **AUTHORITATIVE.**
- PC-local `heuresys_evo_db` (Docker Desktop) — `max(updated_at)=2026-04-28` (13 days older). Not the source.
- Access pattern (no password logged): `ssh oracle-vm-default 'docker exec -i heuresys_evo_platform_db sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U \$POSTGRES_USER -d \$POSTGRES_DB"'` (script via stdin).

## Audit findings (S953, live advanced DB)
**Footprint RTL actually used** (small, mostly valid):
- Positions 162 (5-level reports_to hierarchy ✓, 26 OU 4-level ✓) — but `position_title` generic + 3 UUID, `position_job_role_id` **NULL on all 162**.
- Skills: only **31 distinct used** (902 evidence); names OK (ESCO-resolved: "Data analysis", "cyber security"…), codes are `OLDDB::esco_skills::<uuid>`.
- Comp: **8 bands used** (160 profiles) — all clean ✓.
- Cert: 423 — names OK, but some `"E2E Test Cert <ts>"` (test residue).
- Assessment 615+1560, attendance 3180, overtime 221 — transactional ✓. Visualization 161/160 (org graph, regen after P2).
- Learning: **0 usage** (assignments/evidence/requirements all 0) — catalog 8.406 fully orphan.
- KPI/gap/career: empty.

**Catalog corruption** (`OLDDB::<source>::<uuid>` placeholders, ingestion Wave-1 unresolved lookups): skills 20.048/20.073, learning_modules 5.051, learning_paths 3.187, job_roles 91/202, comp_bands 46, skill_families 14. **42.218 corrupt textual values** total.

**Tenants**: 4 present → only HEURESYS + RTL_BANK should remain; `RTL_BANK_REFERENCE` (ACTIVE, 0 users/pos) + `DEMO_BANK_TEST` (ARCHIVED) to delete.

## Locked decisions (user-confirmed S953)
1. **Source = legacy VM** (more up-to-date). Re-derive position title/job_role from it.
2. **Skill catalog (20k)**: do NOT delete — **resolve codes** for all skills from their resolved ESCO names (full clean catalog). Bigger work, but complete.
3. **Learning**: **purge** the orphan catalog (0 usage) + **seed a minimal RTL-relevant set** (modules/paths + assignments) so the learning frontend pages are testable with real data.
4. Skills used (31) get readable codes; comp (8) already clean.

## Phases
| Phase | Action | Status |
|---|---|---|
| **P0** | `pg_dump` snapshot pre-remediation | ✅ DONE — `pg_dump_snapshots/pre-rtl-stabilization_69fdbfd_20260531_203326.dump` (416 MB) |
| **P1** | Delete 2 extra tenants (`RTL_BANK_REFERENCE`, `DEMO_BANK_TEST`; both empty) → HEURESYS + RTL_BANK only | ✅ DONE — deps all 0, `DELETE 2`, only HEURESYS + RTL_BANK remain (both ACTIVE) |
| **P2** | Re-derive `position_title` + `position_job_role_id` for the 162 positions from the **legacy VM** | ⏳ **proposal generated, AWAITING USER REVIEW of the CSV** (no DB write yet) |
| **P3** | Resolve readable `code` for skills from ESCO names (full catalog); fix job_role/comp_band/skill_family corrupt codes | ⏳ |
| **P4** | Purge orphan learning catalog + seed minimal RTL learning (modules/paths + assignments) | ⏳ |
| **P5** | Remove `"E2E Test Cert"` rows; fix user (display_name `IT_ME_`, email test, 1 orphan assignment) | ⏳ |
| **P6** | Regenerate visualization (org graph) from corrected data | ⏳ |
| **P7** | Re-audit (0 footprint corruption, 2 tenants) + API 354 / E2E 138 / CI 5 → then unblock **R2** (role assignment with correct titles) | ⏳ |

## P2 exploration findings (S953, legacy VM)
Legacy `heuresys_platform` is **multi-tenant** (RTL Bank 158 emp / SmartFood 82 / EcoNova 26 / Heuresys 4) — explains the mixed-industry job catalog. Key schema for RTL job derivation:
- **`tenant_jobs`** (RTL: 8 rows) = the **clean job catalog**: `job_code`, `title_it`/`title_en`, `org_level`, `is_management`, `tenant_org_unit_id`, `esco_occupation_code`, salary band. RTL jobs: CEO(lvl1,mgmt), Bank manager(lvl3,mgmt), Bank teller / Compliance officer / Financial analyst / Investment advisor / Risk analyst / Securities dealer (lvl6).
- **`employees`** (RTL 158) — match to advanced **via EMAIL** (`employees.email` = `sys_users.user_email`); NOT via `user_external_code` (the `LEGACY:<uuid>` id is NOT `employees.id`).
- **`employee_job_assignments`** (`employee_id`→`tenant_job_id`, `is_current`): RTL coverage **only 43/158**; CEO & Bank manager have 0 holders. **`employee_occupations`** (156/158) maps to `esco_occupation_id` (different axis).
- Hierarchy: `tenant_org_units` + `tenant_org_charts` (metadata only; node structure TBD).

**Consequence**: the legacy is NOT a clean copy-source for all 162 position titles — its employee→job link is fragmented. P2 must **combine**: legacy clean job catalog (8 titles + org_level + is_management) + advanced clean hierarchy (reports_to 5-level + 26 OU) + per-incumbent legacy job (via email→tenant_job_assignment where present, fallback ESCO occupation / derive from level×OU). **Mapping strategy to be designed + validated with Enzo before apply.**

## P2 derivation method (designed S953)
**Source = legacy ESCO occupation** (the real profession), matched **via email** (`employees.email`=`sys_users.user_email`), NOT the mal-assigned `tenant_job`. RTL has 7 distinct ESCO occupations (with ISCO codes): direttore di banca (1346), analista finanziario (2413), consulente finanziario (2412), analista del rischio di credito (3312), operatore titoli (3311), esattore/esattrice (3352), addetto allo sportello bancario (4211).
- Staging loaded: **`staging.legacy_rtl_occupations`** (156 rows: email, esco_label, isco_code, esco_code) — extracted from legacy via `\copy FROM STDIN` (Windows path mismatch: don't use `/tmp` file path with psql `\copy`, pipe to STDIN).
- **Title rule**: a **manager-node** (has subordinates via reports_to) whose ESCO is NOT managerial (isco not LIKE '1%') → forced to `'direttore di banca/direttrice di banca'`; operatives → ESCO `preferred_label_it` **verbatim** (user choice: keep bilingual-gender form). 156/162 matched.
- **6 special**: Platform Admin (Tenant Owner, Heuresys superuser, keep), Andrea Spenuso + POS-00000001 (Heuresys, separate), POS-00000003 Product&Dev (scaffold no-incumbent, delete), Giuseppe Ferri (RTL → direttore di banca), Maria Colombo (RTL HR → direttore RU).
- **Proposal file**: `qa_artifacts/p2_rtl_title_proposal.csv` (162 rows old→new) — sent to Enzo.

## ▶ RESUME
P0+P1 done (backup 416 MB; HEURESYS + RTL_BANK only). Legacy VM source confirmed. **P2 proposal GENERATED — AWAITING USER REVIEW of `qa_artifacts/p2_rtl_title_proposal.csv` (NO DB write yet)**. Open question raised: root RTL (Federica) title = "direttore di banca" like division heads, or distinct "Direttore Generale"? **NEXT (after Enzo's corrections)**: write UPDATE migration/seed (`sys_positions.position_title` via staging email-join + special handling) + create the **7 clean job_roles** (from ESCO occupations) + wire `position_job_role_id` → re-test → P3 (skill codes) → P4-P7. P2 blocks R2. Execution is multi-phase; each destructive phase needs backup + idempotent script + re-validation. R2 (roles) is blocked on P2 (correct titles). Cross-ref: `docs/kb/RBAC_UIX_PERSPECTIVES_PLAN.md` (R2), `memory/project_rtl_tenant_rebuild.md` (S950 rebuild), ADR-0023 (no-PII legacy source doctrine).
