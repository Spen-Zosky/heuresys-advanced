# Mapping Card — Succession/TalentPool → `sys.sys_talent_*` / `sys_succession_*` / `sys_critical_roles`

- mapping_card_id: SUCCESSION-MAP-01 · confidence_overall: 0.85 HIGH · workflow_phase: 5 (DATA pilot complete)
- source: `heuresys_platform_0507.public.{talent_pools, talent_pool_members, succession_plans, critical_roles, succession_candidates}`
- target: `heuresys_advanced.sys.{sys_talent_pools, sys_talent_pool_members, sys_succession_plans, sys_critical_roles, sys_succession_candidates}`
- migration: 000050 · seed: `db/seeds/brownfield/sdbi/succession/0{1,2,3}.sql` · approver: Enzo (S940)

## Result (live)
| target | rows |
|---|---|
| sys_talent_pools | 24 |
| sys_talent_pool_members | 40 |
| sys_succession_plans | 28 |
| sys_critical_roles | 16 |
| sys_succession_candidates | 86 |
| **lineage (SDBI-tagged)** | **194** |

## FK / transforms
- **Discovery correction**: `succession_candidates.critical_role_id` → `critical_roles` (86/100), NOT `succession_plans` (only 14/100). `critical_roles` added to cluster as the candidate parent.
- `succession_candidates` has no tenant_id → inherited from parent `critical_roles`. member→pool 40/40, candidate→critical_role 86/86 via natural_key.
- embeddings (talent_pools, succession_plans) skipped; criteria/jsonb direct; ts-without-tz (critical_roles, candidates) → UTC; user FKs (created_by, employee, incumbent) NULL + legacy ids in metadata; `succession_plans.position_id` → `plan_legacy_position_id` + metadata (no sys position bridge yet).

## Data observation
- **14 succession_candidates excluded**: `critical_role_id` references roles absent from `critical_roles`; candidates have no tenant_id so cannot be placed without parent → skipped at Phase 3 JOIN (documented, not silent).

## Carry-over
- [TODO(CHECK)] readiness/criticality/risk/status whitelists.
- [DEFER] position_id → sys position FK; user FK resolution.
