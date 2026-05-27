-- SDBI Mentorship pilot — Phase 3: seed temp_sdbi from legacy_mirror. Transforms:
-- tenant lookup; ARRAY→jsonb; ts-without-tz→UTC; user FKs NULL (legacy in metadata);
-- sessions inherit tenant from parent mentorship. Run via psql -v ON_ERROR_STOP=1.
BEGIN;
DO $$ DECLARE v uuid := gen_random_uuid(); BEGIN
  INSERT INTO brownfield.import_runs (import_run_id, import_run_export_id, import_run_status, import_run_started_at, import_run_metadata)
  VALUES (v,(SELECT source_export_id FROM brownfield.source_exports ORDER BY 1 LIMIT 1),'RUNNING',now(),
    jsonb_build_object('workflow','SDBI_PHASE_3','pilot','mentorship','mapping_card','MENTORSHIP-MAP-01','source','heuresys_platform_0507'));
  PERFORM set_config('sdbi.run_id', v::text, true);
END $$;

INSERT INTO temp_sdbi.mentorship_programs (_legacy_source_id,_import_run_id,program_tenant_id,program_natural_key,
  program_name,program_description,program_type,program_status,program_duration_months,program_max_participants,
  program_focus_areas,program_eligibility_criteria,program_start_date,program_end_date,program_metadata,created_at,updated_at)
SELECT src.id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'MENTOR_PROGRAM::'||tm.canonical_tenant_id::text||'::'||src.id::text, TRIM(src.name), src.description,
  UPPER(src.program_type), UPPER(src.status), src.duration_months, src.max_participants,
  to_jsonb(src.focus_areas), src.eligibility_criteria, src.start_date, src.end_date,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.mentorship_programs'),
  src.created_at AT TIME ZONE 'UTC', src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.mentorship_programs src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.mentorships (_legacy_source_id,_legacy_source_program_id,_import_run_id,mentorship_tenant_id,
  mentorship_natural_key,mentorship_status,mentorship_focus_areas,mentorship_meeting_frequency,mentorship_goals,
  mentorship_match_score,mentorship_start_date,mentorship_end_date,mentorship_notes,mentorship_metadata,created_at,updated_at)
SELECT src.id, src.program_id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'MENTORSHIP::'||tm.canonical_tenant_id::text||'::'||src.id::text, UPPER(src.status), to_jsonb(src.focus_areas),
  UPPER(src.meeting_frequency), to_jsonb(src.goals), src.match_score, src.start_date, src.end_date, src.notes,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.mentorships','legacy_program_id',src.program_id::text,
    'legacy_mentor_id',src.mentor_id::text,'legacy_mentee_id',src.mentee_id::text),
  src.created_at AT TIME ZONE 'UTC', src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.mentorships src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.mentorship_sessions (_legacy_source_id,_legacy_source_mentorship_id,_import_run_id,session_tenant_id,
  session_natural_key,session_date,session_duration_minutes,session_status,session_topics,session_notes,session_rating,
  session_metadata,created_at,updated_at)
SELECT src.id, src.mentorship_id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'MENTOR_SESSION::'||tm.canonical_tenant_id::text||'::'||src.id::text, src.session_date AT TIME ZONE 'UTC',
  src.duration_minutes, UPPER(src.status), to_jsonb(src.topics), src.notes, src.rating,
  jsonb_build_object('legacy_id',src.id::text,'legacy_mentorship_id',src.mentorship_id::text),
  src.created_at AT TIME ZONE 'UTC', src.created_at AT TIME ZONE 'UTC'
FROM legacy_mirror.mentorship_sessions src
JOIN legacy_mirror.mentorships m ON m.id=src.mentorship_id
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=m.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.mentor_match_scores (_legacy_source_id,_import_run_id,match_tenant_id,match_natural_key,
  match_legacy_skill_id,match_skill_name,match_mentee_level,match_mentor_level,match_score,match_factors,
  match_is_recommended,match_recommendation_rank,match_metadata,created_at,expires_at)
SELECT src.id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'MENTOR_MATCH::'||tm.canonical_tenant_id::text||'::'||src.id::text, src.skill_id, src.skill_name,
  src.mentee_level, src.mentor_level, src.match_score, src.match_factors, src.is_recommended, src.recommendation_rank,
  jsonb_build_object('legacy_id',src.id::text,'legacy_mentee_id',src.mentee_id::text,'legacy_mentor_id',src.mentor_id::text,
    'legacy_skill_id',src.skill_id::text),
  src.created_at, src.expires_at
FROM legacy_mirror.mentor_match_scores src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

UPDATE brownfield.import_runs SET import_run_status='COMPLETED', import_run_finished_at=now() WHERE import_run_id=current_setting('sdbi.run_id')::uuid;
COMMIT;
SELECT 'programs' t,count(*) FROM temp_sdbi.mentorship_programs UNION ALL SELECT 'mentorships',count(*) FROM temp_sdbi.mentorships
UNION ALL SELECT 'sessions',count(*) FROM temp_sdbi.mentorship_sessions UNION ALL SELECT 'match_scores',count(*) FROM temp_sdbi.mentor_match_scores ORDER BY 1;
