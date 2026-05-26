# Macro-area 04 — Surveys + Engagement + Wellbeing

**Lexicon**: PULSAR (Pulse-LinkedScore-Action-Retention)
**Tier 2 / Rank 4** · **Effort 8-12h pilot** · **Volume ~8156 rows (LARGE)**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `survey_responses` | 4482 | ✅ live verified — RLS-enabled, FK to surveys + survey_questions + employees_core |
| `engagement_survey_responses` | 1327 | Separate response stream for engagement-specific surveys |
| `pulse_checks` | 1145 | Lightweight 1-question pulse |
| `wellbeing_checkins` | 1142 | Wellbeing-specific check-ins |
| `survey_questions` | 31 | Question library |
| `engagement_surveys` | 18 | Engagement survey definitions |
| `surveys` | 11 | Standard survey definitions |
| `wellbeing_surveys` | (unknown, verify likely 0-10) | Wellbeing-specific survey definitions |

**Total importable**: ~8156 rows (4 large response tables + 4 small definition tables).

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_surveys` | Survey definitions (consolidated: surveys + engagement_surveys + wellbeing_surveys + maybe a type discriminator) |
| `sys_survey_questions` | Question library, FK survey_id |
| `sys_survey_responses` | LARGE table — Q+answer per row. Partition by tenant_id + created_at (DESIGN DECISION needed for 4482+ rows) |
| `sys_engagement_survey_responses` | Could MERGE with sys_survey_responses + type discriminator OR keep separate (recommend merge for normalization) |
| `sys_pulse_checks` | tenant_id, employee_id, pulse_question_text (inline), pulse_score, created_at |
| `sys_wellbeing_checkins` | tenant_id, employee_id, checkin_score, checkin_category (jsonb), notes |

**Total new sys.* tables**: 4-6 depending on merge decision.

**DESIGN DECISION (Phase 2 of pilot)**: merge engagement_survey_responses into sys_survey_responses with type discriminator? Recommendation: YES (denormalize at consume side).

---

## §3 — FK resolution strategy

- **tenant_id**: brownfield.tenant_id_mappings.
- **employee_id**: lm.employees_core (C3.2 ready). RLS policy on source means tenant_id strictly enforced.
- **survey_id (responses)**: sys_surveys (within macro-area).
- **question_id (responses)**: sys_survey_questions (within macro-area).
- **PII discovery**: text_value column in survey_responses may contain free-text PII. Apply `pii_disposition` flag in mappings.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | HIGH (8-12h). Large volume + design decision on merge + PII flagging |
| **Dependencies** | C3.2 users+employees. No cross-macro deps. |
| **Risks** | PERFORMANCE: 4482 rows via current SDBI lineage UQ index may be slow → batch insert in chunks of 500; PII free-text in text_value requires careful disposition |
| **Recommended timing** | Wave 3 (C5 batch), 1st (foundation for PULSAR + benchmark for #6 Feedback same lexicon) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C5 batch, 1st pilot**. Establishes PULSAR lexicon + performance benchmark for large-volume tables.
