# Macro-area 11 — Talent Pool ext

**Lexicon**: TALPIPE (Talent Pipeline)
**Tier 3 / Rank 8** · **Effort 4-6h pilot** · **Volume ~319 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `career_recommendations` | 192 | AI/manager recommendations for next career step |
| `talent_pool_members` | 40 | High-potentials in talent pools |
| `career_paths` | 32 | Career path templates (role → role chain) |
| `succession_plans` | 31 | Per critical position succession candidates |
| `talent_pools` | 24 | Talent pool definitions |
| `high_potential_employees` | (unknown, verify) | HiPo flag list |
| `career_path_levels` | (unknown, verify) | Per-level milestones |
| `career_goal_milestones` | (unknown, verify) | Cross-link to #1 Goals/OKRs |

**Total importable**: ~319 rows confirmed.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_talent_pools` | Pool definitions (tenant_id, name, criteria jsonb, owner_user_id) |
| `sys_talent_pool_members` | pool_id → sys_talent_pools, member_employee_id → lm.employees_core, joined_at, status |
| `sys_career_paths` | Path templates (origin_role + target_role + milestone chain) |
| `sys_career_path_steps` | Path step ladder, FK to career_paths |
| `sys_career_recommendations` | employee_id, recommended_role / target_path, score, generated_by (model or manager) |
| `sys_succession_plans` | position_id → sys.sys_positions, successor_employee_id, readiness_level (HIGH/MEDIUM/LOW), confidence |
| `sys_high_potential_employees` (optional flag table) | employee_id, hipo_flag, identified_at |

**Total new sys.* tables**: 6-7.

---

## §3 — FK resolution strategy

- **employee_id**: lm.employees_core (C3.2 ready).
- **owner_user_id**: lm.users.
- **position_id (succession)**: existing `sys.sys_positions` (161 rows). Strong FK candidate.
- **tenant_id**: brownfield.tenant_id_mappings.
- **Cross-area dep**: career_goal_milestones may FK to already-shipped `sys.sys_goals` (1067) or `sys.sys_goal_milestones` (1000). Strong typing.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | LOW (4-6h). Light volume, existing positions/goals provide good anchor |
| **Dependencies** | C3.2 users+employees. Existing sys_positions + sys_goals (✅ shipped). No cross-D-area deps |
| **Risks** | Critical_positions (linked) require sys_critical_positions which is in F10 §2.6 — schema may need scaffold first |
| **Recommended timing** | Wave 4 (C6 batch), 1st (TALPIPE foundation for #7 Mentorship pairing) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C6 batch, 1st pilot** (TALPIPE foundation, opens path for #7 Mentorship).
