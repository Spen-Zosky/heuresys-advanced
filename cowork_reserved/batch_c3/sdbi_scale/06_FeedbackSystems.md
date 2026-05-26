# Macro-area 06 — Feedback systems

**Lexicon**: PULSAR (engagement loop, complementary to #4)
**Tier 2 / Rank 7** · **Effort 6-8h pilot** · **Volume ~2859 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `continuous_feedback` | 729 | Ongoing peer/manager feedback notes |
| `feedback_360` | 714 | 360-degree feedback responses (peer + subordinate + manager) |
| `engagement_feedback` | 685 | Engagement-specific feedback (may overlap with #4 PULSAR) |
| `recognition` | 485 | Recognition awards / thanks notes |
| `feedback_requests` | 246 | Request for feedback (sender → recipient) |
| `feedback_responses` | 0 | source-empty — skip |

**Total importable**: ~2859 rows.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_continuous_feedback` | feedback_giver_id → lm.users, feedback_recipient_id → lm.users, content, visibility (public/private), created_at |
| `sys_feedback_360_responses` | 360 review entries — anchored to performance review cycle? Cross-area FK to #1 sys_performance_review_cycles optional |
| `sys_engagement_feedback` | Engagement-specific — discriminator: link to #4 surveys OR separate table. Prefer SEPARATE for clarity |
| `sys_recognition` | recognizer_id → lm.users, recognized_id → lm.users, award_type, message, points |
| `sys_feedback_requests` | requester_id, target_id, status, due_date |

**Total new sys.* tables**: 5.

---

## §3 — FK resolution strategy

- **lm.users** for all giver/recipient/requester/target.
- **tenant_id** via brownfield.tenant_id_mappings.
- **feedback_360 ↔ performance_reviews**: optional cross-area FK to #1 (sys_performance_reviews). If #1 not yet imported, store legacy_ref in metadata.
- **recognition with optional points → reward catalog**: optional FK to existing `sys.sys_reward_gate_catalog` (7 seeded rows). Most likely independent for MVP.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | MEDIUM (6-8h). 5 sys.* tables, simple FK pattern (mostly users + tenant), minor 360 cross-area soft dep |
| **Dependencies** | C3.2 users. SOFT: #1 Performance Reviews (for 360 link). Schedule after #1 OR accept NULL link |
| **Risks** | Engagement_feedback duplication with #4 PULSAR responses → introspect carefully; recognition free-text PII flag |
| **Recommended timing** | Wave 3 (C5 batch), 4th (after #4, #2, #3) — completes PULSAR cluster |

---

## §5 — Recommended order in C4/C5/C6 scale

**C5 batch, 4th pilot** (closes PULSAR + supplements GOKMER from #1).
