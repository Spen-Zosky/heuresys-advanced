-- Assegna le attivita' APQC di RTL Bank al sottoprocesso che le contiene (voce fuori ciclo F15 del giro di
-- verifica del 25/11/2026: «le attivita' dei processi non sono assegnate ai sottoprocessi»).
--
-- ORIGINE DEL VUOTO. riempi-attivita-dei-processi.sql (27/10/2026) ha caricato le 131 attivita' sui processi
-- di primo livello; i sottoprocessi sono stati collocati dopo (000498, 18/11 e 22/11) e nessuna attivita' li
-- ha seguiti: 24 sottoprocessi su 24 con 0 attivita'.
--
-- COSA FA. Sposta una attivita' dal processo di primo livello al suo sottoprocesso (cambia solo
-- tenant_process_step_process_id e rinumera l'ordinale dentro il sottoprocesso). L'identificativo
-- dell'attivita' non cambia, quindi regole e richieste che la citano restano valide.
-- LA MAPPA e' conservativa: solo dove il nome dell'attivita' APQC cade nello scopo dichiarato dal
-- sottoprocesso (descrizione di P12-P30 letta in produzione il 26/11/2026). Le altre restano sul processo
-- e vanno assegnate da chi governa il processo. Non si assegna per somiglianza vaga.
--   03 -> P13 Mantenimento dei conti: 5.4.5.1, .2, .3, .5, .6, .10, .11
--   13 -> P15 Gestione della cassa: 5.4.8.11, 5.4.8.12
--   13 -> P16 Servizio alla clientela bancaria (credito): 5.4.8.2, 5.4.8.3, 5.4.8.5
--   14 -> P19 Reclami e customer satisfaction: 6.2.2.1, .2, .3, .4
--   17 -> P24 Onboarding, formazione e sviluppo: 7.3.1, 7.3.3  (7.3.4 resta: e' l'attivita' della regola
--          delle richieste di formazione, e le sentinelle vogliono regola e attivita' nello stesso processo)
--   20 -> P30 Sicurezza (fisica e antirapina): 10.1.4.3
-- GUARDIA. Ogni sottoprocesso e' al livello 2 con il genitore atteso; ogni attivita' da spostare e' ancora
-- sul genitore (o gia' sul figlio: seconda passata); un'attivita' citata da una regola o da una richiesta
-- non si sposta (resta sul genitore e lo dice). Altrimenti si ferma senza scrivere.
-- POST-CONDIZIONE. Attivita' totali invariate; tutte le colonne tranne processo, ordinale e updated_at
-- invariate (impronta); le sentinelle di 000462 a zero.
-- RITORNO. Giornale staging.attivita_sottoprocessi_undo e assegna-attivita-ai-sottoprocessi-inversa.sql.
-- IDEMPOTENTE: la seconda passata non trova niente da spostare.
\set ON_ERROR_STOP on
BEGIN;
-- Blocco contro scritture concorrenti fra la lettura e lo spostamento.
LOCK TABLE sys.sys_tenant_process_steps IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE sys.sys_tenant_process_activity_rules, sys.sys_approval_requests IN SHARE MODE;

CREATE TABLE IF NOT EXISTS staging.attivita_sottoprocessi_undo (
  salvato_il    timestamptz NOT NULL DEFAULT clock_timestamp(),
  attivita_id   uuid PRIMARY KEY,
  processo_prima uuid NOT NULL,
  ordinale_prima smallint NOT NULL,
  processo_dopo uuid NOT NULL
);

CREATE TEMP TABLE mappa(genitore text, apqc text, figlio text, PRIMARY KEY (genitore, apqc)) ON COMMIT DROP;
INSERT INTO mappa VALUES
  ('03','5.4.5.1','P13'),('03','5.4.5.2','P13'),('03','5.4.5.3','P13'),('03','5.4.5.5','P13'),
  ('03','5.4.5.6','P13'),('03','5.4.5.10','P13'),('03','5.4.5.11','P13'),
  ('13','5.4.8.11','P15'),('13','5.4.8.12','P15'),
  ('13','5.4.8.2','P16'),('13','5.4.8.3','P16'),('13','5.4.8.5','P16'),
  ('14','6.2.2.1','P19'),('14','6.2.2.2','P19'),('14','6.2.2.3','P19'),('14','6.2.2.4','P19'),
  ('17','7.3.1','P24'),('17','7.3.3','P24'),
  ('20','10.1.4.3','P30');

CREATE TEMP TABLE pr ON COMMIT DROP AS
SELECT tenant_process_code c, tenant_process_id id, tenant_process_level lv, tenant_process_parent_id par
  FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND tenant_process_is_active;

CREATE TEMP TABLE da_fare ON COMMIT DROP AS
SELECT st.tenant_process_step_id sid, st.tenant_process_step_process_id attuale, st.tenant_process_step_ordinal ord_prima,
       g.id gid, f.id fid, m.figlio, m.genitore, m.apqc,
       (EXISTS (SELECT 1 FROM sys.sys_tenant_process_activity_rules r WHERE r.tenant_process_activity_rule_step_id = st.tenant_process_step_id)
        OR EXISTS (SELECT 1 FROM sys.sys_approval_requests a WHERE a.approval_request_tenant_process_step_id = st.tenant_process_step_id)) AS citata
  FROM mappa m
  JOIN pr g ON g.c = m.genitore AND g.lv = 1
  JOIN pr f ON f.c = m.figlio AND f.lv = 2 AND f.par = g.id
  JOIN sys.sys_tenant_process_steps st
    ON st.tenant_process_step_process_id IN (g.id, f.id) AND st.tenant_process_step_code = m.apqc
   AND st.tenant_process_step_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

CREATE TEMP TABLE impronta_prima ON COMMIT DROP AS
SELECT count(*) n, md5(string_agg((to_jsonb(s) - 'tenant_process_step_process_id' - 'tenant_process_step_ordinal' - 'updated_at')::text, '|' ORDER BY s.tenant_process_step_id)) h
  FROM sys.sys_tenant_process_steps s;

DO $$
DECLARE n_map int; n_trov int; n_dist int; n_cit int;
BEGIN
  SELECT count(*) INTO n_map FROM mappa;
  SELECT count(*) INTO n_trov FROM da_fare;
  SELECT count(DISTINCT (genitore, apqc)) INTO n_dist FROM da_fare;
  SELECT count(*) INTO n_cit FROM da_fare WHERE citata AND attuale = gid;
  RAISE NOTICE 'misura: % voci in mappa, % trovate, % citate da regole o richieste (restano sul genitore)', n_map, n_trov, n_cit;
  IF n_trov <> n_map OR n_dist <> n_map THEN RAISE EXCEPTION 'guardia: attese % attivita'', trovate % (% voci distinte): mancano, sono doppie o manca il sottoprocesso atteso; niente scritto', n_map, n_trov, n_dist; END IF;
END $$;

INSERT INTO staging.attivita_sottoprocessi_undo (attivita_id, processo_prima, ordinale_prima, processo_dopo)
SELECT sid, gid, ord_prima, fid FROM da_fare WHERE attuale = gid AND NOT citata
ON CONFLICT (attivita_id) DO UPDATE SET salvato_il = clock_timestamp(), processo_prima = EXCLUDED.processo_prima,
  ordinale_prima = EXCLUDED.ordinale_prima, processo_dopo = EXCLUDED.processo_dopo;

WITH nuovo AS (
  SELECT sid, fid, row_number() OVER (PARTITION BY fid ORDER BY ord_prima, apqc)
         + coalesce((SELECT max(x.tenant_process_step_ordinal) FROM sys.sys_tenant_process_steps x WHERE x.tenant_process_step_process_id = fid), 0) AS o
    FROM da_fare WHERE attuale = gid AND NOT citata
)
UPDATE sys.sys_tenant_process_steps st
   SET tenant_process_step_process_id = n.fid, tenant_process_step_ordinal = n.o
  FROM nuovo n WHERE st.tenant_process_step_id = n.sid;

DO $$
DECLARE a bigint; b text; dif int; sul_figlio int; pc text;
BEGIN
  SELECT count(*), md5(string_agg((to_jsonb(s) - 'tenant_process_step_process_id' - 'tenant_process_step_ordinal' - 'updated_at')::text, '|' ORDER BY s.tenant_process_step_id))
    INTO a, b FROM sys.sys_tenant_process_steps s;
  IF a <> (SELECT n FROM impronta_prima) OR b <> (SELECT h FROM impronta_prima) THEN
    RAISE EXCEPTION 'post-condizione: sono cambiate altre colonne delle attivita''';
  END IF;
  SELECT count(*) INTO dif FROM (
    SELECT riga FROM sys.v_tenant_process_steps_cross_tenant
    UNION ALL SELECT riga FROM sys.v_tenant_process_activity_rules_cross_tenant
    UNION ALL SELECT riga FROM sys.v_approval_requests_process_cross_tenant) x;
  IF dif <> 0 THEN RAISE EXCEPTION 'post-condizione: % difetti nelle sentinelle di 000462', dif; END IF;
  SELECT count(*) INTO sul_figlio FROM da_fare d JOIN sys.sys_tenant_process_steps st ON st.tenant_process_step_id = d.sid
   WHERE st.tenant_process_step_process_id = d.fid;
  RAISE NOTICE 'fatto: % attivita'' su un sottoprocesso, % attivita'' totali, 0 difetti', sul_figlio, a;
END $$;

COMMIT;
