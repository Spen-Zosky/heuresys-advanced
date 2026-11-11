-- Classi rimanenti di testo e dati RTL (relay del coordinatore 2026-11-11). Idempotente. Giornale: staging.rtl_allinea_testi_undo (testi) e staging.rtl_allinea_org_undo (righe).
--  - calibrazioni (nome, direzione), indagini «Pulse Survey», squadre, annunci, nodi con titoli inglesi di direzione
--  - refuso «á» finale di parola in tutte le colonne di testo di sys («operativitá» ecc.)
--  - percorsi di carriera: difficolta' dal numero di passi
--  - documenti di collaudo «[hb-media-e2e]» (le prove li creano da se', vedi handbook-media.spec.ts)
--  - rappresentazioni dell'organigramma: resta la versione piu' recente, le altre si disattivano e i riferimenti si spostano
--  - blueprint e processo: nomi in italiano, settore della famiglia nel metadato
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_testi_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, colonna text NOT NULL, vecchio text NOT NULL, nuovo text NOT NULL, righe bigint NOT NULL, PRIMARY KEY (tabella, colonna, vecchio));
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE FUNCTION pg_temp.dir_it(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(x,
  'Commercial Banking','Banca Commerciale'),'Information Technology','Tecnologia dell''informazione'),'Finance & Treasury','Finanza e Tesoreria'),'Retail Banking','Retail Banking'),
  'Human Resources','Risorse Umane'),'Legal & Compliance','Legale e Compliance'),'Cross-functional','Trasversale'),'Technology','Tecnologia'),'Calibration ','Calibrazione '),'Performance Calibration','Calibrazione della performance') $f$;
-- sostituzioni esatte o per funzione, con giornale
CREATE TEMP TABLE sost(tabella text, colonna text, vecchio text, nuovo text) ON COMMIT DROP;
INSERT INTO sost SELECT 'sys_calibration_sessions','calibration_session_department', d, pg_temp.dir_it(d) FROM (SELECT DISTINCT calibration_session_department d FROM sys.sys_calibration_sessions) x WHERE d IS NOT NULL;
INSERT INTO sost SELECT 'sys_calibration_sessions','calibration_session_name', n, replace(replace(pg_temp.dir_it(n),'Year-End Calibration','Calibrazione di fine anno'),'Q4 2024','4T 2024') FROM (SELECT DISTINCT calibration_session_name n FROM sys.sys_calibration_sessions) x;
INSERT INTO sost VALUES
 ('sys_surveys','survey_title','Q3 2024 Pulse Survey','Indagine rapida 3T 2024'),('sys_surveys','survey_title','Q4 2025 Pulse Survey','Indagine rapida 4T 2025'),
 ('sys_teams','team_name','Squadra Commercial Banking','Squadra Banca Commerciale'),('sys_projects','project_name','Squadra Commercial Banking','Squadra Banca Commerciale'),
 ('sys_visualization_nodes','node_label','Head of Commercial Banking','Direttore Commerciale'),
 ('sys_blueprint_families','blueprint_family_name','Financial Services — Banking','Servizi finanziari — Banche'),
 ('sys_blueprint_families','blueprint_family_name','Management Consulting','Consulenza direzionale'),
 ('sys_blueprint_variants','blueprint_variant_name','Regional Retail Bank (Medium)','Banca retail regionale (media)'),
 ('sys_blueprint_process_registry','blueprint_process_name','KYC / AML','Adeguata verifica e antiriciclaggio'),
 ('sys_tenant_processes','tenant_process_name','KYC / AML','Adeguata verifica e antiriciclaggio');
DELETE FROM sost WHERE vecchio = nuovo;
DO $$ DECLARE r record; n bigint; BEGIN
  FOR r IN SELECT * FROM sost LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L', r.tabella, r.colonna, r.vecchio) INTO n;
    IF n > 0 THEN
      INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) VALUES (r.tabella, r.colonna, r.vecchio, r.nuovo, n) ON CONFLICT DO NOTHING;
      EXECUTE format('UPDATE sys.%I SET %I = %L WHERE %I = %L', r.tabella, r.colonna, r.nuovo, r.colonna, r.vecchio);
    END IF;
  END LOOP;
END $$;
-- annunci: titolo di direzione in italiano nel testo
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_job_postings','posting_description', posting_description, replace(posting_description,'Head of Commercial Banking','Direttore Commerciale'), count(*) FROM sys.sys_job_postings WHERE posting_description LIKE '%Head of Commercial Banking%' GROUP BY posting_description ON CONFLICT DO NOTHING;
UPDATE sys.sys_job_postings SET posting_description = replace(posting_description,'Head of Commercial Banking','Direttore Commerciale') WHERE posting_description LIKE '%Head of Commercial Banking%';
-- refuso «á» finale di parola, ovunque in sys (testo)
DO $$ DECLARE r record; n bigint; BEGIN
  FOR r IN SELECT table_name t, column_name c FROM information_schema.columns WHERE table_schema='sys' AND data_type IN ('character varying','text') AND table_name IN (SELECT tablename FROM pg_tables) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I ~ %L', r.t, r.c, '[a-z]á([^a-z]|$)') INTO n;
    IF n > 0 THEN
      EXECUTE format('INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT %L, %L, %I, regexp_replace(%I, %L, %L, %L), count(*) FROM sys.%I WHERE %I ~ %L GROUP BY %I ON CONFLICT DO NOTHING', r.t, r.c, r.c, r.c, '([a-z])á(?![a-z])', '\1à', 'g', r.t, r.c, '[a-z]á([^a-z]|$)', r.c);
      EXECUTE format('UPDATE sys.%I SET %I = regexp_replace(%I, %L, %L, %L) WHERE %I ~ %L', r.t, r.c, r.c, '([a-z])á(?![a-z])', '\1à', 'g', r.c, '[a-z]á([^a-z]|$)');
    END IF;
  END LOOP;
