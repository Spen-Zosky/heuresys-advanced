# Macro-area 03 — Onboarding + Preboarding

**Lexicon**: H2R (Hire-to-Retire) — phase 2 (Onboarding)
**Tier 2 / Rank 6** · **Effort 4-6h pilot (post #2 Recruiting)** · **Volume ~333 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `preboarding_tasks` | 180 | Pre-hire task assignments (before day 1) |
| `onboarding_tasks` | 153 | Day-1+ task assignments |
| `onboarding_plans` | 0 | source-empty — skip OR check if plan templates seeded elsewhere |
| `onboarding_buddy_assignments` | 0 | source-empty — skip |
| `onboarding_feedback` | 0 | source-empty — skip |

**Total importable**: ~333 rows across 2 active tables.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_onboarding_plans` (template) | Even if source-empty, define schema for future seeding |
| `sys_onboarding_tasks` | task_employee_id → lm.employees_core, task_plan_id (nullable, optional), task_status, task_due_date, task_assignee_id (manager/buddy) |
| `sys_preboarding_tasks` | similar to onboarding_tasks but task_candidate_id → sys_candidates (cross-area dep #2) |
| `sys_onboarding_buddy_assignments` (empty placeholder) | scaffold for future |
| `sys_onboarding_feedback` (empty placeholder) | scaffold for future |

**Total new sys.* tables**: 5 (3 with data, 2 scaffold).

---

## §3 — FK resolution strategy

- **task_employee_id**: lm.employees_core (C3.2 ready).
- **task_candidate_id** (preboarding): cross-macro-area FK to `sys_candidates` (#2). REQUIRES #2 done first.
- **task_assignee_id (manager/buddy)**: lm.users.
- **tenant_id**: brownfield.tenant_id_mappings.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | LOW (4-6h). Small schema, only 2 active source tables, simple FK structure |
| **Dependencies** | HARD: #2 Recruiting (for task_candidate_id resolution in preboarding_tasks). Schedule #2 → #3 in same C5 batch |
| **Risks** | preboarding_tasks may have candidate refs to non-imported candidates → use NULL or skip pattern |
| **Recommended timing** | Wave 3 (C5 batch), IMMEDIATELY AFTER #2 |

---

## §5 — Recommended order in C4/C5/C6 scale

**C5 batch, 3rd pilot** (after #4 + #2). Dependency chain locked.
