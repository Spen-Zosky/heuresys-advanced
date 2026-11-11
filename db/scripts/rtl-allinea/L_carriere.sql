-- Voce 2 / D carriere (mandato RTL 2026-11-11): i 9 percorsi di carriera della corsa p20261010010521tjb applicati a RTL.
-- Ogni passo della corsa (codice posto) diventa la posizione RTL occupata dalla persona abbinata a quel posto (staging.rtl_persona_corsa);
-- un percorso entra se ha almeno 2 passi risolti. Si aggiungono, non si tolgono: i percorsi esistenti restano (con nomi in italiano da J).
-- Idempotente (codice CAR-TJB-nnn). Giornale: staging.rtl_allinea_org_undo (righe inserite come 'ins:sys_career_paths' / 'ins:sys_career_path_steps').
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE corsa(codice text, nome text, tipo text, passi text[]) ON COMMIT DROP;
INSERT INTO corsa VALUES
('CAR-TJB-001','Dal Back Office Conti al Capo Divisione Operations e IT','VERTICAL',ARRAY['R078','R077','R028','R027']),
('CAR-TJB-002','Carriera nella Direzione Crediti: da Analista a Capo Divisione','VERTICAL',ARRAY['R065','R064','R063','R062','R024']),
('CAR-TJB-003','Dalla Cassa di Filiale alla Direzione Rete Commerciale','VERTICAL',ARRAY['R049','R048','R045','R041']),
('CAR-TJB-004','Carriera IT: da Analista Programmatore a Capo Divisione Operations e IT','VERTICAL',ARRAY['R087','R085','R084','R027']),
('CAR-TJB-005','Carriera nella Gestione dei Rischi: da Addetto a Direttore Rischi','VERTICAL',ARRAY['R013','R011','R010']),
('CAR-TJB-006','Carriera in Compliance: da Addetto a Responsabile Compliance','VERTICAL',ARRAY['R009','R007','R006']),
('CAR-TJB-007','Da Consulente di Filiale a Capo Divisione Crediti e Finanza','CROSS_FUNCTIONAL',ARRAY['R051','R065','R063','R025','R024']),
('CAR-TJB-008','Dalla Gestione dei Rischi al Rischio Operativo e Antiriciclaggio','CROSS_FUNCTIONAL',ARRAY['R012','R016','R015','R014']),
('CAR-TJB-009','Dalla Direzione IT alla Direzione Centro Operativo','CROSS_FUNCTIONAL',ARRAY['R088','R075','R074']);
-- posto RTL rappresentante di ogni posto della corsa: quello piu' occupato fra le persone abbinate
CREATE TEMP TABLE rap ON COMMIT DROP AS
SELECT DISTINCT ON (pc.codice) pc.codice, a.user_position_assignment_position_id pos
FROM staging.rtl_persona_corsa pc
JOIN sys.sys_users u ON u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND u.user_last_name||', '||u.user_first_name = pc.persona
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
ORDER BY pc.codice, a.user_position_assignment_position_id;
CREATE TEMP TABLE passi ON COMMIT DROP AS
SELECT c.codice, s.ord, r.pos FROM corsa c, unnest(c.passi) WITH ORDINALITY s(cod, ord) JOIN rap r ON r.codice = s.cod;
CREATE TEMP TABLE entra ON COMMIT DROP AS
SELECT c.*, gen_random_uuid() id FROM corsa c WHERE (SELECT count(*) FROM passi p WHERE p.codice=c.codice) >= 2
  AND NOT EXISTS (SELECT 1 FROM sys.sys_career_paths x WHERE x.career_path_code=c.codice AND x.career_path_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0');
INSERT INTO sys.sys_career_paths (career_path_id, career_path_tenant_id, career_path_code, career_path_name, career_path_description, career_path_kind, career_path_is_global, career_path_metadata)
SELECT id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', codice, nome, 'Percorso della corsa p20261010010521tjb applicato a RTL Bank', tipo, false, '{"allinea":"L","corsa":"p20261010010521tjb"}'::jsonb FROM entra;
INSERT INTO sys.sys_career_path_steps (career_path_step_path_id, career_path_step_ordinal, career_path_step_origin_position_id, career_path_step_target_position_id, career_path_step_required_proficiency_uplift, career_path_step_typical_duration_months, career_path_step_metadata)
SELECT e.id, row_number() OVER (PARTITION BY e.id ORDER BY p.ord)::int,
       lag(p.pos) OVER (PARTITION BY e.id ORDER BY p.ord), p.pos, '{"skill_gap_threshold": 0.50}'::jsonb, 24, '{"allinea":"L"}'::jsonb
FROM entra e JOIN passi p ON p.codice=e.codice;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_career_paths', id, '{}'::jsonb FROM entra ON CONFLICT DO NOTHING;
COMMIT;
SELECT 'L ok' esito, (SELECT count(*) FROM sys.sys_career_paths WHERE career_path_code LIKE 'CAR-TJB-%') percorsi, (SELECT count(*) FROM sys.sys_career_path_steps s JOIN sys.sys_career_paths c ON c.career_path_id=s.career_path_step_path_id WHERE c.career_path_code LIKE 'CAR-TJB-%') passi;
