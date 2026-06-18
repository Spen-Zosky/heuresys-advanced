-- 55_survey_templates.sql — #6/#10 (S996): import the legacy survey_templates catalog into
-- the normalized mirror (mig 000140), completing the m2b cluster (seed 48).
--
-- Scope = only the templates whose legacy tenant maps to a v5 tenant (brownfield.tenant_id_mappings):
--   legacy 0c54b84a -> v5 RTL_BANK  86ba7a65  (1 template)
--   legacy d5855519 -> v5 HEURESYS  8bc5bc59  (1 template)
-- The other legacy tenants' templates (fb1e866c=1, 1d7bf448=6) have NO tenant mapping → out of
-- scope (consistent with the RTL/HEURESYS-only scope of the mirror cluster). Natural key
-- LEGACY_TPL::<legacy id>. Data baked from the legacy DB (heuresys_platform.survey_templates).
-- Idempotent: ON CONFLICT (tenant, natural_key) DO NOTHING (re-run = no new rows).

BEGIN;

INSERT INTO sys.sys_survey_templates
  (survey_template_tenant_id, survey_template_natural_key, survey_template_name,
   survey_template_description, survey_template_type, survey_template_questions,
   survey_template_is_anonymous, survey_template_estimated_minutes, survey_template_is_system,
   survey_template_metadata)
VALUES
  ('86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid,
   'LEGACY_TPL::9b4c0728-9544-47fd-8291-37b388a49b34',
   'Custom Engagement Survey', 'General employee engagement survey', 'custom',
   $q$[{"id": "c1", "text": "How well do our processes support your work?", "type": "rating", "scale": 5, "category": "process"}, {"id": "c2", "text": "How effectively do we communicate company goals?", "type": "rating", "scale": 5, "category": "communication"}, {"id": "c3", "text": "How satisfied are you with professional development opportunities?", "type": "rating", "scale": 5, "category": "development"}, {"id": "c4", "text": "Which area needs the most improvement?", "type": "multiple_choice", "options": ["Technology", "Training", "Communication", "Work environment", "Benefits"], "category": "improvement"}, {"id": "c5", "text": "What specific suggestions do you have?", "type": "text", "category": "suggestions"}]$q$::jsonb,
   true, 8, false,
   jsonb_build_object('legacy_template_id', '9b4c0728-9544-47fd-8291-37b388a49b34')),
  ('8bc5bc59-f2d2-4a8a-882a-ea26ac367858'::uuid,
   'LEGACY_TPL::1d1f449d-02e5-437e-94cb-21dddbdeff8d',
   'Custom Engagement Survey', 'General employee engagement survey', 'custom',
   $q$[{"id": "c1", "text": "How well do our processes support your work?", "type": "rating", "scale": 5, "category": "process"}, {"id": "c2", "text": "How effectively do we communicate company goals?", "type": "rating", "scale": 5, "category": "communication"}, {"id": "c3", "text": "How satisfied are you with professional development opportunities?", "type": "rating", "scale": 5, "category": "development"}, {"id": "c4", "text": "Which area needs the most improvement?", "type": "multiple_choice", "options": ["Technology", "Training", "Communication", "Work environment", "Benefits"], "category": "improvement"}, {"id": "c5", "text": "What specific suggestions do you have?", "type": "text", "category": "suggestions"}]$q$::jsonb,
   true, 8, false,
   jsonb_build_object('legacy_template_id', '1d1f449d-02e5-437e-94cb-21dddbdeff8d'))
ON CONFLICT (survey_template_tenant_id, survey_template_natural_key) DO NOTHING;

COMMIT;
