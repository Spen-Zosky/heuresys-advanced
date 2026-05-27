# Mapping Card — Surveys/Engagement → `sys.sys_surveys` / `sys_engagement_*`

- mapping_card_id: SURVEYS-MAP-01 · confidence_overall: 0.88 HIGH · workflow_phase: 5 (DATA pilot complete)
- source: `heuresys_platform_0507.public.{surveys, survey_responses, engagement_surveys, engagement_survey_responses}`
- target: `heuresys_advanced.sys.{sys_surveys, sys_survey_responses, sys_engagement_surveys, sys_engagement_survey_responses}`
- migration: 000049 · seed: `db/seeds/brownfield/sdbi/surveys/0{1,2,3}.sql` · approver: Enzo (S940)

## Result (live)
| target | rows |
|---|---|
| sys_surveys | 11 |
| sys_survey_responses | 4482 |
| sys_engagement_surveys | 18 |
| sys_engagement_survey_responses | 1124 |
| **lineage (SDBI-tagged)** | **5635** |

## FK / transforms
- `survey_responses` has no tenant_id → inherited from parent `surveys`; resolved to `sys_surveys` via natural_key **4482/4482**.
- `engagement_survey_responses` → `sys_engagement_surveys` via natural_key **1124/1124**.
- ARRAY (audience_ids, reminder_days) → jsonb; questions/answers jsonb direct; ts-without-tz → UTC.
- respondent/created_by user FKs NULL + legacy ids in metadata; question_id → `response_legacy_question_id` + metadata.

## Carry-over
- [TODO(CHECK)] survey_type/status/audience_type whitelists.
- Sub-tables deferred: survey_questions/templates, engagement_survey_templates (reference; future increment).
