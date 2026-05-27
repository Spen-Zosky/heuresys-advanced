# Mapping Card — Mentorship cluster → `sys.sys_mentorship_*` / `sys_mentor_match_scores`

- mapping_card_id: MENTORSHIP-MAP-01 · confidence_overall: 0.85 HIGH · workflow_phase: 5 (DATA pilot complete)
- source: `heuresys_platform_0507.public.{mentorship_programs, mentorships, mentorship_sessions, mentor_match_scores}`
- target: `heuresys_advanced.sys.{sys_mentorship_programs, sys_mentorships, sys_mentorship_sessions, sys_mentor_match_scores}`
- migration: 000047 · seed: `db/seeds/brownfield/sdbi/mentorship/0{1,2,3}.sql` · approver: Enzo (S940)

## Result (live)
| target | rows |
|---|---|
| sys_mentorship_programs | 12 |
| sys_mentorships | 124 |
| sys_mentorship_sessions | 355 |
| sys_mentor_match_scores | 30 |
| **lineage (SDBI-tagged)** | **521** |

## Transforms / FK
- tenant via `brownfield.tenant_id_mappings`; `mentorship_sessions` has no tenant_id → inherited from parent `mentorships`.
- ARRAY (focus_areas, goals, topics) → jsonb. ts-without-tz → timestamptz UTC.
- FK: program via programs natural_key; session→mentorship via natural_key (0 dangling). User FKs (mentor/mentee) NULL + legacy ids in metadata (goals-pilot precedent). `skill_id` → `match_legacy_skill_id` + metadata (no sys.* mentor-skill target).
- Categoricals UPPERCASE; value-CHECK TODO pending full enumeration.

## Carry-over
- [TODO(CHECK)] status/type/meeting_frequency whitelists.
- [DEFER] resolve mentor/mentee user FK once a legacy employee→sys_users bridge exists.
