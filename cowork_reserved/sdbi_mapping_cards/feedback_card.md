# Mapping Card — Feedback cluster → `sys.sys_feedback_*` / `sys_continuous_feedback`

- mapping_card_id: FEEDBACK-MAP-01 · confidence_overall: 0.85 HIGH · workflow_phase: 5 (DATA pilot complete)
- source: `heuresys_platform_0507.public.{feedback_360, continuous_feedback, feedback_requests, feedback_responses}`
- target: `heuresys_advanced.sys.{sys_feedback_360, sys_continuous_feedback, sys_feedback_requests, sys_feedback_responses}`
- migration: 000048 · seed: `db/seeds/brownfield/sdbi/feedback/0{1,2,3}.sql` · approver: Enzo (S940)

## Result (live)
| target | rows |
|---|---|
| sys_feedback_360 | 714 |
| sys_continuous_feedback | 729 |
| sys_feedback_requests | 246 |
| sys_feedback_responses | 0 (see note) |
| **lineage (SDBI-tagged)** | **1689** |

## Cross-cluster FK (resolved via sys.* natural_key/metadata)
- `cf_related_goal_id` → `sys_goals` (metadata legacy_id): **215/729 resolved** (rest NULL in source).
- `*_review_cycle_id` → `sys_review_cycles`, `*_performance_review_id` → `sys_performance_reviews`: resolvers in place; `feedback_360.review_cycle_id` is **NULL for all 714** in source → 0 linked (data characteristic, not a defect).
- `content_embedding` (vector) skipped. ARRAY (tags) → jsonb. User FKs NULL + legacy ids in metadata.

## Data observations (source integrity, handled honestly)
- **4 feedback_responses excluded**: their `request_id` references requests absent from the dataset (orphans); `feedback_responses` has no tenant_id so cannot be placed without the parent → skipped at Phase 3 JOIN. CW-B17-style: documented exclusion, not silent.
- `feedback_360.review_cycle_id` entirely NULL in the 0507 snapshot.

## Carry-over
- [TODO(CHECK)] feedback_type / status / relationship_type / visibility whitelists.
- [DEFER] user FK resolution pending legacy employee→sys_users bridge.
- Sub-tables not yet imported: feedback_360_questionnaires/questions/peer_suggestions, feedback_categories (small reference; future increment).
