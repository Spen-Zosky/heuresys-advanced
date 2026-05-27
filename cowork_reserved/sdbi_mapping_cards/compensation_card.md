# Mapping Card — Compensation → `sys.sys_bonus_plans` / `sys_salary_bands` / `sys_salary_band_assignments`

- mapping_card_id: COMPENSATION-MAP-01 · confidence_overall: 0.85 HIGH · workflow_phase: 5 (DATA pilot complete)
- source: `heuresys_platform_0507.public.{bonus_plans, salary_bands, salary_band_assignments}`
- target: `heuresys_advanced.sys.{sys_bonus_plans, sys_salary_bands, sys_salary_band_assignments}`
- migration: 000051 · seed: `db/seeds/brownfield/sdbi/compensation/0{1,2,3}.sql` · approver: Enzo (S940)

## Result (live)
| target | rows |
|---|---|
| sys_bonus_plans | 10 |
| sys_salary_bands | 23 |
| sys_salary_band_assignments | 238 |
| **lineage (SDBI-tagged)** | **271** |

## FK / transforms + notes
- NEW tables (distinct from pre-existing `sys_compensation_bands`/`sys_bonus_pools` which have different schemas — no merge).
- `salary_band_assignments` has no tenant_id → inherited from parent `salary_bands`; resolved via natural_key **238/238**.
- ts-without-tz (bonus_plans, salary_bands, assignment_assigned_at) → UTC; numeric money → numeric(18,2), ratios → numeric(8,4); jsonb (eligibility_rules, performance_multipliers) direct; user FKs (created_by, employee, assigned_by) NULL + legacy ids in metadata.

## Carry-over
- [TODO(CHECK)] bonus_type / calculation_method / status whitelists.
- [DEFER] reconcile with sys_compensation_bands (75 brownfield rows) if a unified band model is desired.