END $$;
-- percorsi di carriera: difficolta' dal numero di passi
UPDATE sys.sys_career_paths c SET career_path_metadata = c.career_path_metadata || jsonb_build_object('difficulty', CASE WHEN n.k <= 2 THEN 'EASY' WHEN n.k <= 4 THEN 'MEDIUM' ELSE 'HARD' END)
FROM (SELECT career_path_step_path_id p, count(*) k FROM sys.sys_career_path_steps GROUP BY 1) n
WHERE n.p = c.career_path_id AND c.career_path_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND NOT (c.career_path_metadata ? 'difficulty');
-- settore della famiglia di blueprint nel metadato
UPDATE sys.sys_blueprint_families SET blueprint_family_metadata = blueprint_family_metadata || jsonb_build_object('industryCode', blueprint_family_code) WHERE NOT (blueprint_family_metadata ? 'industryCode');
-- documenti di collaudo [hb-media-e2e]
CREATE TEMP TABLE doc ON COMMIT DROP AS SELECT document_id FROM sys.sys_content_documents WHERE document_title ~ '^\[hb-media-e2e\]';
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_documents', d.document_id, to_jsonb(d) FROM sys.sys_content_documents d JOIN doc USING (document_id) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_versions', v.version_id, to_jsonb(v) FROM sys.sys_content_versions v WHERE v.version_document_id IN (SELECT document_id FROM doc) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_blueprint_links', l.link_id, to_jsonb(l) FROM sys.sys_content_blueprint_links l WHERE l.link_document_id IN (SELECT document_id FROM doc) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_media', m.media_id, to_jsonb(m) FROM sys.sys_content_media m WHERE m.media_document_id IN (SELECT document_id FROM doc) ON CONFLICT DO NOTHING;
UPDATE sys.sys_content_documents SET document_current_version_id = NULL WHERE document_id IN (SELECT document_id FROM doc);
DELETE FROM sys.sys_content_documents WHERE document_id IN (SELECT document_id FROM doc);
-- organigramma: resta la versione piu' recente, le altre si disattivano e i riferimenti si spostano
CREATE TEMP TABLE v ON COMMIT DROP AS
SELECT graph_id, graph_tenant_id, graph_code, row_number() OVER (PARTITION BY graph_tenant_id, graph_code ORDER BY graph_version DESC) rn FROM sys.sys_visualization_graphs WHERE graph_name='RTL Bank — Organigramma' OR graph_name LIKE 'RTL Bank — Organigramma%';
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_visualization_exports', e.export_id, to_jsonb(e) FROM sys.sys_visualization_exports e JOIN v ON v.graph_id=e.export_graph_id AND v.rn>1 ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_visualization_graphs', g.graph_id, to_jsonb(g) FROM sys.sys_visualization_graphs g JOIN v ON v.graph_id=g.graph_id AND v.rn>1 ON CONFLICT DO NOTHING;
UPDATE sys.sys_visualization_exports e SET export_graph_id = nv.graph_id,
  export_layout_id = COALESCE((SELECT l.layout_id FROM sys.sys_visualization_layouts l WHERE l.layout_graph_id = nv.graph_id ORDER BY l.created_at LIMIT 1), e.export_layout_id)
FROM v old JOIN v nv ON nv.graph_tenant_id=old.graph_tenant_id AND nv.graph_code=old.graph_code AND nv.rn=1
WHERE old.rn>1 AND old.graph_id=e.export_graph_id;
UPDATE sys.sys_visualization_graphs g SET graph_is_active=false FROM v WHERE v.graph_id=g.graph_id AND v.rn>1 AND g.graph_is_active;
-- «Qualita» senza accento nei titoli e nelle mansioni
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_positions','position_title', position_title, replace(position_title,'Qualita ','Qualità '), count(*) FROM sys.sys_positions WHERE position_title LIKE '%Qualita %' GROUP BY position_title ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions SET position_title = replace(position_title,'Qualita ','Qualità ') WHERE position_title LIKE '%Qualita %';
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_job_roles','job_role_name', job_role_name, replace(job_role_name,'Qualita ','Qualità '), count(*) FROM sys.sys_job_roles WHERE job_role_name LIKE '%Qualita %' GROUP BY job_role_name ON CONFLICT DO NOTHING;
UPDATE sys.sys_job_roles SET job_role_name = replace(job_role_name,'Qualita ','Qualità ') WHERE job_role_name LIKE '%Qualita %';
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_user_contracts','user_contract_job_title', user_contract_job_title, replace(user_contract_job_title,'Qualita ','Qualità '), count(*) FROM sys.sys_user_contracts WHERE user_contract_job_title LIKE '%Qualita %' GROUP BY user_contract_job_title ON CONFLICT DO NOTHING;
UPDATE sys.sys_user_contracts SET user_contract_job_title = replace(user_contract_job_title,'Qualita ','Qualità ') WHERE user_contract_job_title LIKE '%Qualita %';
COMMIT;
SELECT 'S ok';
