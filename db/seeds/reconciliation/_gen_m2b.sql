-- GENERATOR (run on the legacy heuresys_platform DB; emits the m2b import seed body).
-- Not applied to v5. Output (4 self-contained INSERT...SELECT statements) is captured into
-- 48_engagement_normalized.sql. RTL slice only (legacy tenant 0c54b84a -> v5 86ba7a65).
-- Run with psql -tA (tuples-only, unaligned) so no \pset echo lines leak into the output.

-- §1 surveys
SELECT
  E'INSERT INTO sys.sys_surveys\n  (survey_tenant_id, survey_natural_key, survey_title, survey_description, survey_type,\n   survey_status, survey_start_date, survey_end_date, survey_is_anonymous, survey_total_invitations, survey_metadata)\nSELECT ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''::uuid, src.nk, src.title, src.descr, src.stype,\n  src.status, src.sdate::date, src.edate::date, src.anon::boolean, src.invites, jsonb_build_object(''legacy_survey_id'', src.lid)\nFROM (VALUES\n' ||
  string_agg(
    format('  (%L,%L,%L,%L,%L,%L,%L,%L,%s,%L)',
      'LEGACY_SURVEY::'||id, title, description, survey_type,
      CASE WHEN status IN ('draft','active','closed','archived') THEN status ELSE 'closed' END,
      start_date::text, end_date::text,
      CASE WHEN is_anonymous THEN 'true' ELSE 'false' END,
      coalesce(total_invitations::text,'NULL'), id::text),
    E',\n' ORDER BY id) ||
  E'\n) AS src(nk, title, descr, stype, status, sdate, edate, anon, invites, lid)\nON CONFLICT (survey_tenant_id, survey_natural_key) DO NOTHING;\n'
FROM surveys WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';

-- §2 survey_questions (survey via LEGACY_SURVEY:: natural key)
SELECT
  E'INSERT INTO sys.sys_survey_questions\n  (survey_question_survey_id, survey_question_tenant_id, survey_question_natural_key,\n   survey_question_text, survey_question_type, survey_question_options, survey_question_category,\n   survey_question_display_order, survey_question_is_required)\nSELECT s.survey_id, ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''::uuid, src.nk, src.qtext, src.qtype,\n  src.opts::jsonb, src.cat, src.dord, src.req::boolean\nFROM (VALUES\n' ||
  string_agg(
    format('  (%L,%L,%L,%L,%L,%L,%s,%L)',
      'LEGACY_SQ::'||id, 'LEGACY_SURVEY::'||survey_id, question_text, question_type,
      options::text, category, coalesce(display_order::text,'NULL'),
      CASE WHEN is_required THEN 'true' ELSE 'false' END),
    E',\n' ORDER BY id) ||
  E'\n) AS src(nk, survnk, qtext, qtype, opts, cat, dord, req)\nJOIN sys.sys_surveys s ON s.survey_natural_key = src.survnk AND s.survey_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''::uuid\nON CONFLICT (survey_question_tenant_id, survey_question_natural_key) DO NOTHING;\n'
FROM survey_questions WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';

-- §3 survey_responses (survey + question via NK; subject via LEGACY_EMP::)
SELECT
  E'INSERT INTO sys.sys_survey_responses\n  (survey_response_survey_id, survey_response_question_id, survey_response_tenant_id,\n   survey_response_subject_user_id, survey_response_natural_key, survey_response_rating_value,\n   survey_response_text_value, survey_response_choice_value, survey_response_metadata)\nSELECT s.survey_id, q.survey_question_id, ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''::uuid,\n  u.user_id, src.nk, src.rating, src.tval, src.cval,\n  jsonb_build_object(''legacy_employee_id'', src.emp)\nFROM (VALUES\n' ||
  string_agg(
    format('  (%L,%L,%L,%s,%L,%L,%L)',
      'LEGACY_SR::'||id, 'LEGACY_SURVEY::'||survey_id, 'LEGACY_SQ::'||question_id,
      coalesce(rating_value::text,'NULL'), text_value, choice_value, employee_id::text),
    E',\n' ORDER BY id) ||
  E'\n) AS src(nk, survnk, qnk, rating, tval, cval, emp)\nJOIN sys.sys_surveys s ON s.survey_natural_key = src.survnk AND s.survey_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''::uuid\nLEFT JOIN sys.sys_survey_questions q ON q.survey_question_natural_key = src.qnk AND q.survey_question_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''::uuid\nLEFT JOIN sys.sys_users u ON u.user_external_code = ''LEGACY_EMP::''||src.emp\nON CONFLICT (survey_response_tenant_id, survey_response_natural_key) DO NOTHING;\n'
FROM survey_responses WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';

-- §4 pulse_checks (subject via LEGACY_EMP::)
SELECT
  E'INSERT INTO sys.sys_pulse_checks\n  (pulse_check_tenant_id, pulse_check_subject_user_id, pulse_check_natural_key,\n   pulse_check_mood_score, pulse_check_workload_score, pulse_check_satisfaction_score,\n   pulse_check_comment, pulse_check_date, pulse_check_week_number, pulse_check_metadata)\nSELECT ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''::uuid, u.user_id, src.nk, src.mood, src.workload, src.satisf,\n  src.cmt, src.cdate::date, src.week, jsonb_build_object(''legacy_employee_id'', src.emp)\nFROM (VALUES\n' ||
  string_agg(
    format('  (%L,%s,%s,%s,%L,%L,%s,%L)',
      'LEGACY_PC::'||id, coalesce(mood_score::text,'NULL'), coalesce(workload_score::text,'NULL'),
      coalesce(satisfaction_score::text,'NULL'), comment, check_date::text,
      coalesce(week_number::text,'NULL'), employee_id::text),
    E',\n' ORDER BY id) ||
  E'\n) AS src(nk, mood, workload, satisf, cmt, cdate, week, emp)\nLEFT JOIN sys.sys_users u ON u.user_external_code = ''LEGACY_EMP::''||src.emp\nON CONFLICT (pulse_check_tenant_id, pulse_check_natural_key) DO NOTHING;\n'
FROM pulse_checks WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';
