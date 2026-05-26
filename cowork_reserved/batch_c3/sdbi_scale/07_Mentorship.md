# Macro-area 07 — Mentorship

**Lexicon**: TALPIPE (Talent Pipeline)
**Tier 3 / Rank 9** · **Effort 4-6h pilot** · **Volume ~509 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `mentorship_sessions` | 355 | Individual session logs (mentor + mentee + topic + notes) |
| `mentorships` | 124 | Long-lived mentor-mentee pairing |
| `mentor_match_scores` | 30 | AI/algorithmic match recommendations pre-pairing |
| `mentorship_goals` | (unknown, verify) | Goals within mentorship relationship |
| `mentorship_feedback` | (unknown, verify) | Feedback per session |

**Total importable**: ~509 rows (confirmed) + potentially more.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_mentorships` | mentor_user_id → lm.users, mentee_user_id → lm.users, status, start/end dates, focus_area |
| `sys_mentorship_sessions` | session_mentorship_id → sys_mentorships, session_date, duration_minutes, notes, topics jsonb |
| `sys_mentor_match_scores` | match_mentor_user_id, match_mentee_user_id, score (0-100), reason jsonb. Optional FK to sys_mentorships if pairing materialized |
| `sys_mentorship_goals` (optional) | Goal cross-link to #1 GOKMER / Goals OKRs already shipped |
| `sys_mentorship_feedback` (optional) | session_id FK, feedback_text |

**Total new sys.* tables**: 3-5.

---

## §3 — FK resolution strategy

- **mentor_user_id / mentee_user_id**: lm.users (C3.2 ready).
- **tenant_id**: brownfield.tenant_id_mappings.
- **mentorship_goals ↔ sys_goals**: optional cross-area FK to already-shipped `sys.sys_goals` (1067 rows). Strong typing potential.
- **mentor_match_scores**: typically pre-pairing, FK to sys_mentorships may not exist yet. Allow nullable.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | LOW (4-6h). Small volume, simple FK chain (mostly users) |
| **Dependencies** | C3.2 users. Soft: sys_goals already shipped (for goal link if used) |
| **Risks** | None significant. Pure greenfield additive |
| **Recommended timing** | Wave 4 (C6 batch), 2nd after #11 Talent Pool (TALPIPE clustering) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C6 batch, 2nd pilot** (TALPIPE pair with #11).
