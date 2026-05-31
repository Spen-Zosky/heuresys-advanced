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
| **P1** | Delete 2 extra tenants (`RTL_BANK_REFERENCE`, `DEMO_BANK_TEST`; both empty) → HEURESYS + RTL_BANK only | ⏳ |
| **P2** | Re-derive `position_title` + `position_job_role_id` for the 162 positions from the **legacy VM** (authoritative), matched via `user_external_code='LEGACY:'||legacy.id` + reports_to×OU; present mapping for validation before applying | ⏳ |
| **P3** | Resolve readable `code` for skills from ESCO names (full catalog); fix job_role/comp_band/skill_family corrupt codes | ⏳ |
| **P4** | Purge orphan learning catalog + seed minimal RTL learning (modules/paths + assignments) | ⏳ |
| **P5** | Remove `"E2E Test Cert"` rows; fix user (display_name `IT_ME_`, email test, 1 orphan assignment) | ⏳ |
| **P6** | Regenerate visualization (org graph) from corrected data | ⏳ |
| **P7** | Re-audit (0 footprint corruption, 2 tenants) + API 354 / E2E 138 / CI 5 → then unblock **R2** (role assignment with correct titles) | ⏳ |

## ▶ RESUME
P0 done (backup 416 MB). Legacy VM source confirmed up-to-date. **NEXT = P1** (safe tenant delete) then **P2** (legacy schema exploration → position title/job_role mapping, present to Enzo before apply). Execution is multi-phase; each destructive phase needs backup + idempotent script + re-validation. R2 (roles) is blocked on P2 (correct titles). Cross-ref: `docs/kb/RBAC_UIX_PERSPECTIVES_PLAN.md` (R2), `memory/project_rtl_tenant_rebuild.md` (S950 rebuild), ADR-0023 (no-PII legacy source doctrine).
