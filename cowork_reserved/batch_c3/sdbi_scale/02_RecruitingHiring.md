# Macro-area 02 — Recruiting + Hiring

**Lexicon**: H2R (Hire-to-Retire) — phase 1 (Recruiting)
**Tier 2 / Rank 5** · **Effort 6-10h pilot** · **Volume ~546 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `applications` | 150 | ✅ live introspect needed (candidate-job link) |
| `interviews` | 120 | Multi-stage interview tracking |
| `candidates` | 100 | Distinct from recruiting_candidates? Verify |
| `recruiting_candidates` | 96 | ✅ live introspect needed — clarify vs candidates |
| `requisitions` | 50 | Job opening definitions |
| `recruiting_offers` | 30 | Offer letter records |
| `candidate_skills` | (unknown, verify) | Bridge skills→candidate, large potential |
| `candidate_assessments` | (unknown, verify) | Pre-hire evals |
| `recruiting_pipelines` | (unknown, verify) | Stage workflow templates |
| `recruiting_stages` | (unknown, verify) | Pipeline stages |

**Total importable**: ~546 rows confirmed, possibly higher if candidate_skills/assessments populated.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_requisitions` | Job opening — FK tenant_id, requisition_position_id (→ sys_positions if exists), requisition_hiring_manager_id |
| `sys_candidates` (consolidated) | Merge candidates + recruiting_candidates. Decide canonical schema via discovery |
| `sys_applications` | candidate → requisition link, status workflow |
| `sys_interviews` | application_id → sys_applications, interviewer_id → lm.users, panel_metadata jsonb |
| `sys_recruiting_offers` | application_id → sys_applications, offer_status, comp_package jsonb |
| `sys_recruiting_pipelines` | Pipeline template (tenant_id, name, stages_count) |
| `sys_recruiting_pipeline_stages` | Stage definitions, pipeline_id FK |
| `sys_candidate_skills` (optional) | Skill match score per candidate, FK candidate_id + skill_id |
| `sys_candidate_assessments` (optional) | Assessment results pre-hire |

**Total new sys.* tables**: 7-9 depending on candidate_skills/assessments live row counts.

---

## §3 — FK resolution strategy

- **tenant_id**: via `brownfield.tenant_id_mappings`.
- **candidate consolidation**: candidates (100) + recruiting_candidates (96) → likely overlap. Phase 1 discovery: dedup logic via natural key (email or external_id).
- **interviewer_id**: lm.users (C3.2 ready).
- **hiring_manager_id**: lm.users.
- **position_id (requisition link)**: optional FK to existing `sys.sys_positions` (161 rows). NULL allowed if position absent.
- **skill_id (candidate_skills)**: existing `sys.sys_skills` (6037 rows shipped). Strong resolution.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | MEDIUM (6-10h). Candidate dedup adds 1-2h. |
| **Dependencies** | Independent of #3 Onboarding from data POV (recruiting completes before onboarding), but #3 has FK back to #2 → run #2 BEFORE #3 |
| **Risks** | candidates/recruiting_candidates schema ambiguity (CW-B26 phantom risk); resolve via discovery introspect SAMPLE rows before authoring |
| **Recommended timing** | Wave 3 (C5 batch), 2nd in batch after #4 Surveys (PULSAR grouping) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C5 batch, 2nd pilot** (after #4 Surveys for PULSAR domain consolidation, before #3 Onboarding for H2R sequential chain).
